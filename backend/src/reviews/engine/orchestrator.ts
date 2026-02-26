import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type {
  AgentOutput,
  AgentResult,
  Finding,
  PerformanceSummary,
  PRMetadata,
  ReviewEngineOptions,
  ReviewResult,
  ReviewSignature,
  ReviewStatus,
  TraceStep,
} from 'shared';
import { ENGINE_VERSION, AGENT_VERSIONS } from 'shared';
import type { ParsedFile } from '../../types';
import type { CallWithValidationRetryResult } from '../agents/agent-validation.utils';
import { ArchitectureAgent } from '../agents/architecture.agent';
import { CodeQualityAgent } from '../agents/code-quality.agent';
import { PerformanceAgent } from '../agents/performance.agent';
import { SecurityAgent } from '../agents/security.agent';
import { DeterministicAggregator } from '../deterministic-aggregator';
import { ResultFormatter } from '../result-formatter';
import { buildTraceStep, TRACE_AGENT_NAMES } from '../trace.utils';

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_000;

interface AgentDefinition {
  name: string;
  run: () => Promise<CallWithValidationRetryResult>;
}

export interface EngineRunResult {
  status: ReviewStatus;
  result?: ReviewResult;
  trace: TraceStep[];
  error_message?: string;
}

/**
 * Review engine orchestrator — runs agents with resilience guarantees.
 *
 * - Promise.allSettled for agent execution (never blocks on one failure)
 * - Per-agent timeout with configurable override
 * - Single retry on transient failure per agent
 * - Deterministic review hash for reproducibility
 * - Performance summary for transparency
 */
@Injectable()
export class ReviewOrchestrator {
  private readonly logger = new Logger(ReviewOrchestrator.name);

  constructor(
    private readonly codeQualityAgent: CodeQualityAgent,
    private readonly architectureAgent: ArchitectureAgent,
    private readonly performanceAgent: PerformanceAgent,
    private readonly securityAgent: SecurityAgent,
    private readonly aggregator: DeterministicAggregator,
    private readonly resultFormatter: ResultFormatter,
  ) {}

  async runReview(
    files: ParsedFile[],
    prMetadata: PRMetadata,
    diff: string,
    options: ReviewEngineOptions = {},
  ): Promise<EngineRunResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pipelineStart = Date.now();

    const allAgents: AgentDefinition[] = [
      { name: TRACE_AGENT_NAMES[0], run: () => this.codeQualityAgent.run(files) },
      { name: TRACE_AGENT_NAMES[1], run: () => this.architectureAgent.run(files) },
      { name: TRACE_AGENT_NAMES[2], run: () => this.performanceAgent.run(files) },
      { name: TRACE_AGENT_NAMES[3], run: () => this.securityAgent.run(files) },
    ];

    const agents = options.maxAgents
      ? allAgents.slice(0, options.maxAgents)
      : allAgents;

    const agentResults = await this.runAgentsWithResilience(agents, timeoutMs);

    const trace = agentResults.map((r) => this.buildTrace(r));

    const validOutputs = agentResults
      .filter((r): r is AgentResult & { output: AgentOutput } => r.status === 'ok' && !!r.output);

    if (validOutputs.length === 0) {
      return {
        status: 'failed',
        trace,
        error_message: 'All analysis agents failed or timed out.',
      };
    }

    if (validOutputs.length < agents.length) {
      const failedNames = agentResults
        .filter((r) => r.status !== 'ok')
        .map((r) => r.agent_name);
      this.logger.warn(
        `Partial analysis: ${failedNames.join(', ')} failed. Continuing with ${validOutputs.length}/${agents.length} agents.`,
      );
    }

    const agentOutputs: AgentOutput[] = validOutputs.map((r) => r.output);
    const aggregated = this.aggregator.aggregate(
      agentOutputs,
      files,
      options.strictMode,
    );

    const pipelineEnd = Date.now();
    const totalDurationMs = pipelineEnd - pipelineStart;

    const performance = this.buildPerformanceSummary(agentResults, totalDurationMs);
    const signature = this.computeSignature(diff);

    const result = this.resultFormatter.format({
      findings: aggregated.findings,
      reviewSummary: aggregated.review_summary,
      trace,
      prMetadata,
    });

