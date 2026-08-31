import { rollingGoodputPct } from '../engine/stats';
import { rushHourUsers } from './loadCurves';
import type { Scenario } from './types';

const H = 3600;

export const rushHour: Scenario = {
  id: 'rush-hour',
  name: 'Rush Hour',
  blurb: 'A true story: one air-gapped cluster, one org of agentic-dev users, one very bad Tuesday.',
  seed: 42,
  durationSec: 14 * H,
  clockStartHour: 6,
  defaultSpeed: 480, // 14h day in ~1.75 wall-minutes
  initialDials: {
    workload: 'agentic-dev', clientTimeoutSec: 120, retryStrategy: 'aggressive',
    numUsers: 0, admissionLimit: 100_000, prefillServers: 6,
  },
  loadCurve: (t) => rushHourUsers(t + 6 * H),
  narrator: [
    { id: 'welcome', text: '6 AM. Cron jobs hum along. Watch the pipeline: requests take a decode slot FIRST, then wait for prefill. Remember that.', when: ({ t }) => t > 60 },
    { id: 'ramp', text: '9 AM. The org logs on. Every request is an agentic-dev monster: prompts up to 1M tokens, outputs tiny.', when: ({ t }) => t > 3 * H },
    { id: 'oversub', text: '10 AM. Demand now exceeds supply — but goodput is still decent. Are we fine? We are not fine.', when: ({ t }) => t > 4 * H },
    { id: 'tpm', text: 'The TPM counter is enormous and the officials are delighted. Look closer: only tokens that REACH a user count. The rest is very expensive heat.', when: ({ t, sim }) => t > 4.75 * H && rollingGoodputPct(sim.history, 600) < 60 },
    { id: 'collapse', text: 'Nothing is broken. Everything is busy. Goodput is cratering while every GPU reads 100%. Welcome to the worst kind of outage.', when: ({ t, sim }) => t > 4.5 * H && rollingGoodputPct(sim.history, 600) < 25 },
    { id: 'zombies', text: 'Look at the waste band: those are tokens computed for clients that hung up long ago. The queues are full of ghosts — and their retries.', when: ({ t, sim }) => t > 5 * H && rollingGoodputPct(sim.history, 600) < 20 },
    { id: 'tried-prefill', text: 'More prefill servers? You just took decode capacity to feed the same stampede. The bottleneck is not capacity — it is admission.', when: ({ sim }) => sim.dials.prefillServers > 7 },
    { id: 'tried-timeout', text: 'Longer client timeouts? Now they hold on longer before abandoning — and the zombie parade grows behind them. You cannot out-wait a stampede.', when: ({ sim }) => sim.dials.clientTimeoutSec > 240 },
    { id: 'gate', text: 'THERE it is. Failing cheap at the front door instead of expensive in the pipeline. Fewer requests in, more tokens out.', when: ({ t, sim }) => t > 4 * H && sim.dials.admissionLimit < 100 },
    { id: 'tickets', text: 'Ticket queue check: users who kicked off agentic runs and left for meetings are coming back to dead sessions. Every one of those is a help ticket, and every ticket is devops time you are not spending fixing THIS.', when: ({ sim }) => sim.totalGiveUps > 25 },
    { id: 'exodus', text: '3 PM. People are giving up and going home. In production, this was our fix. That is not a fix.', when: ({ t }) => t > 9 * H },
    { id: 'close', text: 'Day over. Run it again — this time the dials are yours. Hint: the hero dial is the one that says no.', when: ({ t }) => t > 13.5 * H },
  ],
  win: {
    windowStartSec: 3 * H, windowEndSec: 9 * H, minGoodputPct: 60,
    winText: 'You kept goodput above 60% through the crush — by admitting less. The org got more work done and nobody paged you.',
    loseText: 'Goodput fell below 60% across the working day. Try lowering the admission limit before the 11 AM wall.',
  },
};
