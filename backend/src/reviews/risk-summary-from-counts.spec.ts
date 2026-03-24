import { riskSummaryFromCounts } from 'shared';

describe('riskSummaryFromCounts', () => {
  it('matches decideMerge explanation for the same inputs', () => {
    expect(
      riskSummaryFromCounts({
        critical_count: 1,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        risk_score: 0,
      }),
    ).toContain('Blocked due to');

    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 2,
        medium_count: 0,
        low_count: 0,
        risk_score: 20,
      }),
    ).toContain('high severity');

    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 0,
        medium_count: 3,
        low_count: 0,
        risk_score: 25,
      }),
    ).toContain('medium severity');

    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        risk_score: 0,
      }),
    ).toContain('No significant issues');
  });
});
