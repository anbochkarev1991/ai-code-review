import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AgentOutput,
  ExecutionMetadata,
  GetReviewResponse,
  GetReviewsResponse,
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

/**
 * Max diff characters sent to each agent. gpt-4o-mini handles ~128K tokens,
 * but large prompts cause 30-40s responses. 15K chars ≈ 4K tokens keeps
 * individual calls under 15s, leaving room for retries + aggregator.
 */
const MAX_DIFF_CHARS = 15_000;

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return diff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff truncated for review — showing first 15,000 characters)';
}

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
   * Lists review runs for the current user with pagination.
   */
  async findAll(
    limit: number,
    offset: number,
    userJwt: string,
  ): Promise<GetReviewsResponse> {
    return this.reviewRunsRepository.findAll(limit, offset, userJwt);
  }

  /**
   * Runs the full review pipeline: fetches PR diff, runs 4 domain agents,
   * then Aggregator, builds trace, and saves to review_runs.
   * No server-side timeout — let the work complete. The frontend can abort if the user navigates away.
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
      prDiff: diffResponse.diff,
    });
  }

  /**
   * Calculates execution metadata from trace: agent count, total duration, and total tokens.
   */
  private calculateExecutionMetadata(trace: TraceStep[]): ExecutionMetadata {
    const successfulAgents = trace.filter((step) => step.status === 'ok');
    const agentCount = successfulAgents.length;
    
    // Calculate total duration from first step start to last step finish
    if (trace.length === 0) {
      return { agent_count: 0, duration_ms: 0, total_tokens: 0 };
    }
    
    const firstStart = new Date(trace[0].started_at);
    const lastFinish = new Date(
      Math.max(...trace.map((step) => new Date(step.finished_at).getTime()))
    );
    const durationMs = lastFinish.getTime() - firstStart.getTime();
    
    // Sum tokens from all successful steps
    const totalTokens = trace
      .filter((step) => step.status === 'ok' && step.tokens_used !== undefined)
      .reduce((sum, step) => sum + (step.tokens_used ?? 0), 0);
    
    return {
      agent_count: agentCount,
      duration_ms: durationMs,
      total_tokens: totalTokens,
    };
  }

  /**
   * Runs the review pipeline: Code, Arch, Perf, Sec (parallel), then Aggregator.
   * Builds trace and saves result_snapshot + trace to review_runs.
   */
  async runPipeline(params: RunPipelineParams): Promise<PostReviewsResponse> {
    const { userId, userJwt, repoFullName, prNumber, prTitle, prDiff } = params;
    const pipelineStartTime = new Date();
    const trace: TraceStep[] = [];

    const agentDiff = truncateDiff(prDiff);

    // TODO: Remove repoFullName and prNumber parameters from agent.run() calls once correct OpenAI API key is configured
    const domainAgents = [
      { name: TRACE_AGENT_NAMES[0], run: () => this.codeQualityAgent.run(agentDiff, repoFullName, prNumber) },
      { name: TRACE_AGENT_NAMES[1], run: () => this.architectureAgent.run(agentDiff, repoFullName, prNumber) },
      { name: TRACE_AGENT_NAMES[2], run: () => this.performanceAgent.run(agentDiff, repoFullName, prNumber) },
      { name: TRACE_AGENT_NAMES[3], run: () => this.securityAgent.run(agentDiff, repoFullName, prNumber) },
    ] as const;

    // Run all domain agents in parallel for better performance
    const agentPromises = domainAgents.map(async ({ name, run }) => {
      const startedAt = new Date();
      try {
        const output = await run();
        const finishedAt = new Date();
        return {
          name,
          startedAt,
          finishedAt,
          outcome: { output, status: 'ok' as const },
        };
      } catch (err) {
        // If it's an HttpException (e.g., OpenAI quota error), propagate it immediately
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
      // If any agent threw an HttpException, propagate it immediately
      if (err instanceof HttpException) {
        throw err;
      }
      // Re-throw unexpected errors
      throw err;
    }
    
    // Build trace and outcomes from parallel results
    const outcomes: DomainAgentOutcome[] = [];
    for (const result of agentResults) {
      trace.push(buildTraceStep({
        agent: result.name,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        status: result.outcome.status,
      }));
      outcomes.push(result.outcome);
      
      // If any agent failed, save and return early
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
        return { id, status: 'failed', trace, error_message: result.outcome.error };
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
      // TODO: Remove repoFullName and prNumber parameters from aggregator.run() call once correct OpenAI API key is configured
      aggregatorOutput = await this.aggregatorAgent.run(agentOutputs, repoFullName, prNumber);
      trace.push(buildTraceStep({
        agent: aggregatorName,
        startedAt: aggregatorStartedAt,
        finishedAt: new Date(),
        status: 'ok',
      }));
    } catch (err) {
      // If it's an HttpException (e.g., OpenAI quota error), propagate it immediately
      if (err instanceof HttpException) {
        throw err;
      }
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

    const executionMetadata = this.calculateExecutionMetadata(trace);
    
    const resultSnapshot: ReviewResult = {
      findings: aggregatorOutput.findings,
      summary: aggregatorOutput.summary,
      execution_metadata: executionMetadata,
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
