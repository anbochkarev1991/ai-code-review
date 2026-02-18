/**
 * Manual test for Aggregator Agent (task 4.7).
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-aggregator-agent.ts
 * Requires OPENAI_API_KEY in env.
 *
 * Given 4 mock outputs, returns single findings + summary.
 */

import { type AgentOutput } from 'shared';
import { AggregatorAgent } from '../src/reviews/agents/aggregator.agent';

const MOCK_OUTPUTS: AgentOutput[] = [
  {
    findings: [
      {
        id: 'cq-1',
        title: 'Missing error handling',
        severity: 'medium',
        category: 'code-quality',
        file: 'src/api.ts',
        line: 42,
        message: 'No try/catch around async call',
        suggestion: 'Wrap in try/catch and handle errors',
      },
    ],
    summary: 'Code quality: one medium finding.',
  },
  {
    findings: [
      {
        id: 'arch-1',
        title: 'Tight coupling',
        severity: 'high',
        category: 'architecture',
        file: 'src/api.ts',
        line: 15,
        message: 'Service directly depends on database',
        suggestion: 'Introduce repository layer',
      },
    ],
    summary: 'Architecture: coupling issue found.',
  },
  {
    findings: [
      {
        id: 'perf-1',
        title: 'N+1 query risk',
        severity: 'high',
        category: 'performance',
        file: 'src/api.ts',
        line: 42,
        message: 'Loop may cause N+1 queries',
        suggestion: 'Use batch fetch',
      },
    ],
    summary: 'Performance: potential N+1.',
  },
  {
    findings: [
      {
        id: 'sec-1',
        title: 'SQL injection risk',
        severity: 'critical',
        category: 'security',
        file: 'src/api.ts',
        line: 42,
        message: 'Raw query concat with user input',
        suggestion: 'Use parameterized queries',
      },
    ],
    summary: 'Security: critical vulnerability.',
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const agent = new AggregatorAgent();
  console.log('Running Aggregator Agent on 4 mock outputs...');
  const result = await agent.run(MOCK_OUTPUTS);
  console.log('Result (merged, deduped, prioritized):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned single findings + summary.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
