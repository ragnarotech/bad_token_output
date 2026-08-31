import type { Simulation } from '../engine/engine';
import type { Dials, TickMetrics } from '../engine/types';

export interface NarratorCtx { t: number; sim: Simulation; last: TickMetrics | undefined }
export interface NarratorLine { id: string; text: string; when: (ctx: NarratorCtx) => boolean }
export interface NarratorMsg { id: string; t: number; text: string }
export interface WinCondition {
  windowStartSec: number; windowEndSec: number;
  minGoodputPct: number;              // headline GOODPUT %
  minUsefulPctOfTheoretical: number;  // useful TPM as % of theoretical — a starved cluster is no win
  maxHelpTickets: number;             // give-ups inside the window — a ticket storm is no win
  winText: string; loseText: string; starvedText: string; ticketsText: string;
}
export interface Scenario {
  id: 'rush-hour' | 'spike' | 'free-play';
  name: string;
  blurb: string;
  seed: number;
  durationSec: number;
  clockStartHour: number;
  defaultSpeed: number;
  initialDials: Dials;
  loadCurve: ((tSec: number) => number) | null;
  narrator: NarratorLine[];
  win?: WinCondition;
}
