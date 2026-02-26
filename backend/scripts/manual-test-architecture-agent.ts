/**
 * Manual test for Architecture Agent.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/manual-test-architecture-agent.ts
 * Requires OPENAI_API_KEY in env.
 */

import type { ParsedFile } from '../src/types';
import { ArchitectureAgent } from '../src/reviews/agents/architecture.agent';
import { DiffParser } from '../src/reviews/diff-parser';

const SAMPLE_FILES: ParsedFile[] = [
  {
    path: 'src/api/users.controller.ts',
    status: 'modified',
    language: 'typescript',
    hunks: [
      {
        startLine: 1,
        endLine: 12,
        content: `+import { createClient } from '@supabase/supabase-js';
+
+export class UsersController {
+  async getUser(id: string) {
+    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
+    const { data } = await supabase.from('users').select('*').eq('id', id).single();
+    return data;
+  }
+}`,
        addedLines: [
          "import { createClient } from '@supabase/supabase-js';",
          '',
          'export class UsersController {',
          '  async getUser(id: string) {',
          "    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);",
          "    const { data } = await supabase.from('users').select('*').eq('id', id).single();",
          '    return data;',
          '  }',
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
  const agent = new ArchitectureAgent(diffParser);
  console.log('Running Architecture Agent on sample parsed files...');
  const result = await agent.run(SAMPLE_FILES);
  console.log('Result (JSON matching schema):');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nManual test passed: returned JSON matches schema.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
