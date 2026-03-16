/**
 * Manual test for Deterministic Aggregator (replaces LLM-based AggregatorAgent).
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-aggregator-agent.ts
 * No OPENAI_API_KEY needed — aggregation is deterministic; LLM dedup skips when unset.
 */

import { type AgentOutput } from 'shared';
import { DeterministicAggregator } from '../src/reviews/deterministic-aggregator';
import { FindingDeduplicatorService } from '../src/reviews/finding-deduplicator.service';
import { FindingNormalizer } from '../src/reviews/finding-normalizer';
import { RiskEngine } from '../src/reviews/risk-engine';

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
        suggested_fix: 'Wrap in try/catch and handle errors',
        confidence: 0.85,
        impact: 'Unhandled promise rejection could crash the process.',
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
        suggested_fix: 'Introduce repository layer',
        confidence: 0.9,
        impact: 'Direct database dependency prevents independent testing and deployment.',
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
        suggested_fix: 'Use batch fetch',
        confidence: 0.8,
        impact: 'Could cause N+1 queries resulting in degraded performance under load.',
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
        suggested_fix: 'Use parameterized queries',
        confidence: 0.95,
        impact: 'May allow remote SQL injection leading to full database compromise.',
      },
    ],
    summary: 'Security: critical vulnerability.',
  },
];

async function main() {
  const riskEngine = new RiskEngine();
  const findingNormalizer = new FindingNormalizer();
  const findingDeduplicator = new FindingDeduplicatorService();
  const aggregator = new DeterministicAggregator(
    riskEngine,
    findingNormalizer,
    findingDeduplicator,
  );

  console.log('Running Deterministic Aggregator on 4 mock outputs...');
  const result = await aggregator.aggregate(MOCK_OUTPUTS);
  console.log('Findings (merged, deduped, sorted):');
  console.log(JSON.stringify(result.findings, null, 2));
  console.log('\nReview Summary:');
  console.log(JSON.stringify(result.review_summary, null, 2));
  console.log('\nManual test passed: deterministic aggregation complete.');
}

main();
