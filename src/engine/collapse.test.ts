import { Simulation } from './engine';
import { goodputPctWindow } from './stats';
import { rushHourUsers, spikeUsers } from '../scenarios/loadCurves';
import { evaluateWin } from '../scenarios/win';
import { rushHour } from '../scenarios/rushHour';
import type { Dials } from './types';

const H = 3600;
const RUSH_DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 120, retryStrategy: 'aggressive',
  numUsers: 0, admissionLimit: 100_000, prefillServers: 6,
};

function runDay(
  dials: Dials, hours: number, curve: (t: number) => number, seed = 42,
): Simulation {
  const sim = new Simulation(dials, seed);
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

  it('inv5: a spike outlasts itself — metastable failure that does not self-heal', () => {
    // The Spike scenario's teaching claim: retries + zombie work for abandoned
    // clients become the load. Steady base is healthy on its own; the spike
    // (not mere overload) is what tips the system into a collapse that
    // persists long after demand is back at baseline, with no admission gate.
    const SPIKE_DIALS: Dials = {
      workload: 'agentic-dev', clientTimeoutSec: 60, retryStrategy: 'aggressive',
      numUsers: 0, admissionLimit: 100_000, prefillServers: 6,
    };
    const sim = runDay(SPIKE_DIALS, 1320 / H, spikeUsers, 1337);
    expect(goodputPctWindow(sim.history, 60, 170)).toBeGreaterThan(80);   // healthy before the spike
    expect(goodputPctWindow(sim.history, 1260, 1320)).toBeLessThan(30);  // still down 9 min after
    // ...and the gate turns the same spike into cheap 529s (The Spike's closing claim)
    const gated = runDay({ ...SPIKE_DIALS, admissionLimit: 60 }, 1320 / H, spikeUsers, 1337);
    expect(goodputPctWindow(gated.history, 1260, 1320)).toBeGreaterThan(60);
  }, 60_000);

  it('inv6: the Rush Hour win cannot be gamed by starving or by a ticket storm', () => {
    // Rush Hour's own frame: t=0 is 6 AM, win window 9 AM-3 PM.
    const day = (d: Partial<Dials>) =>
      runDay({ ...rushHour.initialDials, ...d }, 14, (t) => rushHourUsers(t + 6 * H), rushHour.seed);
    const win = rushHour.win!;
    expect(evaluateWin(day({ admissionLimit: 60 }).history, win).won).toBe(true);
    // P9:D1: 8 decode slots act as a free gate -> 100% goodput, ~9% of theoretical delivered
    expect(evaluateWin(day({ prefillServers: 9 }).history, win)).toEqual({ won: false, text: win.starvedText });
    // gate slammed to 20: goodput and TPM fine, thousands of dead sessions
    expect(evaluateWin(day({ admissionLimit: 20 }).history, win)).toEqual({ won: false, text: win.ticketsText });
    // no gate at all: the true story
    expect(evaluateWin(day({}).history, win)).toEqual({ won: false, text: win.loseText });
  }, 240_000);
});
