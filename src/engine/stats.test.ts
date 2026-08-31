import { goodputPctWindow, percentile, rollingGoodputPct, windowTotals } from './stats';
import type { TickMetrics } from './types';

function mk(t: number, delivered: number, live: number, ghost: number): TickMetrics {
  return {
    t, deliveredTok: delivered, computedLiveTok: live, computedGhostTok: ghost,
    theoreticalMaxTok: 0, rejectedAdmission: 0, deadDecodeQueue: 0, deadPrefillQueue: 0,
    clientAbandons: 0, retriesScheduled: 0, giveUps: 0, decodeQueueDepth: 0, prefillQueueDepth: 0,
    decodeSlotsHeld: 0, decodeSlotsTotal: 0, prefillSlotsBusy: 0, prefillSlotsTotal: 0,
    activeUsers: 0, ttftSamples: [], tpotSamples: [],
  };
}

describe('stats', () => {
  it('goodputPctWindow computes delivered over computed in window', () => {
    const h = [mk(1, 100, 100, 0), mk(2, 0, 50, 50), mk(3, 50, 0, 100)];
    expect(goodputPctWindow(h, 1.5, 3)).toBeCloseTo(100 * 50 / 200);
  });
  it('returns 100 when nothing computed', () => {
    expect(goodputPctWindow([mk(1, 0, 0, 0)], 0, 2)).toBe(100);
  });
  it('rollingGoodputPct uses the tail window', () => {
    const h = [mk(1, 0, 0, 100), mk(100, 100, 100, 0)];
    expect(rollingGoodputPct(h, 10)).toBe(100);
  });
  it('windowTotals sums delivered, theoretical and give-ups inside the window only', () => {
    const h = [mk(1, 100, 0, 0), { ...mk(2, 10, 0, 0), theoreticalMaxTok: 50, giveUps: 2 }, mk(3, 1, 0, 0)];
    expect(windowTotals(h, 1.5, 2.5)).toEqual({ deliveredTok: 10, theoreticalTok: 50, giveUps: 2 });
  });
  it('percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([], 50)).toBe(0);
  });
});
