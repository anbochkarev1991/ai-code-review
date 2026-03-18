import { riskSummaryFromCounts } from 'shared';

describe('riskSummaryFromCounts', () => {
  const critical =
    'High risk – contains critical issues affecting core functionality or system behavior.';
  const highMultiple =
    'Moderate to high risk due to multiple high-severity issues.';
  const highOne = 'Moderate risk with one high-severity issue.';
  const low = 'Low to moderate risk with no high-severity issues.';

  it('returns critical summary when critical_count >= 1', () => {
    expect(
      riskSummaryFromCounts({
        critical_count: 1,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
      }),
    ).toBe(critical);
    expect(
      riskSummaryFromCounts({
        critical_count: 1,
        high_count: 3,
        medium_count: 5,
        low_count: 10,
      }),
    ).toBe(critical);
  });

  it('returns high-multiple summary when high_count >= 2 and no critical', () => {
    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 2,
        medium_count: 0,
        low_count: 0,
      }),
    ).toBe(highMultiple);
    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 5,
        medium_count: 1,
        low_count: 0,
      }),
    ).toBe(highMultiple);
  });

  it('returns high-one summary when high_count === 1 and no critical', () => {
    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 1,
        medium_count: 0,
        low_count: 0,
      }),
    ).toBe(highOne);
    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 1,
        medium_count: 10,
        low_count: 20,
      }),
    ).toBe(highOne);
  });

  it('returns low summary when no critical and no high', () => {
    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
      }),
    ).toBe(low);
    expect(
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 0,
        medium_count: 5,
        low_count: 3,
      }),
    ).toBe(low);
  });

  it('does not reference medium or low severity counts in summary text', () => {
    const results = [
      riskSummaryFromCounts({
        critical_count: 1,
        high_count: 0,
        medium_count: 1,
        low_count: 1,
      }),
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 2,
        medium_count: 1,
        low_count: 1,
      }),
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 1,
        medium_count: 1,
        low_count: 1,
      }),
      riskSummaryFromCounts({
        critical_count: 0,
        high_count: 0,
        medium_count: 1,
        low_count: 1,
      }),
    ];
    for (const r of results) {
      expect(r).not.toMatch(/\bmedium\b/i);
      expect(r).not.toMatch(/low-severity|low severity/i);
    }
  });
});
