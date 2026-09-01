import { Simulation } from './engine';
import type { Dials } from './types';

export const BASE_DIALS: Dials = {
  workload: 'agentic-dev',
  clientTimeoutSec: 120,
  retryStrategy: 'aggressive',
  numUsers: 8,
  admissionLimit: 999,
  prefillServers: 6,
};

describe('Simulation core', () => {
  it('derives decode servers from GPU budget at 2.5:1', () => {
    const sim = new Simulation({ ...BASE_DIALS, prefillServers: 6 }, 1);
    // 24 - 6*2.5 = 9 GPUs -> 9 decode servers * 8 slots
    expect(sim.decodeServers).toBe(9);
    expect(sim.decodeSlotsTotal).toBe(72);
    expect(sim.prefillSlotsTotal).toBe(48);
  });

  it('active users issue requests into the pipeline on first tick', () => {
    const sim = new Simulation({ ...BASE_DIALS, numUsers: 3 }, 1);
    sim.tick(0.25);
    expect(sim.admittedCount).toBe(3);
  });

  it('admission gate rejects instantly above the limit and schedules retries', () => {
    const sim = new Simulation({ ...BASE_DIALS, numUsers: 5, admissionLimit: 2 }, 1);
    const m = sim.tick(0.25);
    expect(sim.admittedCount).toBe(2);
    expect(m.rejectedAdmission).toBe(3);
    expect(m.retriesScheduled).toBe(3);
  });

  it('aggressive retry strategy retries more often than patient', () => {
    const run = (retryStrategy: Dials['retryStrategy']) => {
      const sim = new Simulation(
        { ...BASE_DIALS, numUsers: 4, admissionLimit: 0, retryStrategy },
        7,
      );
      let retries = 0;
      for (let i = 0; i < 4 * 600; i++) retries += sim.tick(0.25).retriesScheduled; // 10 sim-min
      return retries;
    };
    expect(run('aggressive')).toBeGreaterThan(run('patient') * 2);
  });

  it('scenario driver overrides numUsers dial', () => {
    const sim = new Simulation({ ...BASE_DIALS, numUsers: 50 }, 1);
    sim.setTargetActiveUsers(2);
    sim.tick(0.25);
    expect(sim.admittedCount).toBe(2);
  });
});

describe('scenario score counters', () => {
  it('totals delivered and wasted tokens across the run (wasted = computed - delivered)', () => {
    const sim = new Simulation({
      workload: 'chat', clientTimeoutSec: 120, retryStrategy: 'aggressive',
      numUsers: 6, admissionLimit: 100_000, prefillServers: 6,
    }, 3);
    for (let i = 0; i < 4 * 600; i++) sim.tick(0.25);
    const delivered = sim.history.reduce((a, m) => a + m.deliveredTok, 0);
    const computed = sim.history.reduce((a, m) => a + m.computedLiveTok + m.computedGhostTok, 0);
    expect(delivered).toBeGreaterThan(0);
    expect(sim.totalDeliveredTok).toBeCloseTo(delivered, 3);
    expect(sim.totalWastedTok).toBeCloseTo(computed - delivered, 3);
    expect(sim.totalWastedTok).toBeGreaterThanOrEqual(0);
  });
});
