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
        makeFinding({ severity: 'high', confidence: 0.9, category: 'security' }),
        makeFinding({ severity: 'medium', confidence: 0.7, category: 'performance' }),
      ];
      const score1 = engine.calculateRiskScore(findings);
      const score2 = engine.calculateRiskScore(findings);
      const score3 = engine.calculateRiskScore(findings);
      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('returns an integer (no floating-point drift)', () => {
      const findings = [
        makeFinding({ severity: 'high', confidence: 0.333, category: 'security' }),
        makeFinding({ severity: 'medium', confidence: 0.777, category: 'architecture' }),
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
        makeFinding({ severity: 'critical', confidence: 1.0, category: 'security' }),
      );
      expect(engine.calculateRiskScore(findings)).toBe(100);
    });

    it('clamps confidence values outside [0, 1]', () => {
      const normal = engine.calculateRiskScore([
        makeFinding({ confidence: 1.0 }),
      ]);
      const over = engine.calculateRiskScore([
        makeFinding({ confidence: 5.0 }),
      ]);
      expect(over).toBe(normal);
    });

    it('uses default confidence 0.5 when undefined', () => {
      const explicit = engine.calculateRiskScore([
        makeFinding({ confidence: 0.5 }),
      ]);
      const implicit = engine.calculateRiskScore([
        makeFinding({ confidence: undefined }),
      ]);
      expect(explicit).toBe(implicit);
    });

    it('applies category weights correctly', () => {
      const security = engine.calculateRiskScore([
        makeFinding({ severity: 'high', confidence: 1.0, category: 'security' }),
      ]);
      const codeQuality = engine.calculateRiskScore([
        makeFinding({ severity: 'high', confidence: 1.0, category: 'code-quality' }),
      ]);
      expect(security).toBeGreaterThan(codeQuality);
    });
  });

  describe('deriveRiskLevel', () => {
    it('maps score ranges correctly', () => {
      expect(engine.deriveRiskLevel(0)).toBe('Low');
      expect(engine.deriveRiskLevel(30)).toBe('Low');
      expect(engine.deriveRiskLevel(31)).toBe('Moderate');
      expect(engine.deriveRiskLevel(60)).toBe('Moderate');
      expect(engine.deriveRiskLevel(61)).toBe('High');
      expect(engine.deriveRiskLevel(80)).toBe('High');
      expect(engine.deriveRiskLevel(81)).toBe('Critical');
      expect(engine.deriveRiskLevel(100)).toBe('Critical');
    });
  });

  describe('deriveMergeDecision', () => {
    it('blocks merge when critical findings exist', () => {
      const decision = engine.deriveMergeDecision(10, 1, 0);
      expect(decision.recommendation).toBe('Block merge');
      expect(decision.explanation).toContain('critical');
    });

    it('blocks merge with multiple criticals', () => {
      const decision = engine.deriveMergeDecision(90, 3, 2);
      expect(decision.recommendation).toBe('Block merge');
      expect(decision.explanation).toContain('3 critical issues');
    });

    it('caution when 3+ high findings', () => {
      const decision = engine.deriveMergeDecision(20, 0, 3);
      expect(decision.recommendation).toBe('Merge with caution');
      expect(decision.explanation).toContain('high severity');
    });

    it('caution when risk_score >= 60', () => {
      const decision = engine.deriveMergeDecision(60, 0, 1);
      expect(decision.recommendation).toBe('Merge with caution');
      expect(decision.explanation).toContain('risk score');
    });

    it('safe to merge when below all thresholds', () => {
      const decision = engine.deriveMergeDecision(25, 0, 2);
      expect(decision.recommendation).toBe('Safe to merge');
      expect(decision.explanation).toContain('Low risk');
    });

    it('critical count takes priority over score', () => {
      const decision = engine.deriveMergeDecision(5, 1, 0);
      expect(decision.recommendation).toBe('Block merge');
    });

    it('high count takes priority over score when >= 3', () => {
      const decision = engine.deriveMergeDecision(10, 0, 5);
      expect(decision.recommendation).toBe('Merge with caution');
    });
  });
});
