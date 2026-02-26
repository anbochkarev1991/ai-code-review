import { SeverityNormalizer } from './severity-normalizer';
import type { Finding, FindingSeverity } from 'shared';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-1',
    title: 'Test finding',
    severity: 'medium',
    category: 'code-quality',
    message: 'Some test finding message',
    confidence: 0.8,
    file: 'src/app.ts',
    line: 10,
    ...overrides,
  };
}

function countSeverities(findings: Finding[]): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of findings) {
    counts[f.severity]++;
  }
  return counts;
}

describe('SeverityNormalizer', () => {
  let normalizer: SeverityNormalizer;

  beforeEach(() => {
    normalizer = new SeverityNormalizer();
  });

  describe('determinism', () => {
    it('produces identical output for identical input on repeated calls', () => {
      const input = [
        makeFinding({ id: 'a', severity: 'high', confidence: 0.6, category: 'security', file: 'src/a.ts' }),
        makeFinding({ id: 'b', severity: 'high', confidence: 0.9, category: 'security', file: 'src/b.ts' }),
        makeFinding({ id: 'c', severity: 'high', confidence: 0.7, category: 'performance', file: 'src/c.ts' }),
        makeFinding({ id: 'd', severity: 'medium', confidence: 0.5, file: 'src/d.ts' }),
        makeFinding({ id: 'e', severity: 'low', confidence: 0.3, file: 'src/e.ts' }),
        makeFinding({ id: 'f', severity: 'high', confidence: 0.4, category: 'architecture', file: 'src/f.ts' }),
        makeFinding({ id: 'g', severity: 'high', confidence: 0.85, category: 'code-quality', file: 'src/g.ts' }),
      ];

      const result1 = normalizer.normalize(input);
      const result2 = normalizer.normalize(input);
      const result3 = normalizer.normalize(input);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('Rule 1: low-confidence HIGH downgrade', () => {
    it('downgrades HIGH to MEDIUM when confidence < 0.75', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'high', confidence: 0.6 }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('preserves HIGH when confidence >= 0.75', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'high', confidence: 0.75 }),
      ]);
      expect(result[0].severity).toBe('high');
    });

    it('preserves HIGH when confidence is exactly 0.75', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'high', confidence: 0.75 }),
      ]);
      expect(result[0].severity).toBe('high');
    });

    it('does not affect CRITICAL severity', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'critical', confidence: 0.5 }),
      ]);
      expect(result[0].severity).toBe('critical');
    });

    it('does not affect MEDIUM severity', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'medium', confidence: 0.3 }),
      ]);
      expect(result[0].severity).toBe('medium');
    });
  });

  describe('Rule 2: max 3 HIGH per category', () => {
    it('keeps top 3 by confidence and downgrades the rest', () => {
      const findings = [
        makeFinding({ id: 'h1', severity: 'high', confidence: 0.95, category: 'security', file: 'a.ts', title: 'Unique finding about SQL injection' }),
        makeFinding({ id: 'h2', severity: 'high', confidence: 0.90, category: 'security', file: 'b.ts', title: 'Unique finding about XSS vulnerability' }),
        makeFinding({ id: 'h3', severity: 'high', confidence: 0.85, category: 'security', file: 'c.ts', title: 'Unique finding about CSRF attack' }),
        makeFinding({ id: 'h4', severity: 'high', confidence: 0.80, category: 'security', file: 'd.ts', title: 'Unique finding about auth bypass' }),
        makeFinding({ id: 'h5', severity: 'high', confidence: 0.78, category: 'security', file: 'e.ts', title: 'Unique finding about path traversal' }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      const mediumCount = result.filter((f) => f.severity === 'medium').length;

      expect(highCount).toBe(3);
      expect(mediumCount).toBe(2);
    });

    it('downgrades the lowest-confidence HIGHs', () => {
      const findings = [
        makeFinding({ id: 'h1', severity: 'high', confidence: 0.95, category: 'security', file: 'a.ts', title: 'Issue one about injection' }),
        makeFinding({ id: 'h2', severity: 'high', confidence: 0.80, category: 'security', file: 'b.ts', title: 'Issue two about auth' }),
        makeFinding({ id: 'h3', severity: 'high', confidence: 0.85, category: 'security', file: 'c.ts', title: 'Issue three about XSS' }),
        makeFinding({ id: 'h4', severity: 'high', confidence: 0.78, category: 'security', file: 'd.ts', title: 'Issue four about CSRF' }),
      ];

      const result = normalizer.normalize(findings);
      const downgraded = result.find((f) => f.id === 'h4');
      expect(downgraded?.severity).toBe('medium');
    });

    it('applies independently across categories', () => {
      const findings = [
        makeFinding({ id: 's1', severity: 'high', confidence: 0.95, category: 'security', file: 'a.ts', title: 'Security issue one' }),
        makeFinding({ id: 's2', severity: 'high', confidence: 0.90, category: 'security', file: 'b.ts', title: 'Security issue two' }),
        makeFinding({ id: 's3', severity: 'high', confidence: 0.85, category: 'security', file: 'c.ts', title: 'Security issue three' }),
        makeFinding({ id: 'p1', severity: 'high', confidence: 0.95, category: 'performance', file: 'd.ts', title: 'Performance issue one' }),
        makeFinding({ id: 'p2', severity: 'high', confidence: 0.90, category: 'performance', file: 'e.ts', title: 'Performance issue two' }),
        makeFinding({ id: 'p3', severity: 'high', confidence: 0.85, category: 'performance', file: 'f.ts', title: 'Performance issue three' }),
      ];

      const result = normalizer.normalize(findings);
      const allHigh = result.filter((f) => f.severity === 'high');
      expect(allHigh.length).toBe(6);
    });

    it('does not affect categories with 3 or fewer HIGHs', () => {
      const findings = [
        makeFinding({ id: 'h1', severity: 'high', confidence: 0.9, category: 'security', file: 'a.ts' }),
        makeFinding({ id: 'h2', severity: 'high', confidence: 0.8, category: 'security', file: 'b.ts' }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.every((f) => f.severity === 'high')).toBe(true);
    });
  });

  describe('Rule 3: overflow downgrade (total > 6)', () => {
    it('downgrades lowest-confidence HIGHs when total findings > 6', () => {
      const findings = [
        makeFinding({ id: '1', severity: 'high', confidence: 0.95, file: 'a.ts', category: 'security', title: 'SQL injection vulnerability' }),
        makeFinding({ id: '2', severity: 'high', confidence: 0.90, file: 'b.ts', category: 'performance', title: 'Memory leak issue' }),
        makeFinding({ id: '3', severity: 'high', confidence: 0.85, file: 'c.ts', category: 'architecture', title: 'Circular dependency' }),
        makeFinding({ id: '4', severity: 'high', confidence: 0.80, file: 'd.ts', category: 'code-quality', title: 'Missing error handling' }),
        makeFinding({ id: '5', severity: 'medium', confidence: 0.7, file: 'e.ts' }),
        makeFinding({ id: '6', severity: 'medium', confidence: 0.6, file: 'f.ts' }),
        makeFinding({ id: '7', severity: 'low', confidence: 0.5, file: 'g.ts' }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      expect(highCount).toBeLessThanOrEqual(3);
    });

    it('does not downgrade when total findings <= 6', () => {
      const findings = [
        makeFinding({ id: '1', severity: 'high', confidence: 0.9, category: 'security', file: 'a.ts' }),
        makeFinding({ id: '2', severity: 'high', confidence: 0.8, category: 'performance', file: 'b.ts' }),
        makeFinding({ id: '3', severity: 'high', confidence: 0.85, category: 'architecture', file: 'c.ts' }),
        makeFinding({ id: '4', severity: 'high', confidence: 0.75, category: 'code-quality', file: 'd.ts' }),
        makeFinding({ id: '5', severity: 'medium', confidence: 0.6, file: 'e.ts' }),
        makeFinding({ id: '6', severity: 'low', confidence: 0.5, file: 'f.ts' }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      expect(highCount).toBe(4);
    });
  });

  describe('Rule 4: root cause merging', () => {
    it('merges HIGH findings with same file + category + overlapping title', () => {
      const findings = [
        makeFinding({
          id: 'rc-1',
          severity: 'high',
          confidence: 0.9,
          file: 'src/db.ts',
          category: 'security',
          title: 'SQL injection vulnerability in query builder',
          message: 'User input is concatenated into SQL query',
        }),
        makeFinding({
          id: 'rc-2',
          severity: 'high',
          confidence: 0.85,
          file: 'src/db.ts',
          category: 'security',
          title: 'SQL injection risk in query builder function',
          message: 'Missing parameterized queries',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('high');
      expect(result[0].confidence).toBe(0.9);
    });

    it('keeps highest severity when merging root causes', () => {
      const findings = [
        makeFinding({
          id: 'rc-1',
          severity: 'critical',
          confidence: 0.85,
          file: 'src/auth.ts',
          category: 'security',
          title: 'Authentication bypass vulnerability in login',
        }),
        makeFinding({
          id: 'rc-2',
          severity: 'high',
          confidence: 0.9,
          file: 'src/auth.ts',
          category: 'security',
          title: 'Authentication bypass issue in login handler',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('critical');
    });

    it('does NOT merge findings with different files', () => {
      const findings = [
        makeFinding({
          id: 'rc-1', severity: 'high', file: 'src/a.ts', category: 'security',
          title: 'SQL injection vulnerability',
        }),
        makeFinding({
          id: 'rc-2', severity: 'high', file: 'src/b.ts', category: 'security',
          title: 'SQL injection vulnerability',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });

    it('does NOT merge findings with different categories', () => {
      const findings = [
        makeFinding({
          id: 'rc-1', severity: 'high', file: 'src/a.ts', category: 'security',
          title: 'Missing input validation on query',
        }),
        makeFinding({
          id: 'rc-2', severity: 'high', file: 'src/a.ts', category: 'code-quality',
          title: 'Missing input validation on handler',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });

    it('does NOT merge non-HIGH/CRITICAL findings', () => {
      const findings = [
        makeFinding({
          id: 'rc-1', severity: 'medium', file: 'src/a.ts', category: 'security',
          title: 'Missing input validation',
        }),
        makeFinding({
          id: 'rc-2', severity: 'medium', file: 'src/a.ts', category: 'security',
          title: 'Missing input validation check',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });

    it('preserves best impact and suggested_fix from merged group', () => {
      const findings = [
        makeFinding({
          id: 'rc-1', severity: 'high', confidence: 0.8,
          file: 'src/db.ts', category: 'security',
          title: 'SQL injection vulnerability in query',
          impact: 'Short impact.',
          suggested_fix: 'Use parameterized queries for all SQL.',
        }),
        makeFinding({
          id: 'rc-2', severity: 'high', confidence: 0.9,
          file: 'src/db.ts', category: 'security',
          title: 'SQL injection vulnerability in database query builder',
          impact: 'Attackers can execute arbitrary SQL commands which may lead to data theft.',
          suggested_fix: 'Fix.',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(1);
      expect(result[0].impact).toBe(
        'Attackers can execute arbitrary SQL commands which may lead to data theft.',
      );
      expect(result[0].suggested_fix).toBe(
        'Use parameterized queries for all SQL.',
      );
    });
  });

  describe('normalizeWithStats', () => {
    it('returns before/after severity distribution and counts', () => {
      const findings = [
        makeFinding({ id: '1', severity: 'high', confidence: 0.5, file: 'a.ts', title: 'Issue one' }),
        makeFinding({ id: '2', severity: 'high', confidence: 0.9, file: 'b.ts', title: 'Issue two' }),
        makeFinding({ id: '3', severity: 'high', confidence: 0.6, file: 'c.ts', title: 'Issue three' }),
        makeFinding({ id: '4', severity: 'medium', confidence: 0.7, file: 'd.ts', title: 'Issue four' }),
      ];

      const { stats } = normalizer.normalizeWithStats(findings);

      expect(stats.before.high).toBe(3);
      expect(stats.after.high).toBeLessThan(stats.before.high);
      expect(stats.downgradedCount).toBeGreaterThan(0);
    });
  });

  describe('combined rules interaction', () => {
    it('applies all rules together for a realistic scenario', () => {
      const findings = [
        makeFinding({ id: '1', severity: 'high', confidence: 0.95, category: 'security', file: 'src/auth.ts', title: 'SQL injection in user login' }),
        makeFinding({ id: '2', severity: 'high', confidence: 0.90, category: 'security', file: 'src/api.ts', title: 'XSS vulnerability in template rendering' }),
        makeFinding({ id: '3', severity: 'high', confidence: 0.85, category: 'security', file: 'src/db.ts', title: 'SQL injection in query builder function', line: 20 }),
        makeFinding({ id: '4', severity: 'high', confidence: 0.80, category: 'security', file: 'src/db.ts', title: 'SQL injection risk in query builder module', line: 25 }),
        makeFinding({ id: '5', severity: 'high', confidence: 0.60, category: 'performance', file: 'src/cache.ts', title: 'Missing cache invalidation strategy' }),
        makeFinding({ id: '6', severity: 'high', confidence: 0.55, category: 'code-quality', file: 'src/utils.ts', title: 'Deeply nested callback pattern' }),
        makeFinding({ id: '7', severity: 'medium', confidence: 0.70, category: 'architecture', file: 'src/router.ts', title: 'Tight coupling between modules' }),
        makeFinding({ id: '8', severity: 'low', confidence: 0.40, category: 'code-quality', file: 'src/index.ts', title: 'Unused import statement' }),
      ];

      const { findings: result, stats } = normalizer.normalizeWithStats(findings);

      expect(stats.before.high).toBe(6);
      expect(stats.after.high).toBeLessThanOrEqual(3);
      expect(stats.downgradedCount).toBeGreaterThan(0);

      expect(result.length).toBeLessThanOrEqual(findings.length);

      const highPerCategory = new Map<string, number>();
      for (const f of result) {
        if (f.severity === 'high') {
          const count = highPerCategory.get(f.category) ?? 0;
          highPerCategory.set(f.category, count + 1);
        }
      }
      for (const count of highPerCategory.values()) {
        expect(count).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('before/after example: realistic LLM overproduction', () => {
    it('demonstrates severity normalization on typical LLM output', () => {
      /**
       * Simulates a typical LLM review where 8 of 10 findings are HIGH —
       * the exact overproduction pattern this normalizer corrects.
       */
      const llmFindings: Finding[] = [
        makeFinding({ id: 'sec-1', severity: 'critical', confidence: 0.92, category: 'security', file: 'src/auth.ts', title: 'Hardcoded JWT secret in source code' }),
        makeFinding({ id: 'sec-2', severity: 'high', confidence: 0.88, category: 'security', file: 'src/auth.ts', title: 'Missing rate limiting on login endpoint' }),
        makeFinding({ id: 'sec-3', severity: 'high', confidence: 0.82, category: 'security', file: 'src/api.ts', title: 'No input sanitization on user query params' }),
        makeFinding({ id: 'sec-4', severity: 'high', confidence: 0.70, category: 'security', file: 'src/api.ts', title: 'Missing CORS origin validation for API' }),
        makeFinding({ id: 'perf-1', severity: 'high', confidence: 0.78, category: 'performance', file: 'src/db.ts', title: 'N+1 query pattern in user loader' }),
        makeFinding({ id: 'perf-2', severity: 'high', confidence: 0.65, category: 'performance', file: 'src/cache.ts', title: 'Cache miss on every page request' }),
        makeFinding({ id: 'arch-1', severity: 'high', confidence: 0.72, category: 'architecture', file: 'src/service.ts', title: 'Circular dependency between modules' }),
        makeFinding({ id: 'cq-1', severity: 'high', confidence: 0.60, category: 'code-quality', file: 'src/utils.ts', title: 'Excessive function complexity score' }),
        makeFinding({ id: 'cq-2', severity: 'high', confidence: 0.55, category: 'code-quality', file: 'src/handler.ts', title: 'Missing error handling in async chain' }),
        makeFinding({ id: 'cq-3', severity: 'medium', confidence: 0.50, category: 'code-quality', file: 'src/types.ts', title: 'Unused type export detected' }),
      ];

      const before = countSeverities(llmFindings);
      const { findings: result, stats } = normalizer.normalizeWithStats(llmFindings);
      const after = countSeverities(result);

      /*
       * BEFORE normalization:
       *   critical: 1, high: 8, medium: 1, low: 0  (total: 10)
       *
       * AFTER normalization (expected):
       *   critical: 1, high: <=3, medium: >=5, low: 0
       *
       * The normalizer should:
       * - Downgrade sec-4 (confidence 0.70 < 0.75) → MEDIUM
       * - Downgrade perf-2 (confidence 0.65 < 0.75) → MEDIUM
       * - Downgrade cq-1 (confidence 0.60 < 0.75) → MEDIUM
       * - Downgrade cq-2 (confidence 0.55 < 0.75) → MEDIUM
       * - Then apply overflow/cap rules to any remaining HIGHs
       */

      expect(before.high).toBe(8);
      expect(before.critical).toBe(1);

      expect(after.critical).toBe(1);
      expect(after.high).toBeLessThanOrEqual(3);
      expect(after.high + after.medium + after.low).toBeGreaterThanOrEqual(
        before.high + before.medium + before.low,
      );

      expect(stats.before).toEqual(before);
      expect(stats.after).toEqual(after);
      expect(stats.downgradedCount).toBeGreaterThanOrEqual(5);

      // eslint-disable-next-line no-console
      console.log('\n=== Severity Normalization Before/After ===');
      // eslint-disable-next-line no-console
      console.log('BEFORE:', JSON.stringify(before));
      // eslint-disable-next-line no-console
      console.log('AFTER: ', JSON.stringify(after));
      // eslint-disable-next-line no-console
      console.log(`Downgraded: ${stats.downgradedCount}, Merged root causes: ${stats.mergedRootCauseCount}`);
      // eslint-disable-next-line no-console
      console.log('Findings:', result.map(f => `${f.id}:${f.severity}(${f.confidence})`).join(', '));
    });
  });

  describe('edge cases', () => {
    it('handles empty findings array', () => {
      const result = normalizer.normalize([]);
      expect(result).toEqual([]);
    });

    it('handles single finding', () => {
      const result = normalizer.normalize([makeFinding()]);
      expect(result.length).toBe(1);
    });

    it('handles all LOW findings', () => {
      const findings = Array.from({ length: 10 }, (_, i) =>
        makeFinding({ id: `l-${i}`, severity: 'low', confidence: 0.5, file: `f${i}.ts` }),
      );
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(10);
      expect(result.every((f) => f.severity === 'low')).toBe(true);
    });

    it('handles findings with missing category (defaults to "unknown")', () => {
      const findings = [
        makeFinding({ id: '1', severity: 'high', confidence: 0.9, category: '', file: 'a.ts' }),
        makeFinding({ id: '2', severity: 'high', confidence: 0.85, category: '', file: 'b.ts' }),
        makeFinding({ id: '3', severity: 'high', confidence: 0.8, category: '', file: 'c.ts' }),
        makeFinding({ id: '4', severity: 'high', confidence: 0.76, category: '', file: 'd.ts' }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      expect(highCount).toBeLessThanOrEqual(3);
    });
  });
});
