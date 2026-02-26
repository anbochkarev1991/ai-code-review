import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AgentOutput,
  AgentStatus,
  GetReviewResponse,
  GetReviewsResponse,
  PostReviewsResponse,
  PRMetadata,
  ReviewResult,
  TraceStep,
} from 'shared';
import { ArchitectureAgent } from './agents/architecture.agent';
import { CodeQualityAgent } from './agents/code-quality.agent';
import { PerformanceAgent } from './agents/performance.agent';
import { SecurityAgent } from './agents/security.agent';
import type { CallWithValidationRetryResult } from './agents/agent-validation.utils';
import { DiffParser } from './diff-parser';
import { DeterministicAggregator } from './deterministic-aggregator';
import { ResultFormatter } from './result-formatter';
import { GitHubService } from '../github/github.service';
import { ReviewRunsRepository } from './review-runs.repository';
import { buildTraceStep, TRACE_AGENT_NAMES } from './trace.utils';
import type { ParsedFile } from '../types';

const AGENT_TIMEOUT_MS = 30_000;
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
}

interface DomainAgentResult {
  output: AgentOutput;
  status: 'ok';
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  promptSizeChars?: number;
  rawContent?: string;
}

interface DomainAgentFailure {
  error: string;
  status: 'error' | 'timeout';
}

type DomainAgentOutcome = DomainAgentResult | DomainAgentFailure;

