import { FindingNormalizer } from './finding-normalizer';
import type { Finding, ParsedFile } from 'shared';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-1',
    title: 'Test finding',
    severity: 'medium',
    category: 'code-quality',
    message: 'Some test finding message that is long enough for similarity checks',
    confidence: 0.8,
    file: 'src/app.ts',
    line: 10,
    ...overrides,
  };
}

function makeDiffFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    path: 'src/app.ts',
    status: 'modified',
    hunks: [
      {
        startLine: 1,
        endLine: 50,
        content: '+const x = 1;',
        addedLines: ['const x = 1;'],
        removedLines: [],
      },
    ],
    language: 'typescript',
    ...overrides,
  };
}

describe('FindingNormalizer', () => {
  let normalizer: FindingNormalizer;

  beforeEach(() => {
    normalizer = new FindingNormalizer();
  });

  describe('confidence clamping and rebalancing', () => {
    it('caps base confidence at 0.85', () => {
      const result = normalizer.normalize([makeFinding({ confidence: 0.95 })]);
      expect(result[0].confidence).toBeLessThanOrEqual(0.85);
    });

    it('clamps values above 1 — capped at 0.85 then final clamp at 0.95', () => {
      const result = normalizer.normalize([makeFinding({ confidence: 1.5 })]);
      expect(result[0].confidence).toBeLessThanOrEqual(0.95);
    });

    it('clamps values below 0 to minimum 0.3', () => {
      const result = normalizer.normalize([makeFinding({ confidence: -0.3 })]);
      expect(result[0].confidence).toBe(0.3);
    });

    it('defaults undefined confidence to 0.5', () => {
      const result = normalizer.normalize([makeFinding({ confidence: undefined })]);
      expect(result[0].confidence).toBe(0.5);
    });

    it('preserves valid confidence values within cap range', () => {
      const result = normalizer.normalize([makeFinding({ confidence: 0.75 })]);
      expect(result[0].confidence).toBe(0.75);
    });

    it('final confidence is between 0.3 and 0.95', () => {
      const low = normalizer.normalize([makeFinding({ confidence: 0.01 })]);
      const high = normalizer.normalize([makeFinding({ confidence: 0.99 })]);
      expect(low[0].confidence).toBeGreaterThanOrEqual(0.3);
      expect(high[0].confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('cross-agent deduplication', () => {
    it('merges findings on same file + nearby line + similar message', () => {
      const findings = [
        makeFinding({
          id: 'sec-1',
          agent_name: 'Security',
          category: 'security',
          severity: 'high',
          confidence: 0.85,
          file: 'src/api.ts',
          line: 10,
          message: 'SQL injection vulnerability in query builder function',
        }),
        makeFinding({
          id: 'cq-1',
          agent_name: 'Code Quality',
          category: 'code-quality',
          severity: 'medium',
          confidence: 0.7,
          file: 'src/api.ts',
          line: 11,
          message: 'SQL injection vulnerability detected in query builder',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('high');
      expect(result[0].merged_agents).toEqual(['Security', 'Code Quality']);
      expect(result[0].merged_categories).toEqual(['security', 'code-quality']);
    });

    it('merges findings with similar titles even if messages differ', () => {
      const findings = [
        makeFinding({
          id: 'a-1',
          title: 'SQL injection vulnerability',
          agent_name: 'Security',
          file: 'src/api.ts',
          line: 10,
          message: 'This is a detailed security explanation',
        }),
        makeFinding({
          id: 'b-1',
          title: 'SQL injection vulnerability detected',
          agent_name: 'Code Quality',
          file: 'src/api.ts',
          line: 12,
          message: 'Completely different explanation here',
        }),
      ];
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
    });

    it('respects line delta <= 3', () => {
      const findings = [
        makeFinding({ file: 'src/a.ts', line: 10, message: 'same issue detected here in code' }),
        makeFinding({ file: 'src/a.ts', line: 13, message: 'same issue detected here in code' }),
      ];
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
    });

    it('does NOT merge findings on different files', () => {
      const findings = [
        makeFinding({ file: 'src/a.ts', line: 10, message: 'same issue detected' }),
        makeFinding({ file: 'src/b.ts', line: 10, message: 'same issue detected' }),
      ];
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });

    it('does NOT merge findings with distant lines (> 3)', () => {
      const findings = [
        makeFinding({ file: 'src/a.ts', line: 10, message: 'same issue detected here in code' }),
        makeFinding({ file: 'src/a.ts', line: 100, message: 'same issue detected here in code' }),
      ];
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });

    it('boosts confidence when multiple agents agree', () => {
      const findings = [
        makeFinding({
          agent_name: 'Security',
          severity: 'high',
          confidence: 0.8,
          file: 'src/x.ts',
          line: 5,
          message: 'Potential cross-site scripting vulnerability found',
        }),
        makeFinding({
          agent_name: 'Code Quality',
          severity: 'low',
          confidence: 0.5,
          file: 'src/x.ts',
          line: 5,
          message: 'Potential cross-site scripting vulnerability detected',
        }),
      ];
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
      expect(result[0].confidence).toBeDefined();
      expect(result[0].merged_agents?.length).toBeGreaterThan(1);
    });
  });

  describe('confidence-severity coherence', () => {
    it('downgrades critical to high when confidence < 0.6', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'critical', confidence: 0.4 }),
      ]);
      expect(result[0].severity).toBe('high');
    });

    it('preserves critical when confidence >= 0.6', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'critical', confidence: 0.8 }),
      ]);
      expect(result[0].severity).toBe('critical');
    });

    it('does not affect non-critical severities', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'high', confidence: 0.3 }),
      ]);
      expect(result[0].severity).toBe('high');
    });
  });

  describe('diff boundary enforcement', () => {
    it('marks finding as outside_diff if file not in diff', () => {
      const diffFiles = [makeDiffFile({ path: 'src/other.ts' })];
      const result = normalizer.normalize(
        [makeFinding({ file: 'src/app.ts', line: 10 })],
        diffFiles,
      );
      expect(result[0].outside_diff).toBe(true);
      expect(result[0].confidence).toBeLessThan(0.8);
    });

    it('applies 0.6x multiplier to outside_diff findings', () => {
      const diffFiles = [makeDiffFile({ path: 'src/other.ts' })];
      const result = normalizer.normalize(
        [makeFinding({ file: 'src/app.ts', line: 10, confidence: 0.8 })],
        diffFiles,
      );
      expect(result[0].outside_diff).toBe(true);
      expect(result[0].confidence).toBeLessThanOrEqual(0.51);
    });

    it('marks finding as outside_diff if line not in any hunk', () => {
      const diffFiles = [
        makeDiffFile({
          path: 'src/app.ts',
          hunks: [{
            startLine: 100,
            endLine: 120,
            content: '+new code',
            addedLines: ['new code'],
            removedLines: [],
          }],
        }),
      ];
      const result = normalizer.normalize(
        [makeFinding({ file: 'src/app.ts', line: 10 })],
        diffFiles,
      );
      expect(result[0].outside_diff).toBe(true);
    });

    it('does not flag finding if file and line are in diff', () => {
      const diffFiles = [makeDiffFile({ path: 'src/app.ts' })];
      const result = normalizer.normalize(
        [makeFinding({ file: 'src/app.ts', line: 10 })],
        diffFiles,
      );
      expect(result[0].outside_diff).toBeUndefined();
    });

    it('suppresses outside_diff findings in strictMode', () => {
      const diffFiles = [makeDiffFile({ path: 'src/other.ts' })];
      const result = normalizer.normalize(
        [makeFinding({ file: 'src/app.ts', line: 10 })],
        diffFiles,
        true,
      );
      expect(result.length).toBe(0);
    });
  });

  describe('diff context attachment', () => {
    it('attaches diff context when finding is inside a hunk', () => {
      const diffFiles = [makeDiffFile({
        path: 'src/app.ts',
        hunks: [{
          startLine: 5,
          endLine: 15,
          content: ' line5\n line6\n line7\n line8\n line9\n+line10\n line11\n line12\n line13\n line14\n line15',
          addedLines: ['line10'],
          removedLines: [],
        }],
      })];
      const result = normalizer.normalize(
        [makeFinding({ file: 'src/app.ts', line: 10 })],
        diffFiles,
      );
      expect(result[0].diff_context).toBeDefined();
      expect(result[0].diff_context!.snippet).toBeDefined();
    });
  });

  describe('uncertainty downgrade', () => {
    it('downgrades severity when message contains uncertainty phrases', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'high',
          confidence: 0.6,
          message: 'This might cause memory issues in production',
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('does not downgrade when confidence >= 0.8', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'high',
          confidence: 0.85,
          message: 'This might cause memory issues in production',
        }),
      ]);
      expect(result[0].severity).toBe('high');
    });
  });

  describe('quality enforcement', () => {
    it('truncates message to 3 sentences max', () => {
      const result = normalizer.normalize([
        makeFinding({
          message:
            'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.',
        }),
      ]);
      expect(result[0].message).toBe(
        'First sentence. Second sentence. Third sentence.',
      );
    });

    it('truncates impact to 2 sentences max', () => {
      const result = normalizer.normalize([
        makeFinding({
          impact: 'First impact. Second impact. Third impact.',
        }),
      ]);
      expect(result[0].impact).toBe('First impact. Second impact.');
    });

    it('preserves short messages', () => {
      const result = normalizer.normalize([
        makeFinding({ message: 'Short message.' }),
      ]);
      expect(result[0].message).toBe('Short message.');
    });
  });

  describe('sorting', () => {
    it('sorts by severity (highest first), then confidence', () => {
      const findings = [
        makeFinding({ id: 'low', severity: 'low', confidence: 0.85, file: 'src/a.ts', message: 'A specific low severity issue in code' }),
        makeFinding({ id: 'critical', severity: 'critical', confidence: 0.8, file: 'src/b.ts', message: 'A specific critical severity issue in code' }),
        makeFinding({ id: 'high', severity: 'high', confidence: 0.7, file: 'src/c.ts', message: 'A specific high severity issue in code' }),
      ];
      const result = normalizer.normalize(findings);
      expect(result.map((f) => f.id)).toEqual(['critical', 'high', 'low']);
    });
  });
});
