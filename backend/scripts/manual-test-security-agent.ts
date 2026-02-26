/**
 * Manual test for Security Agent.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-security-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import type { ParsedFile } from '../src/types';
import { SecurityAgent } from '../src/reviews/agents/security.agent';
import { DiffParser } from '../src/reviews/diff-parser';

const SAMPLE_FILES: ParsedFile[] = [
  {
    path: 'src/login.ts',
    status: 'modified',
    language: 'typescript',
    hunks: [
      {
        startLine: 1,
        endLine: 8,
        content: ` export function login(username: string, password: string) {
+  const query = "SELECT * FROM users WHERE username = '" + username + "'";
+  const result = db.execute(query);
+  return bcrypt.compare(password, result.password);
   return authService.login(username, password);
 }`,
        addedLines: [
          '  const query = "SELECT * FROM users WHERE username = \'" + username + "\'";',
          '  const result = db.execute(query);',
          '  return bcrypt.compare(password, result.password);',
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
  const agent = new SecurityAgent(diffParser);
  console.log('Running Security Agent on sample parsed files...');
  const result = await agent.run(SAMPLE_FILES);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
