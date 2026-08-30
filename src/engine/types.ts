export type WorkloadPreset = 'agentic-dev' | 'chat';
export type RetryStrategy = 'aggressive' | 'patient';

/** Operator + client dials (spec §4). */
export interface Dials {
  workload: WorkloadPreset;
  clientTimeoutSec: number;   // 30..300
  retryStrategy: RetryStrategy;
  numUsers: number;           // free-play load; scenarios override via setTargetActiveUsers
  admissionLimit: number;     // hero dial: max concurrently admitted requests
  prefillServers: number;     // P:D split; decode servers derived from GPU budget
}

/** Frozen constants (spec §4). Values calibrated in Task 6, then frozen. */
export interface Constants {
  gpuBudget: number;
  gpusPerPrefillServer: number;
  gpusPerDecodeServer: number;
  slotsPerPrefillServer: number;
  slotsPerDecodeServer: number;
  queueTimeoutSec: number;
  clientMaxRetries: number;
  prefillTokPerSecPerServer: number;
  decodeTokPerSecPerServer: number;
}

export const DEFAULT_CONSTANTS: Constants = {
  gpuBudget: 24,
  gpusPerPrefillServer: 2.5,
  gpusPerDecodeServer: 1,
  slotsPerPrefillServer: 8,
  slotsPerDecodeServer: 8,
  queueTimeoutSec: 30,
  clientMaxRetries: 10,
  prefillTokPerSecPerServer: 75_000,
  decodeTokPerSecPerServer: 1_500,
};

export type RequestPhase =
  | 'decodeQueue'
  | 'prefillQueue'   // holds a decode slot from here on
  | 'prefilling'
  | 'decoding'
  | 'delivered'
  | 'rejectedAdmission'
  | 'deadDecodeQueue'
  | 'deadPrefillQueue';

export interface SimRequest {
  id: number;
  userId: number;
  promptTokens: number;
  outputTokens: number;
  createdAt: number;
  phase: RequestPhase;
  phaseEnteredAt: number;
  prefillDoneTok: number;
  decodeDoneTok: number;
  clientAbandonedAt: number | null; // set by watchdog; server keeps going (oblivious rule)
  ttftSec: number | null;           // createdAt -> prefill completion
  attempt: number;                  // 0 = first try
}

export interface UserAgent {
  id: number;
  nextRequestAt: number;
  pending: SimRequest | null;       // client-side view; null after abandon/complete
  attempt: number;
  retryPromptTokens: number | null; // frozen payload for retries of the same logical request
  retryOutputTokens: number | null;
}

export interface TickMetrics {
  t: number;
  computedLiveTok: number;
  computedGhostTok: number;
  theoreticalMaxTok: number;
  deliveredTok: number;
  rejectedAdmission: number;
  deadDecodeQueue: number;
  deadPrefillQueue: number;
  clientAbandons: number;
  retriesScheduled: number;
  giveUps: number;
  decodeQueueDepth: number;
  prefillQueueDepth: number;
  decodeSlotsHeld: number;
  decodeSlotsTotal: number;
  prefillSlotsBusy: number;
  prefillSlotsTotal: number;
  activeUsers: number;
  ttftSamples: number[];
  tpotSamples: number[];
}

export interface PipelineSnapshot {
  simTime: number;
  admittedCount: number;
  admissionLimit: number;
  decodeQueueDepth: number;
  oldestDecodeWaitSec: number;
  prefillQueueDepth: number;
  oldestPrefillWaitSec: number;
  decodeSlotsHeld: number;
  decodeSlotsTotal: number;
  prefillSlotsBusy: number;
  prefillSlotsTotal: number;
  decodeServers: number;
  prefillServers: number;
}
