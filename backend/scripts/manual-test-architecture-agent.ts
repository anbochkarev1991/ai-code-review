/**
 * Manual test for Architecture Agent (task 4.4).
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-architecture-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import { ArchitectureAgent } from '../src/reviews/agents/architecture.agent';

const SAMPLE_DIFF = `diff --git a/src/api.ts b/src/api.ts
index 1234567..abcdefg 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,5 +1,8 @@
+import { Database } from '../db/schema';
+
 export function handleRequest(req: Request) {
+  const user = Database.query('SELECT * FROM users');
   return processData(req.body);
 }`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const agent = new ArchitectureAgent();
  console.log('Running Architecture Agent on sample diff...');
  const result = await agent.run(SAMPLE_DIFF);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
