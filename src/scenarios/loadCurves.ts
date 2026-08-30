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

/** Steady ~90% load with a 2-minute demand spike. */
export function spikeUsers(tSec: number): number {
  if (tSec >= 180 && tSec < 300) return 90;
  return 30;
}
