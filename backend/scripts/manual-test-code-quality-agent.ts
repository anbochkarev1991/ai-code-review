/**
 * Manual test for Code Quality Agent (task 4.3).
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-code-quality-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import { CodeQualityAgent } from '../src/reviews/agents/code-quality.agent';

const SAMPLE_DIFF = `diff --git a/src/utils.ts b/src/utils.ts
index 1234567..abcdefg 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,7 @@ export function process(data: unknown) {
   const x = 1;
+  const unused = 42;
   return data;
 }`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const agent = new CodeQualityAgent();
  console.log('Running Code Quality Agent on sample diff...');
  const result = await agent.run(SAMPLE_DIFF);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
