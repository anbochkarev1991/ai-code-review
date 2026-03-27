import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type {
  GetReviewResponse,
  GetReviewsResponse,
  PostReviewsResponse,
  PRMetadata,
  ReviewResult,
} from 'shared';
import { getReviewDecision } from 'shared';
import {
  buildReviewSummaryParagraph,
  detectSystemicPatterns,
} from './review-summary-text';
import { DiffParser } from './diff-parser';
import { ReviewOrchestrator } from './engine/orchestrator';
import { GitHubService } from '../github/github.service';
import { ReviewRunsRepository } from './review-runs.repository';
import { SeverityNormalizer } from './severity-normalizer';
import { AiSummaryGeneratorService } from './ai-summary-generator.service';

const LARGE_PR_LINE_THRESHOLD = 1000;
const MARKDOWN_ONLY_EXTENSIONS = new Set(['markdown']);

export interface RunPipelineParams {
  userId: string;
  userJwt: string;
  repoFullName: string;
  prNumber: number;
  prTitle?: string | null;
  prAuthor?: string | null;
  commitCount?: number | null;
  prDiff: string;
  prFiles: import('shared').DiffFile[];
  accessToken: string;
  headSha: string | null;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly diffParser: DiffParser,
    private readonly orchestrator: ReviewOrchestrator,
    private readonly reviewRunsRepository: ReviewRunsRepository,
    private readonly githubService: GitHubService,
    private readonly severityNormalizer: SeverityNormalizer,
    private readonly aiSummaryGenerator: AiSummaryGeneratorService,
  ) {}

  async findOne(
    id: string,
    userJwt: string,
  ): Promise<GetReviewResponse | null> {
    return this.reviewRunsRepository.findById(id, userJwt);
  }

  async findAll(
    limit: number,
    offset: number,
    userJwt: string,
  ): Promise<GetReviewsResponse> {
    return this.reviewRunsRepository.findAll(limit, offset, userJwt);
  }

  async runReview(
    userId: string,
    userJwt: string,
    repoFullName: string,
    prNumber: number,
  ): Promise<PostReviewsResponse> {
    const accessToken = await this.githubService.getAccessTokenForUser(
      userId,
      userJwt,
    );
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      throw new UnauthorizedException('Invalid repo_full_name format');
    }

    const diffResponse = await this.githubService.getPullDiff(
      accessToken,
      owner,
      repo,
      prNumber,
    );

    return this.runPipeline({
      userId,
      userJwt,
      repoFullName,
      prNumber,
      prTitle: diffResponse.pr_title ?? null,
      prAuthor: diffResponse.pr_author ?? null,
      commitCount: diffResponse.commit_count ?? null,
      prDiff: diffResponse.diff,
      prFiles: diffResponse.files,
      accessToken,
      headSha: diffResponse.head_sha ?? null,
    });
  }

  async runPipeline(params: RunPipelineParams): Promise<PostReviewsResponse> {
    const {
      userId,
      userJwt,
      repoFullName,
      prNumber,
      prTitle,
      prAuthor,
      commitCount,
      prDiff,
      prFiles,
      accessToken,
      headSha,
    } = params;

    const [owner, repo] = repoFullName.split('/');

    const parsedDiff = this.diffParser.parse(prFiles);

    const prMetadata: PRMetadata = {
      pr_number: prNumber,
      pr_title: prTitle ?? '',
      pr_author: prAuthor ?? undefined,
      commit_count: commitCount ?? undefined,
      total_files_changed: parsedDiff.stats.filesChanged,
      total_additions: parsedDiff.stats.additions,
      total_deletions: parsedDiff.stats.deletions,
      analysis_scope: 'diff-only',
    };

    if (parsedDiff.files.length === 0) {
      return this.handleEmptyDiff(
        userId,
        userJwt,
        repoFullName,
        prNumber,
        prTitle,
        prMetadata,
      );
    }

    const allMarkdown = parsedDiff.files.every((f) =>
      MARKDOWN_ONLY_EXTENSIONS.has(f.language),
    );
    if (allMarkdown) {
      return this.handleMarkdownOnly(
        userId,
        userJwt,
        repoFullName,
        prNumber,
        prTitle,
        prMetadata,
      );
    }

    if (parsedDiff.stats.totalChangedLines > LARGE_PR_LINE_THRESHOLD) {
      this.logger.warn(
        `Large PR detected: ${parsedDiff.stats.totalChangedLines} changed lines. ` +
          `Results may be less precise for PRs exceeding ${LARGE_PR_LINE_THRESHOLD} lines.`,
      );
    }

    this.logger.log(
      `Reviewing ${parsedDiff.stats.filesChanged} files, ${parsedDiff.stats.totalChangedLines} changed lines`,
    );

    const engineResult = await this.orchestrator.runReview(
      parsedDiff.files,
      prMetadata,
      prDiff,
      {
        gitContext:
          owner && repo && headSha
            ? { accessToken, owner, repo, headRef: headSha }
            : undefined,
      },
    );

    if (engineResult.status === 'failed') {
      const id = await this.reviewRunsRepository.create(
        {
          userId,
          repoFullName,
          prNumber,
          prTitle: prTitle ?? null,
          status: 'failed',
          trace: engineResult.trace,
          errorMessage: engineResult.error_message ?? 'All agents failed',
        },
        userJwt,
      );
      return {
        id,
        status: 'failed',
        trace: engineResult.trace,
        error_message: engineResult.error_message,
      };
    }

    let normalizedResult: ReviewResult | undefined = engineResult.result
      ? this.syncReviewSummaryWithFindings({
          ...engineResult.result,
          findings: this.severityNormalizer.normalize(
            engineResult.result.findings,
          ),
        })
      : undefined;

    if (
      normalizedResult?.findings &&
      normalizedResult.review_summary
    ) {
      const aiSummary = await this.aiSummaryGenerator.generate(
        normalizedResult.findings,
        normalizedResult.review_summary,
      );
      if (aiSummary) {
        normalizedResult = {
          ...normalizedResult,
          ai_review_summary: aiSummary,
        };
      }
    }

    const id = await this.reviewRunsRepository.create(
      {
        userId,
        repoFullName,
        prNumber,
        prTitle: prTitle ?? null,
        status: engineResult.status,
        resultSnapshot: normalizedResult,
        trace: engineResult.trace,
      },
      userJwt,
    );

    return {
      id,
      status: engineResult.status,
      result_snapshot: normalizedResult,
      trace: engineResult.trace,
    };
  }

  private async handleEmptyDiff(
    userId: string,
    userJwt: string,
    repoFullName: string,
    prNumber: number,
    prTitle: string | null | undefined,
    prMetadata: PRMetadata,
  ): Promise<PostReviewsResponse> {
    const emptyResult: ReviewResult = {
      findings: [],
      summary: 'No reviewable changes found in this Pull Request.',
      review_summary: {
        total_findings: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        risk_score: 0,
        risk_level: 'Low risk',
        merge_recommendation: 'Safe to merge',
        merge_explanation:
          'No reviewable code changes detected. All changed files were filtered out (lock files, build artifacts, binary files, etc.).',
        decision_verdict: 'safe',
        text: 'No reviewable changes found. All changed files were filtered out (lock files, build artifacts, etc.).',
      },
      execution_metadata: {
        agent_count: 0,
        duration_ms: 0,
        total_tokens: 0,
        agents_status: {},
      },
      pr_metadata: prMetadata,
    };

    const id = await this.reviewRunsRepository.create(
      {
        userId,
        repoFullName,
        prNumber,
        prTitle: prTitle ?? null,
        status: 'complete',
        resultSnapshot: emptyResult,
        trace: [],
      },
      userJwt,
    );
    return { id, status: 'complete', result_snapshot: emptyResult, trace: [] };
  }

  private async handleMarkdownOnly(
    userId: string,
    userJwt: string,
    repoFullName: string,
    prNumber: number,
    prTitle: string | null | undefined,
    prMetadata: PRMetadata,
  ): Promise<PostReviewsResponse> {
    const result: ReviewResult = {
      findings: [],
      summary:
        'Only documentation/markdown changes detected. No code review needed.',
      review_summary: {
        total_findings: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        risk_score: 0,
        risk_level: 'Low risk',
        merge_recommendation: 'Safe to merge',
        merge_explanation: 'Documentation-only changes — no code to review.',
        decision_verdict: 'safe',
        text: 'Only documentation/markdown changes detected. No code review needed. Recommendation: Safe to merge.',
      },
      execution_metadata: {
        agent_count: 0,
        duration_ms: 0,
        total_tokens: 0,
        agents_status: {},
      },
      pr_metadata: prMetadata,
    };

    const id = await this.reviewRunsRepository.create(
      {
        userId,
        repoFullName,
        prNumber,
        prTitle: prTitle ?? null,
        status: 'complete',
        resultSnapshot: result,
        trace: [],
      },
      userJwt,
    );
    return { id, status: 'complete', result_snapshot: result, trace: [] };
  }

  /** Recompute risk and merge fields from final findings (post SeverityNormalizer). */
  private syncReviewSummaryWithFindings(result: ReviewResult): ReviewResult {
    const { findings, review_summary: rs } = result;
    if (!findings || !rs) return result;

    const rd = getReviewDecision(findings);
    const systemicPatterns = detectSystemicPatterns(findings);
    const multiAgentConfirmedCount = findings.filter(
      (f) => f.consensus_level === 'multi-agent',
    ).length;

    const text = buildReviewSummaryParagraph({
      findings,
      counts: rd.severityCounts,
      riskScore: rd.riskScore,
      riskLevel: rd.riskLevel,
      mergeRecommendation: rd.recommendation,
      primaryRiskCategory: rd.primaryRisk,
      systemicPatterns,
      multiAgentConfirmedCount,
    });

    return {
      ...result,
      summary: text,
      review_summary: {
        ...rs,
        total_findings: findings.length,
        critical_count: rd.severityCounts.critical,
        high_count: rd.severityCounts.high,
        medium_count: rd.severityCounts.medium,
        low_count: rd.severityCounts.low,
        risk_score: rd.riskScore,
        risk_level: rd.riskLevel,
        risk_breakdown: rd.riskBreakdown,
        merge_recommendation: rd.recommendation,
        merge_explanation: rd.explanation,
        decision_verdict: rd.decision,
        risk_summary: rd.explanation,
        primary_risk_category: rd.primaryRisk,
        most_severe_issue:
          findings.length > 0 ? findings[0].title : undefined,
        systemic_patterns:
          systemicPatterns.length > 0 ? systemicPatterns : undefined,
        multi_agent_confirmed_count:
          multiAgentConfirmedCount > 0 ? multiAgentConfirmedCount : undefined,
        text,
      },
    };
  }
}
