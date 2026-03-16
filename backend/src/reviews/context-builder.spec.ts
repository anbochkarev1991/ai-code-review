import { Test, TestingModule } from '@nestjs/testing';
import { ContextBuilder } from './context-builder';
import { GitHubService } from '../github/github.service';
import type { ParsedFile } from '../types';

const mockGetFileContent = jest.fn();

describe('ContextBuilder', () => {
  let builder: ContextBuilder;
  const expandParams = {
    accessToken: 'token',
    owner: 'owner',
    repo: 'repo',
    headRef: 'main',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetFileContent.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextBuilder,
        {
          provide: GitHubService,
          useValue: { getFileContent: mockGetFileContent },
        },
      ],
    }).compile();

    builder = module.get(ContextBuilder);
  });

  describe('expand', () => {
    it('returns ExpandedFile for each ParsedFile with empty context when getFileContent returns null', async () => {
      const files: ParsedFile[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          language: 'typescript',
          hunks: [
            {
              startLine: 10,
              endLine: 12,
              content: '+const x = 1;\n+foo();',
              addedLines: ['const x = 1;', 'foo();'],
              removedLines: [],
            },
          ],
        },
      ];

      const result = await builder.expand(files, expandParams);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/utils.ts');
      expect(result[0].expandedHunks).toHaveLength(1);
      expect(result[0].expandedHunks[0].localContext).toEqual({
        enclosingFunction: null,
        referencedDeclarations: [],
        calledHelpers: [],
      });
      expect(result[0].fullSource).toBeUndefined();
    });

    it('extracts enclosing function when full source is available', async () => {
      const fullSource = [
        'export function processData() {',
        '  const x = 1;',
        '  return x + 1;',
        '}',
      ].join('\n');

      mockGetFileContent.mockResolvedValue(fullSource);

      const files: ParsedFile[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          language: 'typescript',
          hunks: [
            {
              startLine: 2,
              endLine: 3,
              content: '  const x = 1;\n  return x + 1;',
              addedLines: ['  const x = 1;', '  return x + 1;'],
              removedLines: [],
            },
          ],
        },
      ];

      const result = await builder.expand(files, expandParams);

      expect(
        result[0].expandedHunks[0].localContext.enclosingFunction,
      ).toContain('processData');
      expect(
        result[0].expandedHunks[0].localContext.enclosingFunction,
      ).toContain('const x = 1');
    });

    it('extracts referenced declarations from changed lines', async () => {
      const fullSource = [
        'function handler() {',
        '  const userId = req.user?.id;',
        '  const data = fetchData(userId);',
        '  return data;',
        '}',
      ].join('\n');

      mockGetFileContent.mockResolvedValue(fullSource);

      const files: ParsedFile[] = [
        {
          path: 'src/handler.ts',
          status: 'modified',
          language: 'typescript',
          hunks: [
            {
              startLine: 3,
              endLine: 4,
              content: '  const data = fetchData(userId);\n  return data;',
              addedLines: [
                '  const data = fetchData(userId);',
                '  return data;',
              ],
              removedLines: [],
            },
          ],
        },
      ];

      const result = await builder.expand(files, expandParams);

      const decls =
        result[0].expandedHunks[0].localContext.referencedDeclarations;
      expect(decls.length).toBeGreaterThanOrEqual(0);
    });

    it('fetches file content with correct params', async () => {
      const files: ParsedFile[] = [
        {
          path: 'backend/src/main.ts',
          status: 'modified',
          language: 'typescript',
          hunks: [
            {
              startLine: 1,
              endLine: 1,
              content: '+line',
              addedLines: ['line'],
              removedLines: [],
            },
          ],
        },
      ];

      await builder.expand(files, expandParams);

      expect(mockGetFileContent).toHaveBeenCalledWith(
        'token',
        'owner',
        'repo',
        'backend/src/main.ts',
        'main',
      );
    });

    it('produces one ExpandedHunk per DiffHunk', async () => {
      mockGetFileContent.mockResolvedValue('line1\nline2\nline3');

      const files: ParsedFile[] = [
        {
          path: 'src/foo.ts',
          status: 'modified',
          language: 'typescript',
          hunks: [
            {
              startLine: 1,
              endLine: 1,
              content: '+a',
              addedLines: ['a'],
              removedLines: [],
            },
            {
              startLine: 3,
              endLine: 3,
              content: '+b',
              addedLines: ['b'],
              removedLines: [],
            },
          ],
        },
      ];

      const result = await builder.expand(files, expandParams);

      expect(result[0].expandedHunks).toHaveLength(2);
      expect(result[0].expandedHunks[0].hunk.startLine).toBe(1);
      expect(result[0].expandedHunks[1].hunk.startLine).toBe(3);
    });
  });
});
