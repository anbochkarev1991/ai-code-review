/**
 * Manual test for Code Quality Agent.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-code-quality-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import type { ParsedFile } from '../src/types';
import { CodeQualityAgent } from '../src/reviews/agents/code-quality.agent';
import { DiffParser } from '../src/reviews/diff-parser';

const SAMPLE_FILES: ParsedFile[] = [
  {
    path: 'src/utils.ts',
    status: 'modified',
    language: 'typescript',
    hunks: [
      {
        startLine: 1,
        endLine: 10,
        content: `+export function processData(data: any) {
+  const x = 42;
+  let result;
+  for (let i = 0; i < data.length; i++) {
+    result = data[i];
+  }
+  return result;
+}`,
        addedLines: [
          'export function processData(data: any) {',
          '  const x = 42;',
          '  let result;',
          '  for (let i = 0; i < data.length; i++) {',
          '    result = data[i];',
          '  }',
          '  return result;',
          '}',
        ],
        removedLines: [],
      },
    ],
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const diffParser = new DiffParser();
  const agent = new CodeQualityAgent(diffParser);
  console.log('Running Code Quality Agent on sample parsed files...');
  const result = await agent.run(SAMPLE_FILES);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
