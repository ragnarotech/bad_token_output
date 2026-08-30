import { Simulation } from './engine';
import type { Constants, Dials } from './types';
import { DEFAULT_CONSTANTS } from './types';

const TINY: Constants = {
  ...DEFAULT_CONSTANTS,
  gpuBudget: 6,
  slotsPerDecodeServer: 2,
  slotsPerPrefillServer: 1,
  prefillTokPerSecPerServer: 0, // freeze compute so requests sit in place
  decodeTokPerSecPerServer: 0,
};

const DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 9_999, retryStrategy: 'patient',
  numUsers: 5, admissionLimit: 999, prefillServers: 2, // 2*2.5=5 of 6 GPUs -> 1 decode server
};

describe('pipeline promotion and timeouts', () => {
  it('promotes up to decode slots, then prefill slots', () => {
    const sim = new Simulation(DIALS, 1, TINY);
    sim.tick(0.25);
    // 1 decode server * 2 slots = 2 held; 2 prefill servers * 1 slot = 2 prefilling
    expect(sim.prefilling.length).toBe(2);
    expect(sim.prefillQueue.length).toBe(0);
    expect(sim.decodeQueue.length).toBe(3);
    expect(sim.decodeSlotsTotal).toBe(2);
  });

  it('kills decode-queue waiters after 30s and frees nothing (they held nothing)', () => {
    const sim = new Simulation(DIALS, 1, TINY);
    let dead = 0;
    for (let i = 0; i < 4 * 35; i++) dead += sim.tick(0.25).deadDecodeQueue; // 35 sim-sec
    expect(dead).toBe(3);
    // the 3 deaths were 529s to live clients -> their retries re-entered the queue (decode slots still full)
    expect(sim.decodeQueue.length).toBe(3);
  });

  it('kills prefill-queue waiters after 30s, freeing their decode slots', () => {
    // prefillServers 0 -> no prefill slots; all promoted requests stall in prefillQueue
    const sim = new Simulation({ ...DIALS, prefillServers: 0, numUsers: 3 }, 1, TINY);
    // gpuBudget 6 -> 6 decode servers * 2 slots = 12 slots; all 3 land in prefillQueue
    sim.tick(0.25);
    expect(sim.prefillQueue.length).toBe(3);
    let dead = 0;
    for (let i = 0; i < 4 * 35; i++) dead += sim.tick(0.25).deadPrefillQueue;
    expect(dead).toBeGreaterThanOrEqual(3); // originals (+ any retries that stalled and died)
    const snap = sim.snapshot();
    expect(snap.decodeSlotsHeld).toBeLessThanOrEqual(3);
  });
});
