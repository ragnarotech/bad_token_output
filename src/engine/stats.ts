import type { TickMetrics } from './types';

// History is time-ordered, so both window sums walk back from the tail and stop
// at the window start. Narrator predicates poll rolling windows every tick for
// as long as they have not fired; a front-to-back scan made a healthy (gated)
// day O(ticks x history) — 421s of engine time for a 14h day vs 0.14s.
export function goodputPctWindow(
  history: TickMetrics[], tStartSec: number, tEndSec: number,
): number {
  let delivered = 0;
  let computed = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.t > tEndSec) continue;
    if (m.t < tStartSec) break;
    delivered += m.deliveredTok;
    computed += m.computedLiveTok + m.computedGhostTok;
  }
  return computed === 0 ? 100 : Math.min(100, (100 * delivered) / computed);
}

export interface WindowTotals { deliveredTok: number; theoreticalTok: number; giveUps: number }

/** Delivered tokens, theoretical capacity and give-ups (help tickets) inside [tStart, tEnd]. */
export function windowTotals(
  history: TickMetrics[], tStartSec: number, tEndSec: number,
): WindowTotals {
  const out: WindowTotals = { deliveredTok: 0, theoreticalTok: 0, giveUps: 0 };
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.t > tEndSec) continue;
    if (m.t < tStartSec) break;
    out.deliveredTok += m.deliveredTok;
    out.theoreticalTok += m.theoreticalMaxTok;
    out.giveUps += m.giveUps;
  }
  return out;
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
