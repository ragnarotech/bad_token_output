import { fmtTok, fmtTok2, simClock } from './format';

describe('format', () => {
  it('fmtTok scales through K/M/B (scenario totals reach billions)', () => {
    expect(fmtTok(950)).toBe('950');
    expect(fmtTok(30_200_000)).toBe('30.2M');
    expect(fmtTok(8_975_400_000)).toBe('8.98B');
    expect(fmtTok2(8_975_400_000)).toBe('8.98B');
  });
  it('simClock wraps a 6 AM start', () => {
    expect(simClock(0, 6)).toBe('6:00 AM');
    expect(simClock(14 * 3600, 6)).toBe('8:00 PM');
  });
});
