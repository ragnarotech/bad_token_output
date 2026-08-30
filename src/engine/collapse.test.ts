import { Simulation } from './engine';
import { goodputPctWindow } from './stats';
import { rushHourUsers } from '../scenarios/loadCurves';
import type { Dials } from './types';

const H = 3600;
const RUSH_DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 120, retryStrategy: 'aggressive',
  numUsers: 0, admissionLimit: 100_000, prefillServers: 6,
};

function runDay(dials: Dials, hours: number, curve: (t: number) => number): Simulation {
  const sim = new Simulation(dials, 42);
  const steps = Math.round((hours * H) / 0.25);
  for (let i = 0; i < steps; i++) {
    sim.setTargetActiveUsers(curve(sim.simTime));
    sim.tick(0.25);
  }
  return sim;
}

describe('collapse invariants (spec §7) — the gate before any UI', () => {
  it('inv1: light load => near-full goodput', () => {
    const sim = runDay(RUSH_DIALS, 2, () => 6);
    expect(goodputPctWindow(sim.history, 0.5 * H, 2 * H)).toBeGreaterThan(85);
  }, 60_000);

  it('inv2: ungated rush hour collapses and does NOT recover while load persists', () => {
    const sim = runDay(RUSH_DIALS, 15, rushHourUsers);
    const atNoon = goodputPctWindow(sim.history, 12 * H, 13 * H);
    const midAfternoon = goodputPctWindow(sim.history, 14 * H, 15 * H);
    const morning = goodputPctWindow(sim.history, 8 * H, 9.5 * H);
    expect(morning).toBeGreaterThan(50);      // oversubscribed but limping along
    expect(atNoon).toBeLessThan(25);          // collapsed
    expect(midAfternoon).toBeLessThan(30);    // still collapsed: metastable
  }, 120_000);

  it('inv3: the admission gate saves the same day', () => {
    const sim = runDay({ ...RUSH_DIALS, admissionLimit: 60 }, 15, rushHourUsers);
    expect(goodputPctWindow(sim.history, 9 * H, 15 * H)).toBeGreaterThan(60);
  }, 120_000);

  it('inv4: P:D split is maximizable — gated agentic-dev rewards more prefill', () => {
    // The 'CEO wants TPMs' check: equal-ish splits are the easy answer,
    // but prefill-heavy delivers more useful tokens under huge-prompt load.
    const sum = (s: Simulation) => s.history.reduce((a, m) => a + m.deliveredTok, 0);
    const lo = runDay({ ...RUSH_DIALS, admissionLimit: 60, prefillServers: 4 }, 15, rushHourUsers);
    const hi = runDay({ ...RUSH_DIALS, admissionLimit: 60, prefillServers: 7 }, 15, rushHourUsers);
    expect(sum(hi)).toBeGreaterThan(sum(lo));
  }, 240_000);
});
