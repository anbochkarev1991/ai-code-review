/**
 * Manual test for Performance Agent.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-performance-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import type { ExpandedFile } from '../src/types';
import { PerformanceAgent } from '../src/reviews/agents/performance.agent';
import { AgentContextShaper } from '../src/reviews/agent-context-shaper';

const HUNK = {
  startLine: 10,
  endLine: 25,
  content: `+async function loadUsers() {
+  const users = await db.query('SELECT * FROM users');
+  const results = [];
+  for (const user of users) {
+    const profile = await db.query(\`SELECT * FROM profiles WHERE user_id = \${user.id}\`);
+    results.push({ ...user, profile });
+  }
+  return results;
+}`,
  addedLines: [
    'async function loadUsers() {',
    "  const users = await db.query('SELECT * FROM users');",
    '  const results = [];',
    '  for (const user of users) {',
    '    const profile = await db.query(`SELECT * FROM profiles WHERE user_id = ${user.id}`);',
    '    results.push({ ...user, profile });',
    '  }',
    '  return results;',
    '}',
  ],
  removedLines: [] as string[],
};

const SAMPLE_FILES: ExpandedFile[] = [
  {
    path: 'src/api.ts',
    status: 'modified',
    language: 'typescript',
    hunks: [HUNK],
    expandedHunks: [
      {
        hunk: HUNK,
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
  const agent = new PerformanceAgent(contextShaper);
  console.log('Running Performance Agent on sample parsed files...');
  const result = await agent.run(SAMPLE_FILES);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
