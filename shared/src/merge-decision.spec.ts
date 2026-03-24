import { decideMerge } from './merge-decision';

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
