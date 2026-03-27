import { RiskEngine } from './risk-engine';
import type { Finding } from 'shared';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-1',
    title: 'Test finding',
    severity: 'medium',
    category: 'code-quality',
    message: 'Test message',
    confidence: 0.8,
    ...overrides,
  };
}

describe('RiskEngine', () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine();
  });

  describe('calculateRiskScore', () => {
    it('returns 0 for empty findings', () => {
      expect(engine.calculateRiskScore([])).toBe(0);
    });

    it('is deterministic — same findings always produce same score', () => {
      const findings = [
        makeFinding({
          severity: 'high',
          confidence: 0.9,
          category: 'security',
        }),
        makeFinding({
          severity: 'medium',
          confidence: 0.7,
          category: 'performance',
        }),
      ];
      const score1 = engine.calculateRiskScore(findings);
      const score2 = engine.calculateRiskScore(findings);
      const score3 = engine.calculateRiskScore(findings);
      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('returns an integer (no floating-point drift)', () => {
      const findings = [
        makeFinding({
          severity: 'high',
          confidence: 0.333,
          category: 'security',
        }),
        makeFinding({
          severity: 'medium',
          confidence: 0.777,
          category: 'architecture',
        }),
      ];
      const score = engine.calculateRiskScore(findings);
      expect(Number.isInteger(score)).toBe(true);
    });

    it('changing one severity changes score predictably', () => {
      const base = [makeFinding({ severity: 'medium', confidence: 0.8 })];
      const upgraded = [makeFinding({ severity: 'high', confidence: 0.8 })];

      const baseScore = engine.calculateRiskScore(base);
      const upgradedScore = engine.calculateRiskScore(upgraded);
      expect(upgradedScore).toBeGreaterThan(baseScore);
    });

    it('caps at 100', () => {
      const findings = Array.from({ length: 50 }, () =>
        makeFinding({
          severity: 'critical',
          confidence: 1.0,
          category: 'security',
        }),
      );
      expect(engine.calculateRiskScore(findings)).toBe(100);
    });

    it('applies diminishing returns — 20 mediums < 100 score', () => {
      const findings = Array.from({ length: 20 }, (_, i) =>
        makeFinding({ id: `m-${i}`, severity: 'medium', confidence: 0.8 }),
      );
      const score = engine.calculateRiskScore(findings);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });

    it('uses correct weights: critical=50, high=15, medium=5, low=1', () => {
      const criticalScore = engine.calculateRiskScore([
        makeFinding({ severity: 'critical' }),
      ]);
      const highScore = engine.calculateRiskScore([
        makeFinding({ severity: 'high' }),
      ]);
      const mediumScore = engine.calculateRiskScore([
        makeFinding({ severity: 'medium' }),
      ]);
      const lowScore = engine.calculateRiskScore([
        makeFinding({ severity: 'low' }),
      ]);

      expect(criticalScore).toBeGreaterThan(highScore);
      expect(highScore).toBeGreaterThan(mediumScore);
      expect(mediumScore).toBeGreaterThan(lowScore);
    });
  });

  describe('calculateRiskBreakdown', () => {
    it('applies floor 70 when critical finding exists', () => {
      const breakdown = engine.calculateRiskBreakdown([
        makeFinding({
          severity: 'critical',
          confidence: 0.3,
          category: 'security',
        }),
      ]);
      expect(breakdown.final_score).toBeGreaterThanOrEqual(70);
      expect(breakdown.floor_applied).toBeDefined();
    });

    it('tracks raw weighted sum correctly', () => {
      const breakdown = engine.calculateRiskBreakdown([
        makeFinding({ severity: 'high', category: 'security' }),
        makeFinding({ severity: 'medium', category: 'performance', id: 'p-1' }),
      ]);
      expect(breakdown.raw_weighted_sum).toBe(20);
    });

    it('calculates diminishing return score', () => {
      const breakdown = engine.calculateRiskBreakdown([
        makeFinding({ severity: 'critical', category: 'security' }),
      ]);
      expect(breakdown.diminishing_return_score).toBeGreaterThan(0);
      expect(breakdown.diminishing_return_score).toBeLessThanOrEqual(100);
    });

    it('provides severity contribution breakdown', () => {
      const breakdown = engine.calculateRiskBreakdown([
        makeFinding({
          severity: 'high',
          confidence: 0.8,
          category: 'security',
        }),
      ]);
      expect(breakdown.severity_contribution.high).toBe(15);
    });

    it('provides category contribution breakdown', () => {
      const breakdown = engine.calculateRiskBreakdown([
        makeFinding({ severity: 'medium', category: 'security' }),
        makeFinding({ severity: 'low', category: 'security', id: 'l-1' }),
      ]);
      expect(breakdown.category_contribution['security']).toBe(6);
    });
  });

  describe('deriveRiskLevel', () => {
    it('derives display risk from merge verdict (single source of truth)', () => {
      expect(engine.deriveRiskLevel('safe', false)).toBe('Low risk');
      expect(engine.deriveRiskLevel('warning', false)).toBe('Moderate');
      expect(engine.deriveRiskLevel('blocked', false)).toBe('High');
      expect(engine.deriveRiskLevel('blocked', true)).toBe('Critical');
    });
  });

  describe('deriveMergeDecision', () => {
    it('blocks merge when critical findings exist', () => {
      const decision = engine.deriveMergeDecision(10, 1, 0);
      expect(decision.recommendation).toBe('Merge blocked');
      expect(decision.explanation).toContain('critical');
    });

    it('blocks merge with multiple criticals', () => {
      const decision = engine.deriveMergeDecision(90, 3, 2);
      expect(decision.recommendation).toBe('Merge blocked');
      expect(decision.explanation).toContain('3 critical severity issues');
    });

    it('blocked when any high findings', () => {
      const decision = engine.deriveMergeDecision(20, 0, 3);
      expect(decision.recommendation).toBe('Merge blocked');
      expect(decision.explanation).toContain('high severity');
    });

    it('caution when risk_score >= 60 and no high', () => {
      const decision = engine.deriveMergeDecision(60, 0, 0);
      expect(decision.recommendation).toBe('Merge with caution');
      expect(decision.explanation).toContain('60/100');
    });

    it('blocked when high present even if score is low', () => {
      const decision = engine.deriveMergeDecision(25, 0, 2);
      expect(decision.recommendation).toBe('Merge blocked');
    });

    it('critical count takes priority over score', () => {
      const decision = engine.deriveMergeDecision(5, 1, 0);
      expect(decision.recommendation).toBe('Merge blocked');
    });

    it('caution when only medium and score < 60', () => {
      const decision = engine.deriveMergeDecision(30, 0, 0, 4, 0);
      expect(decision.recommendation).toBe('Merge with caution');
    });
  });

  describe('weighted diminishing return formula', () => {
    it('score = 100 * (1 - e^(-sum/100)) for single critical (weight=50)', () => {
      const breakdown = engine.calculateRiskBreakdown([
        makeFinding({ severity: 'critical' }),
      ]);
      const expectedRaw = 100 * (1 - Math.exp(-50 / 100));
      expect(breakdown.diminishing_return_score).toBe(Math.round(expectedRaw));
    });

    it('single low finding produces very low score', () => {
      const score = engine.calculateRiskScore([
        makeFinding({ severity: 'low' }),
      ]);
      expect(score).toBeLessThanOrEqual(2);
    });

    it('produces monotonically increasing scores as findings accumulate', () => {
      const scores: number[] = [];
      for (let i = 1; i <= 10; i++) {
        const findings = Array.from({ length: i }, (_, j) =>
          makeFinding({ id: `f-${j}`, severity: 'medium' }),
        );
        scores.push(engine.calculateRiskScore(findings));
      }
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  });
});
