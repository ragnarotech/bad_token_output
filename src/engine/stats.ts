import type { TickMetrics } from './types';

export function goodputPctWindow(
  history: TickMetrics[], tStartSec: number, tEndSec: number,
): number {
  let delivered = 0;
  let computed = 0;
  for (const m of history) {
    if (m.t < tStartSec || m.t > tEndSec) continue;
    delivered += m.deliveredTok;
    computed += m.computedLiveTok + m.computedGhostTok;
  }
  return computed === 0 ? 100 : Math.min(100, (100 * delivered) / computed);
}

export function rollingGoodputPct(history: TickMetrics[], windowSec: number): number {
  const tEnd = history.length ? history[history.length - 1].t : 0;
  return goodputPctWindow(history, tEnd - windowSec, tEnd);
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
