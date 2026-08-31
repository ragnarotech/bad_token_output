import { goodputPctWindow, windowTotals } from '../engine/stats';
import type { TickMetrics } from '../engine/types';
import type { WinCondition } from './types';

export interface Verdict { won: boolean; text: string }

/**
 * A win means every headline number is green over the window, in the order
 * an operator reads the console: goodput %, then useful TPM against
 * theoretical, then help tickets. Goodput % alone is gameable — admit almost
 * nothing and every computed token is delivered — so a "win" that starves the
 * org or buries the devops queue in tickets is not one.
 */
export function evaluateWin(history: TickMetrics[], win: WinCondition): Verdict {
  const { windowStartSec: a, windowEndSec: b } = win;
  if (goodputPctWindow(history, a, b) < win.minGoodputPct) return { won: false, text: win.loseText };
  const tot = windowTotals(history, a, b);
  const usefulPct = tot.theoreticalTok === 0 ? 100 : (100 * tot.deliveredTok) / tot.theoreticalTok;
  if (usefulPct < win.minUsefulPctOfTheoretical) return { won: false, text: win.starvedText };
  if (tot.giveUps > win.maxHelpTickets) return { won: false, text: win.ticketsText };
  return { won: true, text: win.winText };
}
