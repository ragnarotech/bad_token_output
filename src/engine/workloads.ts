import type { WorkloadPreset } from './types';

export interface Workload {
  id: WorkloadPreset;
  label: string;
  samplePromptTokens(rng: () => number): number;
  sampleOutputTokens(rng: () => number): number;
  thinkTimeSec(rng: () => number): number;
}

export const WORKLOADS: Record<WorkloadPreset, Workload> = {
  'agentic-dev': {
    id: 'agentic-dev',
    label: 'Agentic dev (huge prompts, heavy thinking)',
    // pow < 1 skews toward the 1M cap: one org's skew, undiluted (spec §4)
    samplePromptTokens: (rng) => Math.round(50_000 + 950_000 * Math.pow(rng(), 0.35)),
    // Output = a small visible answer (200-2K) plus the thinking budget the org
    // actually ran with: 32K minimum, 128K maximum. Thinking is decode work the
    // user never reads but the GPU still has to produce before the first
    // visible token. Modeled as budget = spend (uniform); if real spend ran
    // well under budget, lower the range here — one line.
    sampleOutputTokens: (rng) =>
      Math.round(200 + 1_800 * rng()) + Math.round(32_000 + 96_000 * rng()),
    thinkTimeSec: (rng) => 5 + 25 * rng(),
  },
  chat: {
    id: 'chat',
    label: 'Chat (medium prompts, medium outputs)',
    samplePromptTokens: (rng) => Math.round(2_000 + 18_000 * rng()),
    sampleOutputTokens: (rng) => Math.round(200 + 1_300 * rng()),
    thinkTimeSec: (rng) => 20 + 60 * rng(),
  },
};
