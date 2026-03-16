import { Test, TestingModule } from '@nestjs/testing';
import { AgentContextShaper } from './agent-context-shaper';
import type { ExpandedFile } from '../types';

function createExpandedFile(
  path: string,
  hunks: Array<{
    diffContent: string;
    enclosingFunction?: string | null;
    referencedDeclarations?: string[];
    calledHelpers?: string[];
  }>,
  language = 'typescript',
): ExpandedFile {
  const expandedHunks = hunks.map((h) => {
    const hunk = {
      startLine: 1,
      endLine: 2,
      content: h.diffContent,
      addedLines: [] as string[],
      removedLines: [] as string[],
    };
    return {
      hunk,
      localContext: {
        enclosingFunction: h.enclosingFunction ?? null,
        referencedDeclarations: h.referencedDeclarations ?? [],
        calledHelpers: h.calledHelpers ?? [],
      },
    };
  });
  return {
    path,
    status: 'modified',
    language,
    hunks: expandedHunks.map((eh) => eh.hunk),
    expandedHunks,
  };
}

describe('AgentContextShaper', () => {
  let shaper: AgentContextShaper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentContextShaper],
    }).compile();

    shaper = module.get(AgentContextShaper);
  });

  describe('formatForAgent', () => {
    it('includes preamble for all agent types', () => {
      const files = [
        createExpandedFile('src/foo.ts', [{ diffContent: '+const x = 1;' }]),
      ];

      const out = shaper.formatForAgent(files, 'code-quality');
      expect(out).toContain('You are reviewing the changed hunks below');
      expect(out).toContain('diff-first');
      expect(out).toContain('DIFF-FIRST');
    });

    it('includes diff content for each file', () => {
      const files = [
        createExpandedFile('src/a.ts', [{ diffContent: '+line1' }]),
        createExpandedFile('src/b.ts', [{ diffContent: '+line2' }]),
      ];

      const out = shaper.formatForAgent(files, 'security');
      expect(out).toContain('## File: src/a.ts');
      expect(out).toContain('### Changed Code (diff)');
      expect(out).toContain('+line1');
      expect(out).toContain('## File: src/b.ts');
      expect(out).toContain('+line2');
    });

    it('includes enclosing function when present', () => {
      const files = [
        createExpandedFile('src/handler.ts', [
          {
            diffContent: '+  return data;',
            enclosingFunction:
              'function handler() {\n  const data = fetch();\n  return data;\n}',
          },
        ]),
      ];

      const out = shaper.formatForAgent(files, 'code-quality');
      expect(out).toContain('### Enclosing Function');
      expect(out).toContain('function handler()');
      expect(out).toContain('return data');
    });

    it('filters security-relevant context for security agent', () => {
      const files = [
        createExpandedFile('src/auth.ts', [
          {
            diffContent: '+redirect(url);',
            enclosingFunction: 'function handleRedirect() { ... }',
            referencedDeclarations: [
              'const token = getToken();',
              'const redirect = parseRedirect(input);',
            ],
            calledHelpers: ['function sanitize(input) { ... }'],
          },
        ]),
      ];

      const out = shaper.formatForAgent(files, 'security');
      expect(out).toContain('redirect');
      expect(out).toContain('token');
      expect(out).toContain('sanitize');
    });

    it('includes all referenced declarations for code-quality agent', () => {
      const files = [
        createExpandedFile('src/utils.ts', [
          {
            diffContent: '+  return x + y;',
            referencedDeclarations: ['const x = 1;', 'const y = 2;'],
          },
        ]),
      ];

      const out = shaper.formatForAgent(files, 'code-quality');
      expect(out).toContain('### Referenced Declarations');
      expect(out).toContain('const x = 1;');
      expect(out).toContain('const y = 2;');
    });

    it('respects token budget and truncates files', () => {
      const largeContent = 'x'.repeat(5000);
      const files = [
        createExpandedFile('src/a.ts', [
          {
            diffContent: largeContent,
            enclosingFunction: 'x'.repeat(3000),
          },
        ]),
        createExpandedFile('src/b.ts', [{ diffContent: '+small' }]),
      ];

      const out = shaper.formatForAgent(files, 'code-quality', 500);
      expect(out).toContain('omitted due to token budget');
    });

    it('produces different output per agent type', () => {
      const files = [
        createExpandedFile('src/foo.ts', [
          {
            diffContent: '+foo();',
            enclosingFunction: 'function bar() {}',
            referencedDeclarations: ['const auth = 1;', 'const x = 2;'],
            calledHelpers: ['function validate() {}'],
          },
        ]),
      ];

      const securityOut = shaper.formatForAgent(files, 'security');
      const cqOut = shaper.formatForAgent(files, 'code-quality');

      expect(securityOut).toContain('auth');
      expect(securityOut).toContain('validate');
      expect(cqOut).toContain('const x = 2;');
    });
  });
});
