// TODO: Remove this file once correct OpenAI API key is configured
// This file contains mock responses for testing purposes to work around 429 errors

import type { AgentOutput } from 'shared';

/**
 * Mock responses for OpenAI agents.
 * Used when USE_MOCK_OPENAI_RESPONSES=true or when reviewing demo PR.
 * TODO: Remove all mock data once correct OpenAI API key is configured
 */

export const MOCK_CODE_QUALITY_RESPONSE: AgentOutput = {
  findings: [
    {
      id: 'cq-1',
      title: 'Missing error handling',
      severity: 'medium',
      category: 'code-quality',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 185,
      message: 'The run() method does not handle potential errors from domain agents gracefully.',
      suggestion: 'Add try-catch blocks around agent calls and provide meaningful error messages.',
    },
    {
      id: 'cq-2',
      title: 'Inconsistent naming convention',
      severity: 'low',
      category: 'code-quality',
      file: 'backend/src/reviews/agents/aggregator.agent.ts',
      line: 39,
      message: 'Variable name "agentOutputs" could be more descriptive.',
      suggestion: 'Consider renaming to "domainAgentOutputs" for clarity.',
    },
    {
      id: 'cq-3',
      title: 'Missing JSDoc comment',
      severity: 'low',
      category: 'code-quality',
      file: 'backend/src/reviews/agents/code-quality.agent.ts',
      line: 30,
      message: 'The run() method lacks detailed JSDoc documentation.',
      suggestion: 'Add comprehensive JSDoc comments explaining parameters and return value.',
    },
  ],
  summary: 'Found 3 code quality issues: 1 medium severity (missing error handling) and 2 low severity (naming and documentation). Overall code quality is good with minor improvements needed.',
};

export const MOCK_ARCHITECTURE_RESPONSE: AgentOutput = {
  findings: [
    {
      id: 'arch-1',
      title: 'Tight coupling between agents and service',
      severity: 'high',
      category: 'architecture',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 174,
      message: 'Domain agents are directly instantiated in ReviewsService, creating tight coupling.',
      suggestion: 'Consider using dependency injection more effectively or introducing an agent factory pattern.',
    },
    {
      id: 'arch-2',
      title: 'Missing abstraction layer',
      severity: 'medium',
      category: 'architecture',
      file: 'backend/src/reviews/agents/aggregator.agent.ts',
      line: 39,
      message: 'Aggregator directly depends on concrete AgentOutput type without interface abstraction.',
      suggestion: 'Introduce an IAgentOutput interface to improve testability and flexibility.',
    },
    {
      id: 'arch-3',
      title: 'Sequential agent execution',
      severity: 'low',
      category: 'architecture',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 182,
      message: 'Domain agents are executed sequentially, which could be parallelized for better performance.',
      suggestion: 'Consider using Promise.all() to run domain agents in parallel.',
    },
  ],
  summary: 'Found 3 architecture concerns: 1 high severity (tight coupling), 1 medium (missing abstraction), and 1 low (sequential execution). The overall architecture is sound but could benefit from improved decoupling and parallelization.',
};

export const MOCK_PERFORMANCE_RESPONSE: AgentOutput = {
  findings: [
    {
      id: 'perf-1',
      title: 'Sequential agent execution impacts latency',
      severity: 'high',
      category: 'performance',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 182,
      message: 'Domain agents run sequentially in a loop, causing total latency to be sum of all agent latencies.',
      suggestion: 'Use Promise.all() to execute all domain agents in parallel, reducing total latency significantly.',
    },
    {
      id: 'perf-2',
      title: 'No request timeout handling',
      severity: 'medium',
      category: 'performance',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 90,
      message: 'While there is a timeout at the service level, individual agent calls have no timeout protection.',
      suggestion: 'Add timeout to individual OpenAI API calls to prevent hanging requests.',
    },
    {
      id: 'perf-3',
      title: 'Potential memory leak in trace storage',
      severity: 'low',
      category: 'performance',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 172,
      message: 'Trace array accumulates all steps without size limits, could grow large for long-running reviews.',
      suggestion: 'Consider truncating or limiting trace size for very long reviews.',
    },
  ],
  summary: 'Found 3 performance issues: 1 high severity (sequential execution), 1 medium (missing timeouts), and 1 low (potential memory concerns). The most critical issue is sequential agent execution which significantly impacts response time.',
};

