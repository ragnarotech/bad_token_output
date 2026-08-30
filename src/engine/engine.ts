import {
  Constants, DEFAULT_CONSTANTS, Dials, PipelineSnapshot,
  SimRequest, TickMetrics, UserAgent,
} from './types';
import { mulberry32 } from './rng';
import { WORKLOADS } from './workloads';

const HISTORY_LIMIT = 400_000;

function newTickMetrics(t: number, sim: Simulation): TickMetrics {
  return {
    t,
    computedLiveTok: 0, computedGhostTok: 0, theoreticalMaxTok: 0, deliveredTok: 0,
    rejectedAdmission: 0, deadDecodeQueue: 0, deadPrefillQueue: 0,
    clientAbandons: 0, retriesScheduled: 0, giveUps: 0,
    decodeQueueDepth: 0, prefillQueueDepth: 0,
    decodeSlotsHeld: 0, decodeSlotsTotal: sim.decodeSlotsTotal,
    prefillSlotsBusy: 0, prefillSlotsTotal: sim.prefillSlotsTotal,
    activeUsers: sim.activeUserTarget,
    ttftSamples: [], tpotSamples: [],
  };
}

export class Simulation {
  simTime = 0;
  /** Cumulative give-ups: each one is a help ticket in the devops queue. */
  totalGiveUps = 0;
  history: TickMetrics[] = [];
  readonly constants: Constants;
  dials: Dials;
  readonly users: UserAgent[] = [];
  decodeQueue: SimRequest[] = [];
  prefillQueue: SimRequest[] = [];
  prefilling: SimRequest[] = [];
  decoding: SimRequest[] = [];
  private rng: () => number;
  private nextRequestId = 1;
  private targetActiveUsers: number | null = null;

  constructor(dials: Dials, seed: number, constants: Constants = DEFAULT_CONSTANTS) {
    this.dials = { ...dials };
    this.constants = constants;
    this.rng = mulberry32(seed);
  }

  setDials(patch: Partial<Dials>): void { this.dials = { ...this.dials, ...patch }; }
  setTargetActiveUsers(n: number | null): void { this.targetActiveUsers = n; }

  get decodeServers(): number {
    const c = this.constants;
    const gpusLeft = c.gpuBudget - this.dials.prefillServers * c.gpusPerPrefillServer;
    return Math.max(0, Math.floor(gpusLeft / c.gpusPerDecodeServer));
  }
  get decodeSlotsTotal(): number { return this.decodeServers * this.constants.slotsPerDecodeServer; }
  get prefillSlotsTotal(): number { return this.dials.prefillServers * this.constants.slotsPerPrefillServer; }
  get admittedCount(): number {
    return this.decodeQueue.length + this.prefillQueue.length +
      this.prefilling.length + this.decoding.length;
  }
  get activeUserTarget(): number { return this.targetActiveUsers ?? this.dials.numUsers; }

  tick(dt: number): TickMetrics {
    this.simTime += dt;
    const m = newTickMetrics(this.simTime, this);
    this.emitRequests(m);
    this.finalizeMetrics(m, dt);
    this.history.push(m);
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, 50_000);
    return m;
  }

  // --- users & admission -------------------------------------------------

  private ensureUsers(n: number): void {
    while (this.users.length < n) {
      this.users.push({
        id: this.users.length, nextRequestAt: 0, pending: null,
        attempt: 0, retryPromptTokens: null, retryOutputTokens: null,
      });
    }
  }

  private emitRequests(m: TickMetrics): void {
    const target = this.activeUserTarget;
    this.ensureUsers(target);
    const w = WORKLOADS[this.dials.workload];
    for (let i = 0; i < target; i++) {
      const u = this.users[i];
      if (u.pending !== null || u.nextRequestAt > this.simTime) continue;
      const promptTokens = u.retryPromptTokens ?? w.samplePromptTokens(this.rng);
      const outputTokens = u.retryOutputTokens ?? w.sampleOutputTokens(this.rng);
      const req: SimRequest = {
        id: this.nextRequestId++, userId: u.id, promptTokens, outputTokens,
        createdAt: this.simTime, phase: 'decodeQueue', phaseEnteredAt: this.simTime,
        prefillDoneTok: 0, decodeDoneTok: 0, clientAbandonedAt: null,
        ttftSec: null, attempt: u.attempt,
      };
      if (this.admittedCount >= this.dials.admissionLimit) {
        req.phase = 'rejectedAdmission';
        m.rejectedAdmission += 1;
        this.scheduleRetry(u, req, m);
      } else {
        u.pending = req;
        this.decodeQueue.push(req);
      }
    }
  }

  private scheduleRetry(
    u: UserAgent, req: { promptTokens: number; outputTokens: number }, m: TickMetrics,
  ): void {
    u.attempt += 1;
    if (u.attempt > this.constants.clientMaxRetries) {
      // Claude Code default: 10 retries, then the client gives up on this request.
      // The user comes back from a meeting to a dead session -> a help ticket.
      m.giveUps += 1;
      this.totalGiveUps += 1;
      this.completeUser(u); // user moves on to new work after think time
      return;
    }
    u.retryPromptTokens = req.promptTokens;
    u.retryOutputTokens = req.outputTokens;
    const capSec = this.dials.retryStrategy === 'aggressive' ? 10 : 300;
    const backoff = Math.min(Math.pow(2, u.attempt - 1), capSec) * (0.5 + this.rng());
    u.nextRequestAt = this.simTime + backoff;
    u.pending = null;
    m.retriesScheduled += 1;
  }

  private completeUser(u: UserAgent): void {
    const w = WORKLOADS[this.dials.workload];
    u.pending = null;
    u.attempt = 0;
    u.retryPromptTokens = null;
    u.retryOutputTokens = null;
    u.nextRequestAt = this.simTime + w.thinkTimeSec(this.rng);
  }

  // --- metrics -----------------------------------------------------------

  private finalizeMetrics(m: TickMetrics, dt: number): void {
    m.decodeQueueDepth = this.decodeQueue.length;
    m.prefillQueueDepth = this.prefillQueue.length;
    m.decodeSlotsHeld = this.prefillQueue.length + this.prefilling.length + this.decoding.length;
    m.prefillSlotsBusy = this.prefilling.length;
    m.theoreticalMaxTok =
      (this.dials.prefillServers * this.constants.prefillTokPerSecPerServer +
        this.decodeServers * this.constants.decodeTokPerSecPerServer) * dt;
  }

  snapshot(): PipelineSnapshot {
    return {
      simTime: this.simTime,
      admittedCount: this.admittedCount,
      admissionLimit: this.dials.admissionLimit,
      decodeQueueDepth: this.decodeQueue.length,
      oldestDecodeWaitSec: this.decodeQueue.length
        ? this.simTime - this.decodeQueue[0].phaseEnteredAt : 0,
      prefillQueueDepth: this.prefillQueue.length,
      oldestPrefillWaitSec: this.prefillQueue.length
        ? this.simTime - this.prefillQueue[0].phaseEnteredAt : 0,
      decodeSlotsHeld: this.prefillQueue.length + this.prefilling.length + this.decoding.length,
      decodeSlotsTotal: this.decodeSlotsTotal,
      prefillSlotsBusy: this.prefilling.length,
      prefillSlotsTotal: this.prefillSlotsTotal,
      decodeServers: this.decodeServers,
      prefillServers: this.dials.prefillServers,
    };
  }
}
