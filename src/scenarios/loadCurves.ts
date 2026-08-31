/** Active-user count over a 24h sim day (t in seconds). The true story: spec §6. */
export function rushHourUsers(tSec: number): number {
  const h = tSec / 3600;
  const lerp = (a: number, b: number, x: number) => a + (b - a) * Math.max(0, Math.min(1, x));
  if (h < 7) return 4;                       // overnight cron traffic
  if (h < 9) return Math.round(lerp(4, 20, (h - 7) / 2));
  if (h < 11) return Math.round(lerp(20, 80, (h - 9) / 2));
  if (h < 15) return 80;                     // the grinding hours
  if (h < 17) return Math.round(lerp(80, 10, (h - 15) / 2));
  return 6;
}

/**
 * Steady healthy load (base alone gives near-full goodput) with a 10-minute
 * demand spike. Re-calibrated when thinking budgets landed: long decodes make
 * the decode slots a natural throttle, so it takes a bigger, longer spike to
 * tip the system — but once tipped, retries plus zombie work for abandoned
 * clients keep it pinned long after demand is back at baseline (metastable
 * failure, spec §7 inv5), and an admission gate turns the same spike into ten
 * minutes of cheap 529s.
 */
export const SPIKE_START_SEC = 180;
export const SPIKE_END_SEC = 780;
export function spikeUsers(tSec: number): number {
  if (tSec >= SPIKE_START_SEC && tSec < SPIKE_END_SEC) return 200;
  return 35;
}
