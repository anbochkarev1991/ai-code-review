import type { Finding } from './review';
import {
  decideMerge,
  derivePrimaryRiskCategoryFromFindings,
  getReviewDecision,
} from './merge-decision';

function makeFinding(partial: Partial<Finding> & Pick<Finding, 'id' | 'severity' | 'category'>): Finding {
  return {
    title: 't',
    message: 'm',
    confidence: 0.8,
    ...partial,
  };
}

describe('decideMerge', () => {
  it('blocks when critical_count > 0 (regardless of score)', () => {
    const result = decideMerge({
      critical_count: 1,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      risk_score: 0,
    });
    expect(result.recommendation).toBe('Merge blocked');
    expect(result.verdict).toBe('blocked');
    expect(result.explanation).toContain('1 critical severity issue');
  });

  it('blocks with multiple criticals', () => {
    const result = decideMerge({
      critical_count: 3,
      high_count: 5,
      risk_score: 95,
    });
    expect(result.recommendation).toBe('Merge blocked');
    expect(result.explanation).toContain('3 critical severity issues');
  });

  it('caution when any high finding (no criticals)', () => {
    const result = decideMerge({
      critical_count: 0,
      high_count: 2,
      medium_count: 0,
      low_count: 0,
      risk_score: 10,
    });
    expect(result.recommendation).toBe('Merge with caution');
    expect(result.verdict).toBe('warning');
    expect(result.explanation).toContain('2 high severity');
  });

  it('caution when risk_score >= 60 (no criticals, no high)', () => {
    const result = decideMerge({
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      risk_score: 60,
    });
    expect(result.recommendation).toBe('Merge with caution');
    expect(result.verdict).toBe('warning');
    expect(result.explanation).toContain('60/100');
  });

  it('warnings when only medium issues and score < 60', () => {
    const result = decideMerge({
      critical_count: 0,
      high_count: 0,
      medium_count: 2,
      low_count: 0,
      risk_score: 30,
    });
    expect(result.recommendation).toBe('Safe to merge with warnings');
    expect(result.verdict).toBe('warning');
    expect(result.explanation).toContain('2 medium severity');
  });

  it('safe to merge when only low severity and score < 60', () => {
    const result = decideMerge({
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 5,
      risk_score: 20,
    });
    expect(result.recommendation).toBe('Safe to merge');
    expect(result.verdict).toBe('safe');
  });

  it('safe to merge for zero findings', () => {
    const result = decideMerge({
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      risk_score: 0,
    });
    expect(result.recommendation).toBe('Safe to merge');
    expect(result.verdict).toBe('safe');
  });

  it('critical takes precedence over high count', () => {
    const result = decideMerge({
      critical_count: 1,
      high_count: 10,
      risk_score: 99,
    });
    expect(result.recommendation).toBe('Merge blocked');
  });

  it('high takes precedence over score < 60', () => {
    const result = decideMerge({
      critical_count: 0,
      high_count: 1,
      risk_score: 15,
    });
    expect(result.recommendation).toBe('Merge with caution');
  });

  it('is deterministic — same input always same output', () => {
    const input = {
      critical_count: 0,
      high_count: 1,
      medium_count: 0,
      low_count: 0,
      risk_score: 45,
    };
    expect(decideMerge(input)).toEqual(decideMerge(input));
  });
});

describe('getReviewDecision', () => {
  it('matches decideMerge + counts + primary risk for non-empty findings', () => {
    const findings: Finding[] = [
      makeFinding({
        id: '1',
        severity: 'high',
        category: 'security',
        title: 'SQL risk',
      }),
      makeFinding({
        id: '2',
        severity: 'medium',
        category: 'performance',
        title: 'N+1',
      }),
    ];
    const rd = getReviewDecision(findings);
    const merge = decideMerge({
      critical_count: rd.severityCounts.critical,
      high_count: rd.severityCounts.high,
      medium_count: rd.severityCounts.medium,
      low_count: rd.severityCounts.low,
      risk_score: rd.riskScore,
    });
    expect(rd.recommendation).toBe(merge.recommendation);
    expect(rd.decision).toBe(merge.verdict);
    expect(rd.explanation).toBe(merge.explanation);
    expect(rd.severityCounts).toEqual({
      critical: 0,
      high: 1,
      medium: 1,
      low: 0,
    });
    expect(rd.primaryRisk).toBe('security');
  });

  it('empty findings: safe merge and zero score', () => {
    const rd = getReviewDecision([]);
    expect(rd.decision).toBe('safe');
    expect(rd.recommendation).toBe('Safe to merge');
    expect(rd.riskScore).toBe(0);
    expect(rd.primaryRisk).toBeUndefined();
    expect(rd.severityCounts).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
  });

  it('critical finding yields blocked verdict', () => {
    const rd = getReviewDecision([
      makeFinding({
        id: 'c1',
        severity: 'critical',
        category: 'security',
      }),
    ]);
    expect(rd.decision).toBe('blocked');
    expect(rd.recommendation).toBe('Merge blocked');
    expect(rd.severityCounts.critical).toBe(1);
  });
});

describe('derivePrimaryRiskCategoryFromFindings', () => {
  it('picks category with highest weighted score', () => {
    const cat = derivePrimaryRiskCategoryFromFindings([
      makeFinding({ id: 'a', severity: 'low', category: 'security' }),
      makeFinding({ id: 'b', severity: 'low', category: 'security' }),
      makeFinding({ id: 'c', severity: 'high', category: 'performance' }),
    ]);
    expect(cat).toBe('performance');
  });

  it('returns undefined for empty list', () => {
    expect(derivePrimaryRiskCategoryFromFindings([])).toBeUndefined();
  });
});
