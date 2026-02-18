import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  AgentOutput,
  GetReviewResponse,
  PostReviewsResponse,
  ReviewResult,
  TraceStep,
} from 'shared';
import { AggregatorAgent } from './agents/aggregator.agent';
import { ArchitectureAgent } from './agents/architecture.agent';
import { CodeQualityAgent } from './agents/code-quality.agent';
import { PerformanceAgent } from './agents/performance.agent';
import { SecurityAgent } from './agents/security.agent';
import { GitHubService } from '../github/github.service';
import { ReviewRunsRepository } from './review-runs.repository';
import { buildTraceStep, TRACE_AGENT_NAMES } from './trace.utils';

export interface RunPipelineParams {
  userId: string;
  userJwt: string;
  repoFullName: string;
  prNumber: number;
  prTitle?: string | null;
  prDiff: string;
}

interface DomainAgentResult {
  output: AgentOutput;
  status: 'ok';
}

interface DomainAgentFailure {
  error: string;
  status: 'failed';
}

type DomainAgentOutcome = DomainAgentResult | DomainAgentFailure;

/** Thrown when the review pipeline exceeds the timeout (e.g. 60s). */
export class ReviewTimeoutError extends Error {
  constructor() {
    super('Request timeout (60s)');
    this.name = 'ReviewTimeoutError';
  }
}

const REVIEW_TIMEOUT_MS = 60_000;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly codeQualityAgent: CodeQualityAgent,
    private readonly architectureAgent: ArchitectureAgent,
    private readonly performanceAgent: PerformanceAgent,
    private readonly securityAgent: SecurityAgent,
    private readonly aggregatorAgent: AggregatorAgent,
    private readonly reviewRunsRepository: ReviewRunsRepository,
    private readonly githubService: GitHubService,
  ) {}

  /**
   * Fetches one review run by id. Returns null if not found or not owned by user.
   */
  async findOne(id: string, userJwt: string): Promise<GetReviewResponse | null> {
    return this.reviewRunsRepository.findById(id, userJwt);
  }

  /**
   * Runs the full review pipeline: fetches PR diff, runs 4 domain agents,
   * then Aggregator, builds trace, and saves to review_runs.
   * Times out after REVIEW_TIMEOUT_MS (60s); on timeout saves failed run and returns.
   */
  async runReview(
    userId: string,
    userJwt: string,
    repoFullName: string,
    prNumber: number,
  ): Promise<PostReviewsResponse> {
    const work = this.runReviewWork(userId, userJwt, repoFullName, prNumber);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new ReviewTimeoutError()), REVIEW_TIMEOUT_MS);
    });

    try {
      return await Promise.race([work, timeoutPromise]);
    } catch (err) {
      if (err instanceof ReviewTimeoutError) {
        const id = await this.reviewRunsRepository.create(
          {
            userId,
            repoFullName,
            prNumber,
            prTitle: null,
            status: 'failed',
            trace: [],
            errorMessage: err.message,
          },
          userJwt,
        );
        return {
          id,
          status: 'failed',
          trace: [],
          error_message: err.message,
        };
      }
      throw err;
    }
  }

  private async runReviewWork(
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
      prDiff: diffResponse.diff,
    });
  }

  /**
   * Runs the review pipeline: Code, Arch, Perf, Sec (parallel), then Aggregator.
   * Builds trace and saves result_snapshot + trace to review_runs.
   */
  async runPipeline(params: RunPipelineParams): Promise<PostReviewsResponse> {
    const { userId, userJwt, repoFullName, prNumber, prTitle, prDiff } = params;
    const trace: TraceStep[] = [];

    const domainAgents = [
      { name: TRACE_AGENT_NAMES[0], run: () => this.codeQualityAgent.run(prDiff) },
      { name: TRACE_AGENT_NAMES[1], run: () => this.architectureAgent.run(prDiff) },
      { name: TRACE_AGENT_NAMES[2], run: () => this.performanceAgent.run(prDiff) },
      { name: TRACE_AGENT_NAMES[3], run: () => this.securityAgent.run(prDiff) },
    ] as const;

    const outcomes: DomainAgentOutcome[] = [];
    for (const { name, run } of domainAgents) {
      const startedAt = new Date();
      try {
        const output = await run();
        trace.push(buildTraceStep({ agent: name, startedAt, finishedAt: new Date(), status: 'ok' }));
        outcomes.push({ output, status: 'ok' });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        trace.push(buildTraceStep({ agent: name, startedAt, finishedAt: new Date(), status: 'failed' }));
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

    const agentOutputs: AgentOutput[] = validOutputs.map((o) => o.output);
    const aggregatorName = TRACE_AGENT_NAMES[4];
    const aggregatorStartedAt = new Date();
    let aggregatorOutput: AgentOutput;
    try {
      aggregatorOutput = await this.aggregatorAgent.run(agentOutputs);
      trace.push(buildTraceStep({
        agent: aggregatorName,
        startedAt: aggregatorStartedAt,
        finishedAt: new Date(),
        status: 'ok',
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      trace.push(buildTraceStep({
        agent: aggregatorName,
        startedAt: aggregatorStartedAt,
        finishedAt: new Date(),
        status: 'failed',
      }));
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

    const resultSnapshot: ReviewResult = {
      findings: aggregatorOutput.findings,
      summary: aggregatorOutput.summary,
    };

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
