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
 * Steady healthy load (base alone gives near-full goodput) with a 3-minute
 * demand spike. Calibrated (Task 6 follow-up) so the spike, not the base
 * load, causes collapse — and the collapse outlasts the spike: retries plus
 * zombie work for abandoned clients keep the system pinned down long after
 * demand has returned to baseline (metastable failure, spec §7 inv5).
 */
export function spikeUsers(tSec: number): number {
  if (tSec >= 180 && tSec < 360) return 100;
  return 33;
}
