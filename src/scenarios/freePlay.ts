import type { Scenario } from './types';

export const freePlay: Scenario = {
  id: 'free-play',
  name: 'Free Play',
  blurb: 'All dials yours. The ⚡ Surge button injects a demand spike on demand.',
  seed: 7,
  durationSec: Number.POSITIVE_INFINITY,
  clockStartHour: 9,
  defaultSpeed: 30,
  initialDials: {
    workload: 'agentic-dev', clientTimeoutSec: 120, retryStrategy: 'aggressive',
    numUsers: 40, admissionLimit: 100_000, prefillServers: 6,
  },
  loadCurve: null,
  narrator: [
    { id: 'first-deep-529', text: 'First deep 529: a request died waiting for prefill while HOLDING a decode slot. That slot fed nobody.', when: ({ last }) => (last?.deadPrefillQueue ?? 0) > 0 },
    { id: 'first-ghost', text: 'The red band has appeared: GPUs computing for clients that already hung up. The server cannot tell. It never could.', when: ({ last }) => (last?.computedGhostTok ?? 0) > 0 },
    { id: 'client-note', text: 'Tweaking client dials? In production you do not own those — you publish a best-practices doc and hope. The server dials are the ones you own.', when: () => false },
  ],
};
