import { SeverityNormalizer } from './severity-normalizer';
import type { Finding, ConsensusLevel } from 'shared';

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

describe('SeverityNormalizer', () => {
  let normalizer: SeverityNormalizer;

  beforeEach(() => {
    normalizer = new SeverityNormalizer();
  });

  describe('determinism', () => {
    it('produces identical output for identical input on repeated calls', () => {
      const input = [
        makeFinding({
          id: 'a',
          severity: 'high',
          confidence: 0.6,
          category: 'security',
          file: 'src/a.ts',
        }),
        makeFinding({
          id: 'b',
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          file: 'src/b.ts',
        }),
        makeFinding({
          id: 'c',
          severity: 'high',
          confidence: 0.7,
          category: 'performance',
          file: 'src/c.ts',
        }),
        makeFinding({
          id: 'd',
          severity: 'medium',
          confidence: 0.5,
          file: 'src/d.ts',
        }),
        makeFinding({
          id: 'e',
          severity: 'low',
          confidence: 0.3,
          file: 'src/e.ts',
        }),
        makeFinding({
          id: 'f',
          severity: 'high',
          confidence: 0.4,
          category: 'architecture',
          file: 'src/f.ts',
        }),
        makeFinding({
          id: 'g',
          severity: 'high',
          confidence: 0.85,
          category: 'code-quality',
          file: 'src/g.ts',
        }),
      ];

      const result1 = normalizer.normalize(input);
      const result2 = normalizer.normalize(input);
      const result3 = normalizer.normalize(input);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('Deterministic severity classifier (Rule 0)', () => {
    it('downgrades inflated CRITICAL to MEDIUM when confidence < 0.8', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'critical',
          confidence: 0.5,
          category: 'security',
          impact: 'Potential issue.',
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('preserves CRITICAL when impact high, likelihood high, confidence >= 0.8', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'critical',
          confidence: 0.96,
          category: 'security',
          impact: 'SQL injection leading to full database compromise.',
          message: 'User input reaches the query unsanitized.',
        }),
      ]);
      expect(result[0].severity).toBe('critical');
    });

    it('assigns HIGH when impact high and confidence in [0.8, 0.95)', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          impact: 'Authentication bypass on protected routes.',
          message: 'Missing authorization check.',
        }),
      ]);
      expect(result[0].severity).toBe('high');
    });

    it('caps at MEDIUM when confidence < 0.8 even if agent said HIGH', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'high',
          confidence: 0.75,
          category: 'security',
          impact: 'Remote code execution.',
          message: 'Clear evidence in diff.',
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('leaves MEDIUM and LOW as MEDIUM after classifier when not stylistic', () => {
      const result = normalizer.normalize([
        makeFinding({ severity: 'medium', confidence: 0.5 }),
      ]);
      expect(result[0].severity).toBe('medium');
    });
  });

  describe('Rule 1: multi-agent consensus boost', () => {
    it('boosts MEDIUM to HIGH when consensus_level = multi-agent', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'medium',
          confidence: 0.8,
          category: 'security',
          message: 'Concrete issue in the diff without stylistic keywords.',
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
      ]);
      expect(result[0].severity).toBe('high');
    });

    it('boosts LOW to MEDIUM when consensus_level = multi-agent (stylistic LOW)', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'low',
          confidence: 0.8,
          category: 'code-quality',
          message: 'Naming convention for the helper should use camelCase.',
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('does not boost CRITICAL (already max)', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'critical',
          confidence: 0.96,
          category: 'security',
          impact: 'SQL injection leading to compromise.',
          message: 'Untrusted input in query.',
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
      ]);
      expect(result[0].severity).toBe('critical');
    });

    it('does not boost single-agent findings', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'medium',
          confidence: 0.8,
          consensus_level: 'single-agent' as ConsensusLevel,
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('does not boost multi-agent when confidence < 0.8', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'medium',
          confidence: 0.79,
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });

    it('interaction: classifier caps below 0.8; multi-agent cannot boost without confidence >= 0.8', () => {
      const result = normalizer.normalize([
        makeFinding({
          severity: 'high',
          confidence: 0.6,
          category: 'security',
          impact: 'Issue.',
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
      ]);
      expect(result[0].severity).toBe('medium');
    });
  });

  describe('Rule 2: max 3 HIGH per category', () => {
    it('keeps top 3 by confidence and downgrades the rest', () => {
      const findings = [
        makeFinding({
          id: 'h1',
          severity: 'high',
          confidence: 0.92,
          category: 'security',
          file: 'a.ts',
          title: 'Unique finding about SQL injection',
          message: 'Clear vulnerability in changed lines.',
        }),
        makeFinding({
          id: 'h2',
          severity: 'high',
          confidence: 0.91,
          category: 'security',
          file: 'b.ts',
          title: 'Unique finding about XSS vulnerability',
          message: 'Clear vulnerability in changed lines.',
        }),
        makeFinding({
          id: 'h3',
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          file: 'c.ts',
          title: 'Unique finding about CSRF attack',
          message: 'Clear vulnerability in changed lines.',
        }),
        makeFinding({
          id: 'h4',
          severity: 'high',
          confidence: 0.89,
          category: 'security',
          file: 'd.ts',
          title: 'Unique finding about auth bypass',
          message: 'Clear vulnerability in changed lines.',
        }),
        makeFinding({
          id: 'h5',
          severity: 'high',
          confidence: 0.88,
          category: 'security',
          file: 'e.ts',
          title: 'Unique finding about path traversal',
          message: 'Clear vulnerability in changed lines.',
        }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      const mediumCount = result.filter((f) => f.severity === 'medium').length;

      expect(highCount).toBe(3);
      expect(mediumCount).toBe(2);
    });

    it('applies independently across categories (within overflow limit)', () => {
      const findings = [
        makeFinding({
          id: 's1',
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          file: 'a.ts',
          title: 'Security issue one',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: 's2',
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          file: 'b.ts',
          title: 'Security issue two',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: 'p1',
          severity: 'high',
          confidence: 0.9,
          category: 'performance',
          file: 'c.ts',
          title: 'Performance issue one',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: 'p2',
          severity: 'high',
          confidence: 0.9,
          category: 'performance',
          file: 'd.ts',
          title: 'Performance issue two',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: 'p3',
          severity: 'high',
          confidence: 0.9,
          category: 'performance',
          file: 'e.ts',
          title: 'Performance issue three',
          message: 'Clear issue in diff.',
        }),
      ];

      const result = normalizer.normalize(findings);
      const allHigh = result.filter((f) => f.severity === 'high');
      expect(allHigh.length).toBe(5);
    });
  });

  describe('Rule 3: overflow downgrade (total > 5)', () => {
    it('downgrades lowest-confidence single-agent HIGHs when total findings > 5', () => {
      const findings = [
        makeFinding({
          id: '1',
          severity: 'high',
          confidence: 0.92,
          file: 'a.ts',
          category: 'security',
          title: 'SQL injection vulnerability',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: '2',
          severity: 'high',
          confidence: 0.91,
          file: 'b.ts',
          category: 'performance',
          title: 'Memory leak issue',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: '3',
          severity: 'high',
          confidence: 0.9,
          file: 'c.ts',
          category: 'architecture',
          title: 'Circular dependency',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: '4',
          severity: 'high',
          confidence: 0.89,
          file: 'd.ts',
          category: 'code-quality',
          title: 'Missing error handling',
          message: 'Clear issue in diff.',
        }),
        makeFinding({
          id: '5',
          severity: 'medium',
          confidence: 0.7,
          file: 'e.ts',
        }),
        makeFinding({
          id: '6',
          severity: 'low',
          confidence: 0.5,
          file: 'f.ts',
        }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      expect(highCount).toBeLessThanOrEqual(3);
    });

    it('does not downgrade when total findings <= 5', () => {
      const findings = [
        makeFinding({
          id: '1',
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          file: 'a.ts',
          message: 'Clear issue.',
        }),
        makeFinding({
          id: '2',
          severity: 'high',
          confidence: 0.89,
          category: 'performance',
          file: 'b.ts',
          message: 'Clear issue.',
        }),
        makeFinding({
          id: '3',
          severity: 'high',
          confidence: 0.88,
          category: 'architecture',
          file: 'c.ts',
          message: 'Clear issue.',
        }),
        makeFinding({
          id: '4',
          severity: 'medium',
          confidence: 0.6,
          file: 'd.ts',
        }),
        makeFinding({
          id: '5',
          severity: 'low',
          confidence: 0.5,
          file: 'e.ts',
        }),
      ];

      const result = normalizer.normalize(findings);
      const highCount = result.filter((f) => f.severity === 'high').length;
      expect(highCount).toBe(3);
    });

    it('preserves multi-agent findings during overflow downgrade (boosted to critical)', () => {
      const findings = [
        makeFinding({
          id: '1',
          severity: 'high',
          confidence: 0.96,
          file: 'a.ts',
          category: 'security',
          title: 'SQL injection',
          message: 'Untrusted input in query string.',
          impact: 'SQL injection leading to data compromise.',
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
        makeFinding({
          id: '2',
          severity: 'high',
          confidence: 0.91,
          file: 'b.ts',
          category: 'performance',
          title: 'Memory leak',
          message: 'Clear issue.',
        }),
        makeFinding({
          id: '3',
          severity: 'high',
          confidence: 0.9,
          file: 'c.ts',
          category: 'architecture',
          title: 'Circular dep',
          message: 'Clear issue.',
        }),
        makeFinding({
          id: '4',
          severity: 'high',
          confidence: 0.89,
          file: 'd.ts',
          category: 'code-quality',
          title: 'Error handling',
          message: 'Clear issue.',
        }),
        makeFinding({
          id: '5',
          severity: 'medium',
          confidence: 0.7,
          file: 'e.ts',
        }),
        makeFinding({
          id: '6',
          severity: 'low',
          confidence: 0.5,
          file: 'f.ts',
        }),
      ];

      const result = normalizer.normalize(findings);
      const multiAgentFinding = result.find((f) => f.id === '1');
      // Multi-agent consensus HIGH gets boosted to CRITICAL by Rule 2
      expect(multiAgentFinding?.severity).toBe('critical');
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

    it('does NOT merge findings with different files', () => {
      const findings = [
        makeFinding({
          id: 'rc-1',
          severity: 'high',
          file: 'src/a.ts',
          category: 'security',
          title: 'SQL injection vulnerability',
        }),
        makeFinding({
          id: 'rc-2',
          severity: 'high',
          file: 'src/b.ts',
          category: 'security',
          title: 'SQL injection vulnerability',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });

    it('does NOT merge non-HIGH/CRITICAL findings', () => {
      const findings = [
        makeFinding({
          id: 'rc-1',
          severity: 'medium',
          file: 'src/a.ts',
          category: 'security',
          title: 'Missing input validation',
        }),
        makeFinding({
          id: 'rc-2',
          severity: 'medium',
          file: 'src/a.ts',
          category: 'security',
          title: 'Missing input validation check',
        }),
      ];

      const result = normalizer.normalize(findings);
      expect(result.length).toBe(2);
    });
  });

  describe('normalizeWithStats', () => {
    it('returns before/after severity distribution and counts', () => {
      const findings = [
        makeFinding({
          id: '1',
          severity: 'high',
          confidence: 0.5,
          file: 'a.ts',
          title: 'Issue one',
        }),
        makeFinding({
          id: '2',
          severity: 'high',
          confidence: 0.9,
          file: 'b.ts',
          title: 'Issue two',
        }),
        makeFinding({
          id: '3',
          severity: 'high',
          confidence: 0.6,
          file: 'c.ts',
          title: 'Issue three',
        }),
        makeFinding({
          id: '4',
          severity: 'medium',
          confidence: 0.7,
          file: 'd.ts',
          title: 'Issue four',
        }),
      ];

      const { stats } = normalizer.normalizeWithStats(findings);

      expect(stats.before.high).toBe(3);
      expect(stats.after.high).toBeLessThan(stats.before.high);
      expect(stats.downgradedCount).toBeGreaterThan(0);
    });

    it('tracks upgrade count for multi-agent consensus', () => {
      const findings = [
        makeFinding({
          id: '1',
          severity: 'medium',
          confidence: 0.8,
          file: 'a.ts',
          consensus_level: 'multi-agent' as ConsensusLevel,
        }),
      ];

      const { stats, findings: result } =
        normalizer.normalizeWithStats(findings);
      expect(result[0].severity).toBe('high');
      expect(stats.upgradedCount).toBeGreaterThan(0);
    });
  });

  describe('combined rules interaction', () => {
    it('applies all rules together for a realistic scenario', () => {
      const findings = [
        makeFinding({
          id: '1',
          severity: 'high',
          confidence: 0.95,
          category: 'security',
          file: 'src/auth.ts',
          title: 'SQL injection in user login',
        }),
        makeFinding({
          id: '2',
          severity: 'high',
          confidence: 0.9,
          category: 'security',
          file: 'src/api.ts',
          title: 'XSS vulnerability in template rendering',
        }),
        makeFinding({
          id: '3',
          severity: 'high',
          confidence: 0.85,
          category: 'security',
          file: 'src/db.ts',
          title: 'SQL injection in query builder function',
          line: 20,
        }),
        makeFinding({
          id: '4',
          severity: 'high',
          confidence: 0.8,
          category: 'security',
          file: 'src/db.ts',
          title: 'SQL injection risk in query builder module',
          line: 25,
        }),
        makeFinding({
          id: '5',
          severity: 'high',
          confidence: 0.6,
          category: 'performance',
          file: 'src/cache.ts',
          title: 'Missing cache invalidation strategy',
        }),
        makeFinding({
          id: '6',
          severity: 'high',
          confidence: 0.55,
          category: 'code-quality',
          file: 'src/utils.ts',
          title: 'Deeply nested callback pattern',
        }),
        makeFinding({
          id: '7',
          severity: 'medium',
          confidence: 0.7,
          category: 'architecture',
          file: 'src/router.ts',
          title: 'Tight coupling between modules',
        }),
        makeFinding({
          id: '8',
          severity: 'low',
          confidence: 0.4,
          category: 'code-quality',
          file: 'src/index.ts',
          title: 'Unused import statement',
        }),
      ];

      const { findings: result, stats } =
        normalizer.normalizeWithStats(findings);

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

  describe('edge cases', () => {
    it('handles empty findings array', () => {
      const result = normalizer.normalize([]);
      expect(result).toEqual([]);
    });

    it('handles single finding', () => {
      const result = normalizer.normalize([makeFinding()]);
      expect(result.length).toBe(1);
    });

    it('handles all stylistic LOW findings', () => {
      const findings = Array.from({ length: 10 }, (_, i) =>
        makeFinding({
          id: `l-${i}`,
          severity: 'low',
          confidence: 0.5,
          file: `f${i}.ts`,
          category: 'code-quality',
          message: 'Naming convention for the helper should use camelCase.',
        }),
      );
      const result = normalizer.normalize(findings);
      expect(result.length).toBe(10);
      expect(result.every((f) => f.severity === 'low')).toBe(true);
    });
  });
});
