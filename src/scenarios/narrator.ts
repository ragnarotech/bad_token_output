import type { Simulation } from '../engine/engine';
import type { NarratorMsg, Scenario } from './types';

export function evalNarrator(
  scenario: Scenario, sim: Simulation, fired: Set<string>,
): NarratorMsg[] {
  const out: NarratorMsg[] = [];
  const ctx = { t: sim.simTime, sim, last: sim.history[sim.history.length - 1] };
  for (const line of scenario.narrator) {
    if (fired.has(line.id)) continue;
    if (line.when(ctx)) {
      fired.add(line.id);
      out.push({ id: line.id, t: sim.simTime, text: line.text });
    }
  }
  return out;
}
