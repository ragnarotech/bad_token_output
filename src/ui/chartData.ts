import { percentile } from '../engine/stats';
import type { TickMetrics } from '../engine/types';

export interface ChartPoint {
  t: number;
  liveTokPerSec: number; ghostTokPerSec: number; idleTokPerSec: number;
  goodputPct: number; deliveredTokPerSec: number; activeUsers: number;
  ttftP50: number; ttftP90: number;
  shallow529: number; deep529: number; abandons: number; retries: number; giveUps: number;
  decodeQueueDepth: number; prefillQueueDepth: number;
}

export function bucketize(
  history: TickMetrics[], bucketSec: number, maxBuckets: number,
): ChartPoint[] {
  const out: ChartPoint[] = [];
  const perBucket = Math.max(1, Math.round(bucketSec / 0.25));
  const start = Math.max(0, history.length - perBucket * maxBuckets);
  for (let i = start; i + perBucket <= history.length; i += perBucket) {
    let live = 0, ghost = 0, max = 0, delivered = 0, shallow = 0, deepDq = 0, deepPq = 0,
      abandons = 0, retries = 0, giveUps = 0;
    const ttft: number[] = [];
    for (let j = i; j < i + perBucket; j++) {
      const m = history[j];
      live += m.computedLiveTok; ghost += m.computedGhostTok; max += m.theoreticalMaxTok;
      delivered += m.deliveredTok; shallow += m.rejectedAdmission;
      deepDq += m.deadDecodeQueue; deepPq += m.deadPrefillQueue;
      abandons += m.clientAbandons; retries += m.retriesScheduled; giveUps += m.giveUps;
      ttft.push(...m.ttftSamples);
    }
    const last = history[i + perBucket - 1];
    const computed = live + ghost;
    out.push({
      t: last.t,
      liveTokPerSec: live / bucketSec,
      ghostTokPerSec: ghost / bucketSec,
      idleTokPerSec: Math.max(0, (max - live - ghost) / bucketSec),
      goodputPct: computed === 0 ? 100 : Math.min(100, (100 * delivered) / computed),
      deliveredTokPerSec: delivered / bucketSec,
      activeUsers: last.activeUsers,
      ttftP50: percentile(ttft, 50), ttftP90: percentile(ttft, 90),
      shallow529: shallow, deep529: deepDq + deepPq, abandons, retries, giveUps,
      decodeQueueDepth: last.decodeQueueDepth, prefillQueueDepth: last.prefillQueueDepth,
    });
  }
  return out;
}
