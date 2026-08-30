import { Simulation } from './engine';
import type { Constants, Dials } from './types';
import { DEFAULT_CONSTANTS } from './types';

const DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 3_600, retryStrategy: 'patient',
  numUsers: 1, admissionLimit: 999, prefillServers: 8,
};

function run(sim: Simulation, sec: number) {
  const sums = { delivered: 0, live: 0, ghost: 0, abandons: 0, retries: 0, ttft: [] as number[] };
  for (let i = 0; i < Math.round(sec / 0.25); i++) {
    const m = sim.tick(0.25);
    sums.delivered += m.deliveredTok;
    sums.live += m.computedLiveTok;
    sums.ghost += m.computedGhostTok;
    sums.abandons += m.clientAbandons;
    sums.retries += m.retriesScheduled;
    sums.ttft.push(...m.ttftSamples);
  }
  return sums;
}

describe('compute and delivery', () => {
  it('delivers a lone request: goodput == computed, TTFT recorded', () => {
    const sim = new Simulation(DIALS, 3);
    const s = run(sim, 600);
    expect(s.delivered).toBeGreaterThan(0);
    expect(s.ghost).toBe(0);
    expect(s.ttft.length).toBeGreaterThan(0);
    // every delivered token was computed for a live client
    expect(Math.abs(s.delivered - s.live)).toBeLessThan(s.delivered * 0.01);
  });

  it('shared throughput: 8 concurrent users deliver less per-user than 1', () => {
    const one = run(new Simulation(DIALS, 5), 900);
    const eight = run(new Simulation({ ...DIALS, numUsers: 8 }, 5), 900);
    expect(eight.delivered / 8).toBeLessThan(one.delivered);
  });

  it('watchdog: impatient client abandons, server computes for a ghost', () => {
    const slow: Constants = { ...DEFAULT_CONSTANTS, prefillTokPerSecPerServer: 500 };
    const sim = new Simulation({ ...DIALS, clientTimeoutSec: 30 }, 3, slow);
    const s = run(sim, 300);
    expect(s.abandons).toBeGreaterThan(0);
    expect(s.retries).toBeGreaterThan(0);
    expect(s.ghost).toBeGreaterThan(0); // oblivious server burned tokens for nobody
  });

  it('same seed => identical history', () => {
    const a = new Simulation({ ...DIALS, numUsers: 6 }, 11);
    const b = new Simulation({ ...DIALS, numUsers: 6 }, 11);
    for (let i = 0; i < 2_000; i++) { a.tick(0.25); b.tick(0.25); }
    expect(JSON.stringify(a.history[1_999])).toBe(JSON.stringify(b.history[1_999]));
  });
});
