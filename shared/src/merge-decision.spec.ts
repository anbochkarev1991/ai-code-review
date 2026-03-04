import { decideMerge } from './merge-decision';

describe('decideMerge', () => {
  it('blocks when critical_count > 0 (regardless of score)', () => {
    const result = decideMerge({ critical_count: 1, high_count: 0, risk_score: 0 });
    expect(result.recommendation).toBe('Merge blocked');
    expect(result.explanation).toContain('1 critical issue');
  });

  it('blocks with multiple criticals', () => {
    const result = decideMerge({ critical_count: 3, high_count: 5, risk_score: 95 });
    expect(result.recommendation).toBe('Merge blocked');
    expect(result.explanation).toContain('3 critical issues');
  });

  it('includes deterministic risk explanation for criticals', () => {
    const result = decideMerge({ critical_count: 1, high_count: 0, risk_score: 70 });
    expect(result.explanation).toContain('Risk score elevated due to presence of critical security finding.');
  });

  it('caution when high_count >= 3 (no criticals)', () => {
    const result = decideMerge({ critical_count: 0, high_count: 3, risk_score: 10 });
    expect(result.recommendation).toBe('Merge with caution');
    expect(result.explanation).toContain('3 high severity');
  });

  it('caution when risk_score >= 60 (no criticals, < 3 high)', () => {
    const result = decideMerge({ critical_count: 0, high_count: 1, risk_score: 60 });
    expect(result.recommendation).toBe('Merge with caution');
    expect(result.explanation).toContain('risk score 60/100');
  });

  it('safe to merge when all thresholds are below', () => {
    const result = decideMerge({ critical_count: 0, high_count: 2, risk_score: 59 });
    expect(result.recommendation).toBe('Safe to merge');
    expect(result.explanation).toContain('Low risk');
  });

  it('safe to merge for zero findings', () => {
    const result = decideMerge({ critical_count: 0, high_count: 0, risk_score: 0 });
    expect(result.recommendation).toBe('Safe to merge');
  });

  it('critical takes precedence over high count', () => {
    const result = decideMerge({ critical_count: 1, high_count: 10, risk_score: 99 });
    expect(result.recommendation).toBe('Merge blocked');
  });

  it('high count (>=3) takes precedence over score < 60', () => {
    const result = decideMerge({ critical_count: 0, high_count: 4, risk_score: 15 });
    expect(result.recommendation).toBe('Merge with caution');
  });

  it('is deterministic — same input always same output', () => {
    const input = { critical_count: 0, high_count: 2, risk_score: 45 };
    const r1 = decideMerge(input);
    const r2 = decideMerge(input);
    const r3 = decideMerge(input);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });
});
