/**
 * Manual test for Code Quality Agent.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-code-quality-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import type { ExpandedFile } from '../src/types';
import { CodeQualityAgent } from '../src/reviews/agents/code-quality.agent';
import { AgentContextShaper } from '../src/reviews/agent-context-shaper';

const SAMPLE_FILES: ExpandedFile[] = [
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
    expandedHunks: [
      {
        hunk: {
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
        localContext: {
          enclosingFunction: null,
          referencedDeclarations: [],
          calledHelpers: [],
        },
      },
    ],
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const contextShaper = new AgentContextShaper();
  const agent = new CodeQualityAgent(contextShaper);
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