/**
 * ReviewsService — pipeline orchestrator.
 *
 * Architecture:
 * ┌──────────────┐     ┌──────────────┐     ┌────────────────────┐
 * │ PR Metadata   │     │ Diff Extractor│     │ Agent Orchestrator  │
 * │ Fetcher       │────▶│ (DiffParser)  │────▶│ (4 agents parallel) │
 * └──────────────┘     └──────────────┘     └─────────┬──────────┘
 *                                                       │
 *                                                       ▼
 *                                           ┌────────────────────┐
 *                                           │ Finding Normalizer  │
 *                                           │ (dedup, confidence) │
 *                                           └─────────┬──────────┘
 *                                                       │
 *                                                       ▼
 *                                           ┌────────────────────┐
 *                                           │ Risk Engine         │
 *                                           │ (scoring, levels)   │
 *                                           └─────────┬──────────┘
 *                                                       │
 *                                                       ▼
 *                                           ┌────────────────────┐
 *                                           │ Result Formatter    │
 *                                           │ (UI-agnostic output)│
 *                                           └────────────────────┘
 *
 * Guarantees:
 * - Each agent runs with a timeout (AGENT_TIMEOUT_MS)
 * - One agent failure does NOT crash the entire review
 * - Partial results are returned when >= 1 agent succeeds
 * - Edge cases (empty diff, binary, markdown-only, large PR) degrade gracefully
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly codeQualityAgent: CodeQualityAgent,
    private readonly architectureAgent: ArchitectureAgent,
    private readonly performanceAgent: PerformanceAgent,
    private readonly securityAgent: SecurityAgent,
    private readonly diffParser: DiffParser,
    private readonly aggregator: DeterministicAggregator,
    private readonly resultFormatter: ResultFormatter,
    private readonly reviewRunsRepository: ReviewRunsRepository,
    private readonly githubService: GitHubService,
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
    });
  }

  async runPipeline(params: RunPipelineParams): Promise<PostReviewsResponse> {
    const {
      userId, userJwt, repoFullName, prNumber,
      prTitle, prAuthor, commitCount, prFiles,
    } = params;
    const trace: TraceStep[] = [];

    // ── Stage 1: Diff extraction ──
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

    // ── Edge case: empty diff (no reviewable files after filtering) ──
    if (parsedDiff.files.length === 0) {
      return this.handleEmptyDiff(userId, userJwt, repoFullName, prNumber, prTitle, prMetadata);
    }

    // ── Edge case: markdown-only changes ──
    const allMarkdown = parsedDiff.files.every(
      (f) => MARKDOWN_ONLY_EXTENSIONS.has(f.language),
    );
    if (allMarkdown) {
      return this.handleMarkdownOnly(userId, userJwt, repoFullName, prNumber, prTitle, prMetadata);
    }

    // ── Edge case: large PR warning ──
    const isLargePr = parsedDiff.stats.totalChangedLines > LARGE_PR_LINE_THRESHOLD;
    if (isLargePr) {
      this.logger.warn(
        `Large PR detected: ${parsedDiff.stats.totalChangedLines} changed lines. ` +
        `Results may be less precise for PRs exceeding ${LARGE_PR_LINE_THRESHOLD} lines.`,
      );
    }

    this.logger.log(
      `Reviewing ${parsedDiff.stats.filesChanged} files, ${parsedDiff.stats.totalChangedLines} changed lines`,
    );

    const files = parsedDiff.files;

    // ── Stage 2: Agent orchestration (parallel with timeout) ──
    const domainAgents = [
      {
        name: TRACE_AGENT_NAMES[0],
        run: () => this.codeQualityAgent.run(files),
      },
      {
        name: TRACE_AGENT_NAMES[1],
        run: () => this.architectureAgent.run(files),
      },
      {
        name: TRACE_AGENT_NAMES[2],
        run: () => this.performanceAgent.run(files),
      },
      {
        name: TRACE_AGENT_NAMES[3],
        run: () => this.securityAgent.run(files),
      },
    ] as const;

    const agentPromises = domainAgents.map(async ({ name, run }) => {
      const startedAt = new Date();
      try {
        const result: CallWithValidationRetryResult = await this.withTimeout(
          run(),
          AGENT_TIMEOUT_MS,
          `${name} agent timed out after ${AGENT_TIMEOUT_MS}ms`,
        );
        const finishedAt = new Date();
        return {
          name,
          startedAt,
          finishedAt,
          outcome: {
            output: result.output,
            status: 'ok' as const,
            tokensUsed: result.tokensUsed,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            rawContent: result.rawContent,
          },
        };
      } catch (err) {
        if (err instanceof HttpException) {
          throw err;
        }
        const finishedAt = new Date();
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isTimeout = errorMessage.includes('timed out');
        return {
          name,
          startedAt,
          finishedAt,
          outcome: {
            error: errorMessage,
            status: (isTimeout ? 'timeout' : 'error') as 'timeout' | 'error',
          },
        };
      }
    });

    let agentResults: Awaited<typeof agentPromises[number]>[];
    try {
      agentResults = await Promise.all(agentPromises);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw err;
    }

    // ── Stage 3: Build trace with enriched telemetry ──
    const outcomes: DomainAgentOutcome[] = [];
    for (const result of agentResults) {
      const isOk = result.outcome.status === 'ok';
      const okOutcome = isOk ? result.outcome as DomainAgentResult : undefined;

      const findingCount = okOutcome?.output.findings.length;
      const avgConfidence = findingCount && findingCount > 0
        ? okOutcome!.output.findings.reduce(
            (sum, f) => sum + (f.confidence ?? 0.5),
            0,
          ) / findingCount
        : undefined;

      trace.push(
        buildTraceStep({
          agent: result.name,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          status: result.outcome.status as 'ok' | 'timeout' | 'error',
          tokensUsed: okOutcome?.tokensUsed,
          promptTokens: okOutcome?.promptTokens,
          completionTokens: okOutcome?.completionTokens,
          parallel: true,
          errorMessage: !isOk ? (result.outcome as DomainAgentFailure).error : undefined,
          findingCount,
          avgConfidence,
        }),
      );
      outcomes.push(result.outcome);
    }

    // ── Graceful degradation: succeed with partial results ──
    const validOutputs = outcomes.filter(
      (o): o is DomainAgentResult => o.status === 'ok',
    );

    if (validOutputs.length === 0) {
      const errorMessage = 'All domain agents failed or timed out';
      const id = await this.reviewRunsRepository.create(
        {
          userId,
          repoFullName,
          prNumber,
          prTitle: prTitle ?? null,
          status: 'failed',
          trace,
          errorMessage,
        },
        userJwt,
      );
      return { id, status: 'failed', trace, error_message: errorMessage };
    }

    if (validOutputs.length < 4) {
      const failedNames = agentResults
        .filter((r) => r.outcome.status !== 'ok')
        .map((r) => r.name);
      this.logger.warn(
        `Partial analysis: ${failedNames.join(', ')} failed. Continuing with ${validOutputs.length} agents.`,
      );
    }

    // ── Stage 4: Deterministic aggregation (no LLM call) ──
    const agentOutputs: AgentOutput[] = validOutputs.map((o) => o.output);
    const aggregated = this.aggregator.aggregate(
      agentOutputs,
      parsedDiff.files,
    );

    // ── Stage 5: Format final result ──
    const resultSnapshot = this.resultFormatter.format({
      findings: aggregated.findings,
      reviewSummary: aggregated.review_summary,
      trace,
      prMetadata,
    });

    const status = validOutputs.length === 4 ? 'completed' : 'partial';

    const id = await this.reviewRunsRepository.create(
      {
        userId,
        repoFullName,
        prNumber,
        prTitle: prTitle ?? null,
        status,
        resultSnapshot,
        trace,
      },
      userJwt,
    );

    return {
      id,
      status,
      result_snapshot: resultSnapshot,
      trace,
    };
  }

  /** Promise.race-based timeout wrapper. */
  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
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
        risk_level: 'Low',
        merge_recommendation: 'Safe to merge',
        merge_explanation: 'No reviewable code changes detected. All changed files were filtered out (lock files, build artifacts, binary files, etc.).',
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
        status: 'completed',
        resultSnapshot: emptyResult,
        trace: [],
      },
      userJwt,
    );
    return { id, status: 'completed', result_snapshot: emptyResult, trace: [] };
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
      summary: 'Only documentation/markdown changes detected. No code review needed.',
      review_summary: {
        total_findings: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        risk_score: 0,
        risk_level: 'Low',
        merge_recommendation: 'Safe to merge',
        merge_explanation: 'Documentation-only changes — no code to review.',
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
        status: 'completed',
        resultSnapshot: result,
        trace: [],
      },
      userJwt,
    );
    return { id, status: 'completed', result_snapshot: result, trace: [] };
  }
}
