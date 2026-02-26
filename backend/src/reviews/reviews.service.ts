import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AgentOutput,
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
  status: 'failed';
}

type DomainAgentOutcome = DomainAgentResult | DomainAgentFailure;

/**
 * ReviewsService — pipeline orchestrator.
 *
 * Architecture (Part 6):
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
 * Scaling to 100 PR/min:
 * - Bottleneck: LLM latency (~2–10s per agent call). 4 agents × 2–10s ≈ 2–10s wall-clock (parallel).
 * - Solution: Queue PR review requests via BullMQ/SQS, run N worker processes.
 * - At 10s/review, 100 PR/min needs ~17 concurrent workers.
 * - Diff parsing and aggregation are CPU-bound and negligible (~1ms each).
 * - Cache LLM responses by diff content hash to skip re-reviews of unchanged PRs.
 * - Rate-limit OpenAI calls per-worker to stay within token quotas.
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

  /**
   * PR metadata fetcher: pulls diff from GitHub and delegates to runPipeline.
   */
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

    if (parsedDiff.files.length === 0) {
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
          text: 'No reviewable changes found. All changed files were filtered out (lock files, build artifacts, etc.).',
        },
        execution_metadata: {
          agent_count: 0,
          duration_ms: 0,
          total_tokens: 0,
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

    this.logger.log(
      `Reviewing ${parsedDiff.stats.filesChanged} files, ${parsedDiff.stats.totalChangedLines} changed lines`,
    );

    const files = parsedDiff.files;

    // ── Stage 2: Agent orchestration (parallel execution) ──
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
        const result: CallWithValidationRetryResult = await run();
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
        return {
          name,
          startedAt,
          finishedAt,
          outcome: { error: errorMessage, status: 'failed' as const },
        };
      }
    });

    let agentResults;
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
          status: result.outcome.status,
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

      if (result.outcome.status === 'failed') {
        const id = await this.reviewRunsRepository.create(
          {
            userId,
            repoFullName,
            prNumber,
            prTitle: prTitle ?? null,
            status: 'failed',
            trace,
            errorMessage: result.outcome.error,
          },
          userJwt,
        );
        return {
          id,
          status: 'failed',
          trace,
          error_message: result.outcome.error,
        };
      }
    }

    const validOutputs = outcomes.filter(
      (o): o is DomainAgentResult => o.status === 'ok',
    );
    if (validOutputs.length !== 4) {
      const errorMessage = 'One or more domain agents failed';
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

    // ── Stage 4: Deterministic aggregation (no LLM call) ──
    const agentOutputs: AgentOutput[] = validOutputs.map((o) => o.output);
    const aggregated = this.aggregator.aggregate(agentOutputs);

    // ── Stage 5: Format final result ──
    const resultSnapshot = this.resultFormatter.format({
      findings: aggregated.findings,
      reviewSummary: aggregated.review_summary,
      trace,
      prMetadata,
    });

    const id = await this.reviewRunsRepository.create(
      {
        userId,
        repoFullName,
        prNumber,
        prTitle: prTitle ?? null,
        status: 'completed',
        resultSnapshot,
        trace,
      },
      userJwt,
    );

    return {
      id,
      status: 'completed',
      result_snapshot: resultSnapshot,
      trace,
    };
  }
}
