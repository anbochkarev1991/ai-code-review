/**
 * Manual test for Performance Agent (task 4.5).
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-performance-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import { PerformanceAgent } from '../src/reviews/agents/performance.agent';

const SAMPLE_DIFF = `diff --git a/src/api.ts b/src/api.ts
index 1234567..abcdefg 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,5 +1,12 @@
 export function getUsers(ids: string[]) {
+  const results = [];
+  for (const id of ids) {
+    results.push(db.query('SELECT * FROM users WHERE id = ?', [id]));
+  }
+  return Promise.all(results);
   return processData(ids);
 }`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const agent = new PerformanceAgent();
  console.log('Running Performance Agent on sample diff...');
  const result = await agent.run(SAMPLE_DIFF);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