export const MOCK_SECURITY_RESPONSE: AgentOutput = {
  findings: [
    {
      id: 'sec-1',
      title: 'API key exposed in error messages',
      severity: 'critical',
      category: 'security',
      file: 'backend/src/reviews/agents/agent-validation.utils.ts',
      line: 71,
      message: 'Error messages may expose sensitive information about API keys or internal structure.',
      suggestion: 'Sanitize error messages to avoid leaking sensitive information in production.',
    },
    {
      id: 'sec-2',
      title: 'No rate limiting on OpenAI calls',
      severity: 'high',
      category: 'security',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 185,
      message: 'No rate limiting mechanism prevents abuse of OpenAI API calls.',
      suggestion: 'Implement rate limiting per user to prevent API abuse and cost overruns.',
    },
    {
      id: 'sec-3',
      title: 'PR diff content not sanitized',
      severity: 'medium',
      category: 'security',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 162,
      message: 'PR diff content is passed directly to OpenAI without sanitization, could contain sensitive data.',
      suggestion: 'Sanitize PR diff content to remove potential secrets or sensitive information before sending to OpenAI.',
    },
  ],
  summary: 'Found 3 security issues: 1 critical (error message exposure), 1 high (missing rate limiting), and 1 medium (unsanitized content). Critical security concerns need immediate attention before production deployment.',
};

export const MOCK_AGGREGATOR_RESPONSE: AgentOutput = {
  findings: [
    {
      id: 'agg-1',
      title: 'Sequential agent execution impacts latency',
      severity: 'high',
      category: 'performance',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 182,
      message: 'Domain agents run sequentially in a loop, causing total latency to be sum of all agent latencies.',
      suggestion: 'Use Promise.all() to execute all domain agents in parallel, reducing total latency significantly.',
    },
    {
      id: 'agg-2',
      title: 'Tight coupling between agents and service',
      severity: 'high',
      category: 'architecture',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 174,
      message: 'Domain agents are directly instantiated in ReviewsService, creating tight coupling.',
      suggestion: 'Consider using dependency injection more effectively or introducing an agent factory pattern.',
    },
    {
      id: 'agg-3',
      title: 'API key exposed in error messages',
      severity: 'critical',
      category: 'security',
      file: 'backend/src/reviews/agents/agent-validation.utils.ts',
      line: 71,
      message: 'Error messages may expose sensitive information about API keys or internal structure.',
      suggestion: 'Sanitize error messages to avoid leaking sensitive information in production.',
    },
    {
      id: 'agg-4',
      title: 'No rate limiting on OpenAI calls',
      severity: 'high',
      category: 'security',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 185,
      message: 'No rate limiting mechanism prevents abuse of OpenAI API calls.',
      suggestion: 'Implement rate limiting per user to prevent API abuse and cost overruns.',
    },
    {
      id: 'agg-5',
      title: 'Missing error handling',
      severity: 'medium',
      category: 'code-quality',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 185,
      message: 'The run() method does not handle potential errors from domain agents gracefully.',
      suggestion: 'Add try-catch blocks around agent calls and provide meaningful error messages.',
    },
    {
      id: 'agg-6',
      title: 'PR diff content not sanitized',
      severity: 'medium',
      category: 'security',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 162,
      message: 'PR diff content is passed directly to OpenAI without sanitization, could contain sensitive data.',
      suggestion: 'Sanitize PR diff content to remove potential secrets or sensitive information before sending to OpenAI.',
    },
    {
      id: 'agg-7',
      title: 'No request timeout handling',
      severity: 'medium',
      category: 'performance',
      file: 'backend/src/reviews/reviews.service.ts',
      line: 90,
      message: 'While there is a timeout at the service level, individual agent calls have no timeout protection.',
      suggestion: 'Add timeout to individual OpenAI API calls to prevent hanging requests.',
    },
  ],
  summary: 'Merged findings from 4 domain agents: 1 critical security issue (error message exposure), 3 high severity issues (sequential execution, tight coupling, missing rate limiting), and 3 medium severity issues (error handling, content sanitization, timeout handling). Critical security concerns require immediate attention. Performance can be significantly improved by parallelizing agent execution.',
};

/**
 * Checks if mock responses should be used.
 * TODO: Remove this function once correct OpenAI API key is configured
 */
export function shouldUseMockResponses(repoFullName?: string, prNumber?: number): boolean {
  // Enable mocking if environment variable is set
  if (process.env.USE_MOCK_OPENAI_RESPONSES === 'true') {
    return true;
  }

  // Enable mocking for demo PR (this project's PR #1)
  // TODO: Remove this demo PR check once correct OpenAI API key is configured
  const demoRepo = 'anbochkarev1991/ai-code-review'; // This project's repo
  const demoPrNumber = 1;
  if (repoFullName === demoRepo && prNumber === demoPrNumber) {
    return true;
  }

  return false;
}
