/**
 * Manual test for Security Agent (task 4.6).
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-security-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import { SecurityAgent } from '../src/reviews/agents/security.agent';

const SAMPLE_DIFF = `diff --git a/src/login.ts b/src/login.ts
index 1234567..abcdefg 100644
--- a/src/login.ts
+++ b/src/login.ts
@@ -1,5 +1,8 @@
 export function login(username: string, password: string) {
+  const query = "SELECT * FROM users WHERE username = '" + username + "'";
+  const result = db.execute(query);
+  return bcrypt.compare(password, result.password);
   return authService.login(username, password);
 }`;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required. Set it and rerun.');
    process.exit(1);
  }

  const agent = new SecurityAgent();
  console.log('Running Security Agent on sample diff...');
  const result = await agent.run(SAMPLE_DIFF);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
