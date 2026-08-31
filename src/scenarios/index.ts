import { freePlay } from './freePlay';
import { rushHour } from './rushHour';
import { spike } from './spike';
import type { Scenario } from './types';

export const SCENARIOS: Record<Scenario['id'], Scenario> = {
  'rush-hour': rushHour,
  spike,
  'free-play': freePlay,
};
export type { Scenario, NarratorMsg, NarratorLine, NarratorCtx, WinCondition } from './types';
export { evalNarrator } from './narrator';
export { evaluateWin } from './win';
export type { Verdict } from './win';
