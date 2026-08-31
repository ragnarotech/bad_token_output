import { bucketize } from './chartData';
import type { TickMetrics } from '../engine/types';

function mk(t: number): TickMetrics {
  return {
    t, computedLiveTok: 25, computedGhostTok: 25, theoreticalMaxTok: 100, deliveredTok: 10,
    rejectedAdmission: 1, deadDecodeQueue: 0, deadPrefillQueue: 1, clientAbandons: 0,
    retriesScheduled: 2, giveUps: 0, decodeQueueDepth: 5, prefillQueueDepth: 3, decodeSlotsHeld: 4,
    decodeSlotsTotal: 8, prefillSlotsBusy: 2, prefillSlotsTotal: 4, activeUsers: 10,
    ttftSamples: [t], tpotSamples: [],
  };
}

describe('bucketize', () => {
  it('aggregates ticks into per-minute rates (TPM)', () => {
    const h: TickMetrics[] = [];
    for (let i = 1; i <= 40; i++) h.push(mk(i * 0.25)); // 10 sim-sec
    const pts = bucketize(h, 2, 100);
    expect(pts.length).toBe(5);
    const p = pts[0];
    expect(p.liveTpm).toBeCloseTo(6000);   // 25 tok * 8 ticks / 2 sec * 60
    expect(p.ghostTpm).toBeCloseTo(6000);
    expect(p.idleTpm).toBeCloseTo(12000);  // (100 max * 8 - live - ghost) / 2 sec * 60
    expect(p.deliveredTpm).toBeCloseTo(2400);
    expect(p.goodputPct).toBeCloseTo(100 * 80 / 400);
    expect(p.deep529).toBe(8);
    expect(p.shallow529).toBe(8);
  });
  it('caps bucket count by dropping oldest', () => {
    const h: TickMetrics[] = [];
    for (let i = 1; i <= 400; i++) h.push(mk(i * 0.25));
    expect(bucketize(h, 2, 10).length).toBe(10);
  });
});
