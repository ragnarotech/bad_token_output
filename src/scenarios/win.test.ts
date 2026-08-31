import { evaluateWin } from './win';
import type { WinCondition } from './types';
import type { TickMetrics } from '../engine/types';

function mk(t: number, delivered: number, computed: number, theo: number, giveUps = 0): TickMetrics {
  return {
    t, deliveredTok: delivered, computedLiveTok: computed, computedGhostTok: 0,
    theoreticalMaxTok: theo, rejectedAdmission: 0, deadDecodeQueue: 0, deadPrefillQueue: 0,
    clientAbandons: 0, retriesScheduled: 0, giveUps, decodeQueueDepth: 0, prefillQueueDepth: 0,
    decodeSlotsHeld: 0, decodeSlotsTotal: 0, prefillSlotsBusy: 0, prefillSlotsTotal: 0,
    activeUsers: 0, ttftSamples: [], tpotSamples: [],
  };
}
const WIN: WinCondition = {
  windowStartSec: 10, windowEndSec: 20, minGoodputPct: 60, minUsefulPctOfTheoretical: 60,
  maxHelpTickets: 5, winText: 'W', loseText: 'L', starvedText: 'S', ticketsText: 'T',
};

describe('evaluateWin — all three headline numbers must be green', () => {
  it('wins when goodput, useful-of-theoretical and tickets all clear', () => {
    const h = [mk(5, 0, 100, 100), mk(12, 90, 100, 100, 1), mk(18, 90, 100, 100, 1), mk(25, 0, 100, 100, 99)];
    expect(evaluateWin(h, WIN)).toEqual({ won: true, text: 'W' });
  });
  it('loses on goodput first', () => {
    const h = [mk(12, 30, 100, 100), mk(18, 30, 100, 100)];
    expect(evaluateWin(h, WIN)).toEqual({ won: false, text: 'L' });
  });
  it('a starved cluster (100% goodput, little delivered) is not a win', () => {
    const h = [mk(12, 10, 10, 100), mk(18, 10, 10, 100)];
    expect(evaluateWin(h, WIN)).toEqual({ won: false, text: 'S' });
  });
  it('a ticket storm inside the window is not a win', () => {
    const h = [mk(12, 90, 100, 100, 3), mk(18, 90, 100, 100, 3)];
    expect(evaluateWin(h, WIN)).toEqual({ won: false, text: 'T' });
  });
});
