import { DiffParser } from './diff-parser';

const MINIMAL_PATCH = '@@ -1,1 +1,1 @@\n+line\n';

describe('DiffParser', () => {
  let parser: DiffParser;

  beforeEach(() => {
    parser = new DiffParser();
  });

  describe('shouldIgnoreFile (via parse)', () => {
    it('excludes .env.example at any path depth', () => {
      const result = parser.parse([
        {
          filename: 'backend/.env.example',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
        { filename: '.env.example', patch: MINIMAL_PATCH, status: 'modified' },
      ]);
      expect(result.files).toHaveLength(0);
    });

    it('excludes .env.sample and .env.template', () => {
      const result = parser.parse([
        {
          filename: 'frontend/.env.sample',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
        { filename: '.env.template', patch: MINIMAL_PATCH, status: 'modified' },
      ]);
      expect(result.files).toHaveLength(0);
    });

    it('excludes .gitignore and .dockerignore', () => {
      const result = parser.parse([
        { filename: '.gitignore', patch: MINIMAL_PATCH, status: 'modified' },
        { filename: '.dockerignore', patch: MINIMAL_PATCH, status: 'modified' },
      ]);
      expect(result.files).toHaveLength(0);
    });

    it('excludes lock files', () => {
      const result = parser.parse([
        {
          filename: 'package-lock.json',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
        { filename: 'bun.lock', patch: MINIMAL_PATCH, status: 'modified' },
        { filename: 'Cargo.lock', patch: MINIMAL_PATCH, status: 'modified' },
        { filename: 'Gemfile.lock', patch: MINIMAL_PATCH, status: 'modified' },
      ]);
      expect(result.files).toHaveLength(0);
    });

    it('excludes vendor and node_modules', () => {
      const result = parser.parse([
        {
          filename: 'vendor/autoload.php',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
        {
          filename: 'node_modules/foo/index.js',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
      ]);
      expect(result.files).toHaveLength(0);
    });

    it('includes reviewable source files', () => {
      const result = parser.parse([
        {
          filename: 'backend/src/main.ts',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
        {
          filename: 'frontend/app/page.tsx',
          patch: MINIMAL_PATCH,
          status: 'modified',
        },
      ]);
      expect(result.files).toHaveLength(2);
    });
  });

  describe('formatForPrompt', () => {
    it('prepends diff-first and local-context instructions for agents', () => {
      const parsed = parser.parse([
        { filename: 'src/foo.ts', patch: MINIMAL_PATCH, status: 'modified' },
      ]);
      const out = parser.formatForPrompt(parsed.files);
      expect(out).toContain('You are reviewing the changed hunks below');
      expect(out).toContain('diff-first');
      expect(out).toContain('file paths and line numbers that appear in these hunks');
      expect(out).toContain('ALLOWED LOCAL CONTEXT');
      expect(out).toContain('Do not explore unrelated files');
      expect(out).toContain('confidence below 0.5 or omit the finding');
      expect(out).toContain('## File: src/foo.ts');
    });
  });
});