    result.signature = signature;
    result.performance = performance;

    const status: ReviewStatus = validOutputs.length === agents.length ? 'complete' : 'partial';

    return { status, result, trace };
  }

  private async runAgentsWithResilience(
    agents: AgentDefinition[],
    timeoutMs: number,
  ): Promise<AgentResult[]> {
    const promises = agents.map((agent) =>
      this.runSingleAgent(agent, timeoutMs),
    );

    const settled = await Promise.allSettled(promises);

    return settled.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        agent_name: agents[i].name,
        status: 'error' as const,
        duration_ms: 0,
        error_message: result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
        retried: false,
      };
    });
  }

  private async runSingleAgent(
    agent: AgentDefinition,
    timeoutMs: number,
  ): Promise<AgentResult> {
    const start = Date.now();

    try {
      const result = await this.withTimeout(agent.run(), timeoutMs, agent.name);
      return {
        agent_name: agent.name,
        status: 'ok',
        output: result.output,
        tokens_used: result.tokensUsed,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        duration_ms: Date.now() - start,
        retried: false,
      };
    } catch (firstError) {
      if (this.isNonRetryable(firstError)) {
        throw firstError;
      }

      this.logger.warn(
        `${agent.name} failed, retrying once: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
      );

      await this.delay(RETRY_DELAY_MS);
      const retryStart = Date.now();

      try {
        const result = await this.withTimeout(agent.run(), timeoutMs, agent.name);
        return {
          agent_name: agent.name,
          status: 'ok',
          output: result.output,
          tokens_used: result.tokensUsed,
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          duration_ms: Date.now() - retryStart,
          retried: true,
        };
      } catch (retryError) {
        const errorMessage = retryError instanceof Error ? retryError.message : String(retryError);
        const isTimeout = errorMessage.includes('timed out');
        return {
          agent_name: agent.name,
          status: isTimeout ? 'timeout' : 'error',
          duration_ms: Date.now() - start,
          error_message: errorMessage,
          retried: true,
        };
      }
    }
  }

  private isNonRetryable(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status === 401 || status === 402 || status === 429;
    }
    return false;
  }

  private buildTrace(agentResult: AgentResult): TraceStep {
    return buildTraceStep({
      agent: agentResult.agent_name,
      startedAt: new Date(Date.now() - agentResult.duration_ms),
      finishedAt: new Date(),
      status: agentResult.status,
      tokensUsed: agentResult.tokens_used,
      promptTokens: agentResult.prompt_tokens,
      completionTokens: agentResult.completion_tokens,
      parallel: true,
      errorMessage: agentResult.error_message,
      findingCount: agentResult.output?.findings.length,
      avgConfidence: agentResult.output?.findings.length
        ? agentResult.output.findings.reduce(
            (sum, f) => sum + (f.confidence ?? 0.5),
            0,
          ) / agentResult.output.findings.length
        : undefined,
    });
  }

  private buildPerformanceSummary(
    results: AgentResult[],
    totalDurationMs: number,
  ): PerformanceSummary {
    const perAgent: Record<string, number> = {};
    let totalLatency = 0;
    let agentCount = 0;

    for (const r of results) {
      perAgent[r.agent_name] = r.duration_ms;
      totalLatency += r.duration_ms;
      agentCount++;
    }

    return {
      total_duration_ms: totalDurationMs,
      agents_parallel: agentCount,
      avg_agent_latency_ms: agentCount > 0
        ? Math.round(totalLatency / agentCount)
        : 0,
      per_agent_latency: perAgent,
    };
  }

  computeSignature(diff: string): ReviewSignature {
    const hashInput = JSON.stringify({
      diff,
      agent_versions: AGENT_VERSIONS,
      engine_version: ENGINE_VERSION,
    });

    const reviewHash = createHash('sha256')
      .update(hashInput)
      .digest('hex');

    return {
      review_hash: reviewHash,
      engine_version: ENGINE_VERSION,
      agent_versions: { ...AGENT_VERSIONS },
    };
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    agentName: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${agentName} agent timed out after ${ms}ms`)),
        ms,
      );
      promise
        .then((val) => { clearTimeout(timer); resolve(val); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
