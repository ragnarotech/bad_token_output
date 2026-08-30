import { Simulation } from '../engine/engine';
import { evalNarrator } from './narrator';
import { SCENARIOS } from './index';
import { rushHourUsers } from './loadCurves';

describe('scenarios', () => {
  it('rush hour curve matches the true story', () => {
    expect(rushHourUsers(2 * 3600)).toBe(4);
    expect(rushHourUsers(12 * 3600)).toBe(80);
    expect(rushHourUsers(16 * 3600)).toBeLessThan(50);
    expect(rushHourUsers(20 * 3600)).toBe(6);
  });

  it('narrator lines fire once', () => {
    const scn = SCENARIOS['rush-hour'];
    const sim = new Simulation(scn.initialDials, scn.seed);
    const fired = new Set<string>();
    for (let i = 0; i < 4 * 90; i++) sim.tick(0.25); // 90 sim-sec => 'welcome' due
    const first = evalNarrator(scn, sim, fired);
    expect(first.some((msg) => msg.id === 'welcome')).toBe(true);
    const second = evalNarrator(scn, sim, fired);
    expect(second.some((msg) => msg.id === 'welcome')).toBe(false);
  });

  it('all scenarios expose valid dials and unique narrator ids', () => {
    for (const scn of Object.values(SCENARIOS)) {
      expect(scn.initialDials.prefillServers).toBeGreaterThanOrEqual(0);
      const ids = scn.narrator.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
