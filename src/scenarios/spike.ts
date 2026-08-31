import { rollingGoodputPct } from '../engine/stats';
import { spikeUsers } from './loadCurves';
import type { Scenario } from './types';

export const spike: Scenario = {
  id: 'spike',
  name: 'The Spike',
  blurb: 'Load returns to normal. The system does not. Retries ARE the load.',
  seed: 1337,
  durationSec: 900,
  clockStartHour: 13,
  defaultSpeed: 15,
  initialDials: {
    workload: 'agentic-dev', clientTimeoutSec: 60, retryStrategy: 'aggressive',
    numUsers: 0, admissionLimit: 100_000, prefillServers: 6,
  },
  loadCurve: spikeUsers,
  narrator: [
    { id: 'steady', text: 'Steady state, ~90% of capacity. Comfortable. A little too comfortable.', when: ({ t }) => t > 30 },
    { id: 'hit', text: 'Spike. Triple the users for three minutes. Watch the queues.', when: ({ t }) => t > 185 },
    { id: 'over', text: 'The spike is OVER. Demand is back to normal. So why are the queues still growing?', when: ({ t }) => t > 375 },
    { id: 'why', text: 'Because the load is no longer your users — it is their retries, plus zombie work for clients that already gave up. The system is eating itself. This is metastable failure.', when: ({ t, sim }) => t > 420 && rollingGoodputPct(sim.history, 120) < 30 },
    { id: 'end', text: 'A 3-minute spike bought a permanent outage. An admission gate turns the same spike into 3 minutes of cheap 529s. Try it in Free Play — there is a Surge button.', when: ({ t }) => t > 840 },
  ],
};
