# Goodput Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static-site live operator console simulating an overloaded two-stage LLM serving pipeline, teaching that admitting fewer requests delivers more tokens.

**Architecture:** A pure, zero-dependency TypeScript simulation engine (fixed 250ms timestep, seeded RNG, request state machine with slot-holding and oblivious servers) validated headlessly by "collapse must emerge" integration tests, with a React + Recharts console on top and scenarios defined as data (load curve + narrator script + win condition).

**Tech Stack:** Vite, React 18, TypeScript (strict), Recharts, Vitest (+ jsdom & @testing-library/react for one UI smoke test). Deploy: GitHub Pages via Actions.

**Spec:** `docs/superpowers/specs/2026-08-30-goodput-simulator-design.md` — read it before executing any task.

## Global Constraints

- `src/engine/` and `src/scenarios/` are pure TS: **zero runtime dependencies, no DOM/React imports**.
- Fixed timestep `dt = 0.25` sim-seconds everywhere; never vary it.
- All randomness flows through the seeded RNG owned by `Simulation`; same seed ⇒ byte-identical history.
- Frozen constants (spec §4) live only in `DEFAULT_CONSTANTS`; queue timeouts are 30s; prefill server costs 1.5 GPUs, decode 1.
- Oblivious-server rule: once admitted, a request never reacts to client disconnect (spec §3.3).
- Client watchdog triggers on TTFT only in v1 (no streaming toggle unless stretch time remains).
- UI dependencies limited to react, react-dom, recharts. No CSS framework; hand-written CSS.
- Metric definitions (refines spec §3.5/§5): the token-spend chart stacks **computed-for-live tok/s (green) + computed-for-ghost tok/s (red) + idle capacity (gray)** up to theoretical max; queue deaths carry no computed tokens and appear in the failure-depth chart (shallow 529 / dead-decode-queue / dead-prefill-queue / client abandons). Headline **Goodput % = delivered tokens ÷ (live+ghost computed tokens)** over a rolling 60 sim-second window.
- Commit after every green test cycle. Run `npx vitest run` (all tests) before each commit.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/scaffold.test.ts`
- Modify: `.gitignore` (append `node_modules/`, `dist/`)

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm run dev`, `npm run build`, `npm test` (vitest). Later tasks assume `npx vitest run <file>` works and `@/`-free relative imports.

- [ ] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "goodput-simulator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.3"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```
(If TS complains about the `test` key, add `/// <reference types="vitest/config" />` at the top.)

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Goodput Simulator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <h1>The Goodput Simulator</h1>;
}
```

`src/index.css`:
```css
:root { color-scheme: dark; }
body { margin: 0; background: #0d1117; color: #e6edf3; font-family: system-ui, sans-serif; }
```

`src/scaffold.test.ts`:
```ts
describe('scaffold', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Install and verify**

Run: `npm install && npx vitest run && npm run build`
Expected: 1 test passes; build emits `dist/`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src .gitignore
git commit -m "feat: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: RNG, types, workloads

**Files:**
- Create: `src/engine/rng.ts`, `src/engine/types.ts`, `src/engine/workloads.ts`
- Test: `src/engine/rng.test.ts`, `src/engine/workloads.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `mulberry32(seed: number): () => number`; all types below (used verbatim by Tasks 3–11); `WORKLOADS: Record<WorkloadPreset, Workload>`; `DEFAULT_CONSTANTS: Constants`.

- [ ] **Step 1: Write failing tests**

`src/engine/rng.test.ts`:
```ts
import { mulberry32 } from './rng';

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('differs across seeds and stays in [0,1)', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
});
```

`src/engine/workloads.test.ts`:
```ts
import { mulberry32 } from './rng';
import { WORKLOADS } from './workloads';

describe('workloads', () => {
  it('agentic-dev samples stay in spec ranges', () => {
    const rng = mulberry32(7);
    const w = WORKLOADS['agentic-dev'];
    for (let i = 0; i < 500; i++) {
      const p = w.samplePromptTokens(rng);
      const o = w.sampleOutputTokens(rng);
      expect(p).toBeGreaterThanOrEqual(50_000);
      expect(p).toBeLessThanOrEqual(1_000_000);
      expect(o).toBeGreaterThanOrEqual(200);
      expect(o).toBeLessThanOrEqual(2_000);
    }
  });
  it('agentic-dev prompts skew large (mean above midpoint)', () => {
    const rng = mulberry32(7);
    const w = WORKLOADS['agentic-dev'];
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += w.samplePromptTokens(rng);
    expect(sum / 2000).toBeGreaterThan(525_000);
  });
  it('chat samples stay in ranges', () => {
    const rng = mulberry32(9);
    const w = WORKLOADS.chat;
    for (let i = 0; i < 500; i++) {
      const p = w.samplePromptTokens(rng);
      expect(p).toBeGreaterThanOrEqual(2_000);
      expect(p).toBeLessThanOrEqual(20_000);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/engine/rng.ts`:
```ts
/** Deterministic 32-bit PRNG. Same seed => same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/engine/types.ts`:
```ts
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
  prefillTokPerSecPerServer: number;
  decodeTokPerSecPerServer: number;
}

export const DEFAULT_CONSTANTS: Constants = {
  gpuBudget: 24,
  gpusPerPrefillServer: 1.5,
  gpusPerDecodeServer: 1,
  slotsPerPrefillServer: 4,
  slotsPerDecodeServer: 8,
  queueTimeoutSec: 30,
  prefillTokPerSecPerServer: 25_000,
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
```

`src/engine/workloads.ts`:
```ts
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
    label: 'Agentic dev (huge prompts, small outputs)',
    // pow < 1 skews toward the 1M cap: one org's skew, undiluted (spec §4)
    samplePromptTokens: (rng) => Math.round(50_000 + 950_000 * Math.pow(rng(), 0.35)),
    sampleOutputTokens: (rng) => Math.round(200 + 1_800 * rng()),
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): seeded RNG, core types, workload presets"
```

---

### Task 3: Simulation core — users, admission gate, retry scheduling

**Files:**
- Create: `src/engine/engine.ts`
- Test: `src/engine/engine.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `class Simulation` with: `constructor(dials: Dials, seed: number, constants?: Constants)`, `tick(dt: number): TickMetrics`, `setDials(patch: Partial<Dials>): void`, `setTargetActiveUsers(n: number | null): void`, `simTime: number`, `history: TickMetrics[]`, `readonly users: UserAgent[]`, public arrays `decodeQueue/prefillQueue/prefilling/decoding: SimRequest[]`, getters `decodeServers`, `decodeSlotsTotal`, `prefillSlotsTotal`, `admittedCount`, `activeUserTarget`. Later tasks extend `tick()` internals only — signatures above never change.

- [ ] **Step 1: Write failing tests**

`src/engine/engine.test.ts`:
```ts
import { Simulation } from './engine';
import type { Dials } from './types';

export const BASE_DIALS: Dials = {
  workload: 'agentic-dev',
  clientTimeoutSec: 120,
  retryStrategy: 'aggressive',
  numUsers: 8,
  admissionLimit: 999,
  prefillServers: 8,
};

describe('Simulation core', () => {
  it('derives decode servers from GPU budget at 1.5:1', () => {
    const sim = new Simulation({ ...BASE_DIALS, prefillServers: 8 }, 1);
    // 24 - 8*1.5 = 12 GPUs -> 12 decode servers * 8 slots
    expect(sim.decodeServers).toBe(12);
    expect(sim.decodeSlotsTotal).toBe(96);
    expect(sim.prefillSlotsTotal).toBe(32);
  });

  it('active users issue requests into the pipeline on first tick', () => {
    const sim = new Simulation({ ...BASE_DIALS, numUsers: 3 }, 1);
    sim.tick(0.25);
    expect(sim.admittedCount).toBe(3);
  });

  it('admission gate rejects instantly above the limit and schedules retries', () => {
    const sim = new Simulation({ ...BASE_DIALS, numUsers: 5, admissionLimit: 2 }, 1);
    const m = sim.tick(0.25);
    expect(sim.admittedCount).toBe(2);
    expect(m.rejectedAdmission).toBe(3);
    expect(m.retriesScheduled).toBe(3);
  });

  it('aggressive retry strategy retries more often than patient', () => {
    const run = (retryStrategy: Dials['retryStrategy']) => {
      const sim = new Simulation(
        { ...BASE_DIALS, numUsers: 4, admissionLimit: 0, retryStrategy },
        7,
      );
      let retries = 0;
      for (let i = 0; i < 4 * 600; i++) retries += sim.tick(0.25).retriesScheduled; // 10 sim-min
      return retries;
    };
    expect(run('aggressive')).toBeGreaterThan(run('patient') * 2);
  });

  it('scenario driver overrides numUsers dial', () => {
    const sim = new Simulation({ ...BASE_DIALS, numUsers: 50 }, 1);
    sim.setTargetActiveUsers(2);
    sim.tick(0.25);
    expect(sim.admittedCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: FAIL — `./engine` not found.

- [ ] **Step 3: Implement**

`src/engine/engine.ts`:
```ts
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
    clientAbandons: 0, retriesScheduled: 0,
    decodeQueueDepth: 0, prefillQueueDepth: 0,
    decodeSlotsHeld: 0, decodeSlotsTotal: sim.decodeSlotsTotal,
    prefillSlotsBusy: 0, prefillSlotsTotal: sim.prefillSlotsTotal,
    activeUsers: sim.activeUserTarget,
    ttftSamples: [], tpotSamples: [],
  };
}

export class Simulation {
  simTime = 0;
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
```

Note: `completeUser` and `snapshot` are used by Tasks 5 and 8; TS `noUnusedLocals` does not flag class members, so this compiles now.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): Simulation core — users, admission gate, retry backoff"
```

---

### Task 4: Pipeline — slot promotion and queue timeouts

**Files:**
- Modify: `src/engine/engine.ts` (extend `tick()`; add private methods `expireQueues`, `promote`)
- Test: `src/engine/pipeline.test.ts`

**Interfaces:**
- Consumes: Task 3's `Simulation` (public arrays + getters).
- Produces: `tick()` now expires queue entries older than 30s (phase `deadDecodeQueue`/`deadPrefillQueue`, counted in metrics, live clients scheduled to retry) and promotes decodeQueue→prefillQueue (bounded by decode slots) and prefillQueue→prefilling (bounded by prefill slots). Decode-slot holding = membership in `prefillQueue ∪ prefilling ∪ decoding`.

- [ ] **Step 1: Write failing tests**

`src/engine/pipeline.test.ts`:
```ts
import { Simulation } from './engine';
import type { Constants, Dials } from './types';
import { DEFAULT_CONSTANTS } from './types';

const TINY: Constants = {
  ...DEFAULT_CONSTANTS,
  gpuBudget: 4,
  slotsPerDecodeServer: 2,
  slotsPerPrefillServer: 1,
  prefillTokPerSecPerServer: 0, // freeze compute so requests sit in place
  decodeTokPerSecPerServer: 0,
};

const DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 9_999, retryStrategy: 'patient',
  numUsers: 5, admissionLimit: 999, prefillServers: 2, // 2*1.5=3 GPUs -> 1 decode server
};

describe('pipeline promotion and timeouts', () => {
  it('promotes up to decode slots, then prefill slots', () => {
    const sim = new Simulation(DIALS, 1, TINY);
    sim.tick(0.25);
    // 1 decode server * 2 slots = 2 held; 2 prefill servers * 1 slot = 2 prefilling
    expect(sim.prefilling.length).toBe(2);
    expect(sim.prefillQueue.length).toBe(0);
    expect(sim.decodeQueue.length).toBe(3);
    expect(sim.decodeSlotsTotal).toBe(2);
  });

  it('kills decode-queue waiters after 30s and frees nothing (they held nothing)', () => {
    const sim = new Simulation(DIALS, 1, TINY);
    let dead = 0;
    for (let i = 0; i < 4 * 35; i++) dead += sim.tick(0.25).deadDecodeQueue; // 35 sim-sec
    expect(dead).toBe(3);
    expect(sim.decodeQueue.length).toBe(0);
  });

  it('kills prefill-queue waiters after 30s, freeing their decode slots', () => {
    // prefillServers 0 -> no prefill slots; all promoted requests stall in prefillQueue
    const sim = new Simulation({ ...DIALS, prefillServers: 0, numUsers: 3 }, 1, TINY);
    // gpuBudget 4 -> 4 decode servers * 2 slots = 8 slots; all 3 land in prefillQueue
    sim.tick(0.25);
    expect(sim.prefillQueue.length).toBe(3);
    let dead = 0;
    for (let i = 0; i < 4 * 35; i++) dead += sim.tick(0.25).deadPrefillQueue;
    expect(dead).toBeGreaterThanOrEqual(3); // originals (+ any retries that stalled and died)
    const snap = sim.snapshot();
    expect(snap.decodeSlotsHeld).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/pipeline.test.ts`
Expected: FAIL — promotion/timeout not implemented (requests stay in decodeQueue; dead counts 0).

- [ ] **Step 3: Implement**

In `src/engine/engine.ts`, replace the `tick` body's middle section:
```ts
  tick(dt: number): TickMetrics {
    this.simTime += dt;
    const m = newTickMetrics(this.simTime, this);
    this.emitRequests(m);
    this.expireQueues(m);
    this.promote();
    this.finalizeMetrics(m, dt);
    this.history.push(m);
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, 50_000);
    return m;
  }
```

Add private methods:
```ts
  private expireQueues(m: TickMetrics): void {
    this.expireQueue(this.decodeQueue, 'deadDecodeQueue', m);
    this.expireQueue(this.prefillQueue, 'deadPrefillQueue', m);
  }

  private expireQueue(
    queue: SimRequest[], deadPhase: 'deadDecodeQueue' | 'deadPrefillQueue', m: TickMetrics,
  ): void {
    const timeout = this.constants.queueTimeoutSec;
    for (let i = queue.length - 1; i >= 0; i--) {
      const r = queue[i];
      if (this.simTime - r.phaseEnteredAt <= timeout) continue;
      queue.splice(i, 1);
      r.phase = deadPhase;
      if (deadPhase === 'deadDecodeQueue') m.deadDecodeQueue += 1;
      else m.deadPrefillQueue += 1;
      // 529 reaches a still-live client -> it retries. Abandoned clients already did.
      if (r.clientAbandonedAt === null) this.scheduleRetry(this.users[r.userId], r, m);
    }
  }

  private promote(): void {
    const heldCount = () =>
      this.prefillQueue.length + this.prefilling.length + this.decoding.length;
    while (this.decodeQueue.length > 0 && heldCount() < this.decodeSlotsTotal) {
      const r = this.decodeQueue.shift()!;
      r.phase = 'prefillQueue';
      r.phaseEnteredAt = this.simTime;
      this.prefillQueue.push(r);
    }
    while (this.prefillQueue.length > 0 && this.prefilling.length < this.prefillSlotsTotal) {
      const r = this.prefillQueue.shift()!;
      r.phase = 'prefilling';
      r.phaseEnteredAt = this.simTime;
      this.prefilling.push(r);
    }
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine`
Expected: all engine tests PASS (Tasks 2–4).

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): slot promotion and 30s queue timeouts with slot-holding"
```

---

### Task 5: Compute, delivery, client watchdog, ghosts

**Files:**
- Modify: `src/engine/engine.ts` (extend `tick()`; add `runPrefill`, `runDecode`, `runWatchdog`)
- Test: `src/engine/compute.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces: complete v1 engine. Shared-throughput rule (server-pool capacity ÷ active requests), TTFT recorded at prefill completion, TPOT at delivery, `deliveredTok` credited only to live clients, watchdog abandons on TTFT > clientTimeoutSec (server keeps computing — ghost attribution into `computedGhostTok`). Determinism: same seed ⇒ identical history.

- [ ] **Step 1: Write failing tests**

`src/engine/compute.test.ts`:
```ts
import { Simulation } from './engine';
import type { Constants, Dials } from './types';
import { DEFAULT_CONSTANTS } from './types';

const DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 3_600, retryStrategy: 'patient',
  numUsers: 1, admissionLimit: 999, prefillServers: 8,
};

function run(sim: Simulation, sec: number) {
  const sums = { delivered: 0, live: 0, ghost: 0, abandons: 0, retries: 0, ttft: [] as number[] };
  for (let i = 0; i < Math.round(sec / 0.25); i++) {
    const m = sim.tick(0.25);
    sums.delivered += m.deliveredTok;
    sums.live += m.computedLiveTok;
    sums.ghost += m.computedGhostTok;
    sums.abandons += m.clientAbandons;
    sums.retries += m.retriesScheduled;
    sums.ttft.push(...m.ttftSamples);
  }
  return sums;
}

describe('compute and delivery', () => {
  it('delivers a lone request: goodput == computed, TTFT recorded', () => {
    const sim = new Simulation(DIALS, 3);
    const s = run(sim, 600);
    expect(s.delivered).toBeGreaterThan(0);
    expect(s.ghost).toBe(0);
    expect(s.ttft.length).toBeGreaterThan(0);
    // every delivered token was computed for a live client
    expect(Math.abs(s.delivered - s.live)).toBeLessThan(s.delivered * 0.01);
  });

  it('shared throughput: 8 concurrent users deliver less per-user than 1', () => {
    const one = run(new Simulation(DIALS, 5), 900);
    const eight = run(new Simulation({ ...DIALS, numUsers: 8 }, 5), 900);
    expect(eight.delivered / 8).toBeLessThan(one.delivered);
  });

  it('watchdog: impatient client abandons, server computes for a ghost', () => {
    const slow: Constants = { ...DEFAULT_CONSTANTS, prefillTokPerSecPerServer: 500 };
    const sim = new Simulation({ ...DIALS, clientTimeoutSec: 30 }, 3, slow);
    const s = run(sim, 300);
    expect(s.abandons).toBeGreaterThan(0);
    expect(s.retries).toBeGreaterThan(0);
    expect(s.ghost).toBeGreaterThan(0); // oblivious server burned tokens for nobody
  });

  it('same seed => identical history', () => {
    const a = new Simulation({ ...DIALS, numUsers: 6 }, 11);
    const b = new Simulation({ ...DIALS, numUsers: 6 }, 11);
    for (let i = 0; i < 2_000; i++) { a.tick(0.25); b.tick(0.25); }
    expect(JSON.stringify(a.history[1_999])).toBe(JSON.stringify(b.history[1_999]));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/compute.test.ts`
Expected: FAIL — no delivery occurs (`delivered` stays 0).

- [ ] **Step 3: Implement**

In `tick()`, insert after `this.promote();`:
```ts
    this.runPrefill(dt, m);
    this.runDecode(dt, m);
    this.runWatchdog(m);
```

Add private methods:
```ts
  private attributeComputed(r: SimRequest, tokens: number, m: TickMetrics): void {
    if (r.clientAbandonedAt === null) m.computedLiveTok += tokens;
    else m.computedGhostTok += tokens;
  }

  private runPrefill(dt: number, m: TickMetrics): void {
    if (this.prefilling.length === 0) return;
    const capacity =
      this.dials.prefillServers * this.constants.prefillTokPerSecPerServer * dt;
    const share = capacity / this.prefilling.length;
    for (let i = this.prefilling.length - 1; i >= 0; i--) {
      const r = this.prefilling[i];
      const applied = Math.min(share, r.promptTokens - r.prefillDoneTok);
      r.prefillDoneTok += applied;
      this.attributeComputed(r, applied, m);
      if (r.prefillDoneTok >= r.promptTokens) {
        this.prefilling.splice(i, 1);
        r.phase = 'decoding';
        r.phaseEnteredAt = this.simTime;
        r.ttftSec = this.simTime - r.createdAt;
        if (r.clientAbandonedAt === null) m.ttftSamples.push(r.ttftSec);
        this.decoding.push(r);
      }
    }
  }

  private runDecode(dt: number, m: TickMetrics): void {
    if (this.decoding.length === 0) return;
    const capacity =
      this.decodeServers * this.constants.decodeTokPerSecPerServer * dt;
    const share = capacity / this.decoding.length;
    for (let i = this.decoding.length - 1; i >= 0; i--) {
      const r = this.decoding[i];
      const applied = Math.min(share, r.outputTokens - r.decodeDoneTok);
      r.decodeDoneTok += applied;
      this.attributeComputed(r, applied, m);
      if (r.decodeDoneTok >= r.outputTokens) {
        this.decoding.splice(i, 1);
        r.phase = 'delivered';
        if (r.clientAbandonedAt === null) {
          m.deliveredTok += r.promptTokens + r.outputTokens;
          const decodeSec = this.simTime - r.phaseEnteredAt;
          m.tpotSamples.push(decodeSec / Math.max(1, r.outputTokens));
          this.completeUser(this.users[r.userId]);
        }
        // abandoned: tokens burned for a ghost; the user has already moved on
      }
    }
  }

  private runWatchdog(m: TickMetrics): void {
    const lists = [this.decodeQueue, this.prefillQueue, this.prefilling, this.decoding];
    for (const list of lists) {
      for (const r of list) {
        if (r.clientAbandonedAt !== null || r.ttftSec !== null) continue; // v1: TTFT watchdog
        if (this.simTime - r.createdAt > this.dials.clientTimeoutSec) {
          r.clientAbandonedAt = this.simTime;
          m.clientAbandons += 1;
          this.scheduleRetry(this.users[r.userId], r, m);
        }
      }
    }
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine`
Expected: all engine tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): shared-throughput compute, delivery, TTFT watchdog, ghost work"
```

---

### Task 6: Stats helpers + collapse invariants (THE VALIDATION GATE)

**Files:**
- Create: `src/engine/stats.ts`, `src/scenarios/loadCurves.ts`
- Test: `src/engine/stats.test.ts`, `src/engine/collapse.test.ts`

**Interfaces:**
- Consumes: `Simulation`, `TickMetrics`.
- Produces: `goodputPctWindow(history: TickMetrics[], tStartSec: number, tEndSec: number): number`; `rollingGoodputPct(history: TickMetrics[], windowSec: number): number`; `percentile(xs: number[], p: number): number`; `rushHourUsers(tSec: number): number`; `spikeUsers(tSec: number): number`. Task 7 scenarios and Task 10 charts consume these exact names.

**This task is the gate from spec §7: if the three invariants don't pass, tune `DEFAULT_CONSTANTS` values and/or curve numbers/admission value — NOT the test thresholds' spirit — until they do, then freeze. Document any constant changes in the commit message.**

- [ ] **Step 1: Write stats tests (failing)**

`src/engine/stats.test.ts`:
```ts
import { goodputPctWindow, percentile, rollingGoodputPct } from './stats';
import type { TickMetrics } from './types';

function mk(t: number, delivered: number, live: number, ghost: number): TickMetrics {
  return {
    t, deliveredTok: delivered, computedLiveTok: live, computedGhostTok: ghost,
    theoreticalMaxTok: 0, rejectedAdmission: 0, deadDecodeQueue: 0, deadPrefillQueue: 0,
    clientAbandons: 0, retriesScheduled: 0, decodeQueueDepth: 0, prefillQueueDepth: 0,
    decodeSlotsHeld: 0, decodeSlotsTotal: 0, prefillSlotsBusy: 0, prefillSlotsTotal: 0,
    activeUsers: 0, ttftSamples: [], tpotSamples: [],
  };
}

describe('stats', () => {
  it('goodputPctWindow computes delivered over computed in window', () => {
    const h = [mk(1, 100, 100, 0), mk(2, 0, 50, 50), mk(3, 50, 0, 100)];
    expect(goodputPctWindow(h, 1.5, 3)).toBeCloseTo(100 * 50 / 200);
  });
  it('returns 100 when nothing computed', () => {
    expect(goodputPctWindow([mk(1, 0, 0, 0)], 0, 2)).toBe(100);
  });
  it('rollingGoodputPct uses the tail window', () => {
    const h = [mk(1, 0, 0, 100), mk(100, 100, 100, 0)];
    expect(rollingGoodputPct(h, 10)).toBe(100);
  });
  it('percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([], 50)).toBe(0);
  });
});
```

- [ ] **Step 2: Implement stats + load curves**

`src/engine/stats.ts`:
```ts
import type { TickMetrics } from './types';

export function goodputPctWindow(
  history: TickMetrics[], tStartSec: number, tEndSec: number,
): number {
  let delivered = 0;
  let computed = 0;
  for (const m of history) {
    if (m.t < tStartSec || m.t > tEndSec) continue;
    delivered += m.deliveredTok;
    computed += m.computedLiveTok + m.computedGhostTok;
  }
  return computed === 0 ? 100 : Math.min(100, (100 * delivered) / computed);
}

export function rollingGoodputPct(history: TickMetrics[], windowSec: number): number {
  const tEnd = history.length ? history[history.length - 1].t : 0;
  return goodputPctWindow(history, tEnd - windowSec, tEnd);
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
```

`src/scenarios/loadCurves.ts`:
```ts
/** Active-user count over a 24h sim day (t in seconds). The true story: spec §6. */
export function rushHourUsers(tSec: number): number {
  const h = tSec / 3600;
  const lerp = (a: number, b: number, x: number) => a + (b - a) * Math.max(0, Math.min(1, x));
  if (h < 7) return 4;                       // overnight cron traffic
  if (h < 9) return Math.round(lerp(4, 20, (h - 7) / 2));
  if (h < 11) return Math.round(lerp(20, 80, (h - 9) / 2));
  if (h < 15) return 80;                     // the grinding hours
  if (h < 17) return Math.round(lerp(80, 10, (h - 15) / 2));
  return 6;
}

/** Steady ~90% load with a 2-minute demand spike. */
export function spikeUsers(tSec: number): number {
  if (tSec >= 180 && tSec < 300) return 90;
  return 30;
}
```

- [ ] **Step 3: Run stats tests**

Run: `npx vitest run src/engine/stats.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the collapse invariants (failing or passing — find out)**

`src/engine/collapse.test.ts`:
```ts
import { Simulation } from './engine';
import { goodputPctWindow } from './stats';
import { rushHourUsers } from '../scenarios/loadCurves';
import type { Dials } from './types';

const H = 3600;
const RUSH_DIALS: Dials = {
  workload: 'agentic-dev', clientTimeoutSec: 120, retryStrategy: 'aggressive',
  numUsers: 0, admissionLimit: 100_000, prefillServers: 8,
};

function runDay(dials: Dials, hours: number, curve: (t: number) => number): Simulation {
  const sim = new Simulation(dials, 42);
  const steps = Math.round((hours * H) / 0.25);
  for (let i = 0; i < steps; i++) {
    sim.setTargetActiveUsers(curve(sim.simTime));
    sim.tick(0.25);
  }
  return sim;
}

describe('collapse invariants (spec §7) — the gate before any UI', () => {
  it('inv1: light load => near-full goodput', () => {
    const sim = runDay(RUSH_DIALS, 2, () => 6);
    expect(goodputPctWindow(sim.history, 0.5 * H, 2 * H)).toBeGreaterThan(85);
  }, 60_000);

  it('inv2: ungated rush hour collapses and does NOT recover while load persists', () => {
    const sim = runDay(RUSH_DIALS, 15, rushHourUsers);
    const atNoon = goodputPctWindow(sim.history, 12 * H, 13 * H);
    const midAfternoon = goodputPctWindow(sim.history, 14 * H, 15 * H);
    const morning = goodputPctWindow(sim.history, 8 * H, 9.5 * H);
    expect(morning).toBeGreaterThan(50);      // oversubscribed but limping along
    expect(atNoon).toBeLessThan(25);          // collapsed
    expect(midAfternoon).toBeLessThan(30);    // still collapsed: metastable
  }, 120_000);

  it('inv3: the admission gate saves the same day', () => {
    const sim = runDay({ ...RUSH_DIALS, admissionLimit: 60 }, 15, rushHourUsers);
    expect(goodputPctWindow(sim.history, 9 * H, 15 * H)).toBeGreaterThan(60);
  }, 120_000);
});
```

- [ ] **Step 5: Run and CALIBRATE**

Run: `npx vitest run src/engine/collapse.test.ts`

If any invariant fails, iterate on (in order of preference): `DEFAULT_CONSTANTS.prefillTokPerSecPerServer` / `decodeTokPerSecPerServer`, workload sampling exponent (0.35 in `workloads.ts`), rush-hour peak user count (80), the gated `admissionLimit: 60`, think-time ranges. Re-run engine unit tests after every constants change (`npx vitest run src/engine`) — ranges in workload tests may need matching updates ONLY if a distribution changes. Do not weaken the invariant thresholds by more than ±10 points; if you cannot make collapse emerge, STOP and report — the model has a structural problem the human partner needs to see.

If inv2/inv3 runtime exceeds ~60s each, profile before optimizing; the likely fix is reducing per-tick array garbage (reuse `ttftSamples` arrays only if needed).

- [ ] **Step 6: Freeze and commit**

```bash
git add src/engine src/scenarios
git commit -m "feat(engine): stats helpers, load curves, collapse invariants pass (constants calibrated: <list changes>)"
```

---

### Task 7: Scenario framework + narrator + the three scenarios

**Files:**
- Create: `src/scenarios/types.ts`, `src/scenarios/narrator.ts`, `src/scenarios/rushHour.ts`, `src/scenarios/spike.ts`, `src/scenarios/freePlay.ts`, `src/scenarios/index.ts`
- Test: `src/scenarios/scenarios.test.ts`

**Interfaces:**
- Consumes: `Simulation`, `rollingGoodputPct`, load curves.
- Produces (consumed verbatim by Task 8's hook):
```ts
interface NarratorCtx { t: number; sim: Simulation; last: TickMetrics | undefined }
interface NarratorLine { id: string; text: string; when: (ctx: NarratorCtx) => boolean }
interface NarratorMsg { id: string; t: number; text: string }
interface WinCondition { windowStartSec: number; windowEndSec: number; minGoodputPct: number; winText: string; loseText: string }
interface Scenario {
  id: 'rush-hour' | 'spike' | 'free-play';
  name: string; blurb: string; seed: number; durationSec: number;
  clockStartHour: number; defaultSpeed: number; initialDials: Dials;
  loadCurve: ((tSec: number) => number) | null;  // null => free play (numUsers dial + surge)
  narrator: NarratorLine[]; win?: WinCondition;
}
function evalNarrator(scenario: Scenario, sim: Simulation, fired: Set<string>): NarratorMsg[]  // newly fired this call
const SCENARIOS: Record<Scenario['id'], Scenario>  // from index.ts
```

- [ ] **Step 1: Write failing tests**

`src/scenarios/scenarios.test.ts`:
```ts
import { Simulation } from '../engine/engine';
import { evalNarrator } from './narrator';
import { SCENARIOS } from './index';
import { rushHourUsers } from './loadCurves';

describe('scenarios', () => {
  it('rush hour curve matches the true story', () => {
    expect(rushHourUsers(2 * 3600)).toBe(4);
    expect(rushHourUsers(12 * 3600)).toBe(80);
    expect(rushHourUsers(16 * 3600)).toBeLessThan(50);
    expect(rushHourUsers(20 * 3600)).toBe(6);
  });

  it('narrator lines fire once', () => {
    const scn = SCENARIOS['rush-hour'];
    const sim = new Simulation(scn.initialDials, scn.seed);
    const fired = new Set<string>();
    for (let i = 0; i < 4 * 90; i++) sim.tick(0.25); // 90 sim-sec => 'welcome' due
    const first = evalNarrator(scn, sim, fired);
    expect(first.some((msg) => msg.id === 'welcome')).toBe(true);
    const second = evalNarrator(scn, sim, fired);
    expect(second.some((msg) => msg.id === 'welcome')).toBe(false);
  });

  it('all scenarios expose valid dials and unique narrator ids', () => {
    for (const scn of Object.values(SCENARIOS)) {
      expect(scn.initialDials.prefillServers).toBeGreaterThanOrEqual(0);
      const ids = scn.narrator.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/scenarios`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/scenarios/types.ts`:
```ts
import type { Simulation } from '../engine/engine';
import type { Dials, TickMetrics } from '../engine/types';

export interface NarratorCtx { t: number; sim: Simulation; last: TickMetrics | undefined }
export interface NarratorLine { id: string; text: string; when: (ctx: NarratorCtx) => boolean }
export interface NarratorMsg { id: string; t: number; text: string }
export interface WinCondition {
  windowStartSec: number; windowEndSec: number; minGoodputPct: number;
  winText: string; loseText: string;
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
```

`src/scenarios/narrator.ts`:
```ts
import type { Simulation } from '../engine/engine';
import type { NarratorMsg, Scenario } from './types';

export function evalNarrator(
  scenario: Scenario, sim: Simulation, fired: Set<string>,
): NarratorMsg[] {
  const out: NarratorMsg[] = [];
  const ctx = { t: sim.simTime, sim, last: sim.history[sim.history.length - 1] };
  for (const line of scenario.narrator) {
    if (fired.has(line.id)) continue;
    if (line.when(ctx)) {
      fired.add(line.id);
      out.push({ id: line.id, t: sim.simTime, text: line.text });
    }
  }
  return out;
}
```

`src/scenarios/rushHour.ts` (narrator copy is the author's ops voice — polish freely later, structure not):
```ts
import { rollingGoodputPct } from '../engine/stats';
import { rushHourUsers } from './loadCurves';
import type { Scenario } from './types';

const H = 3600;

export const rushHour: Scenario = {
  id: 'rush-hour',
  name: 'Rush Hour',
  blurb: 'A true story: one air-gapped cluster, one org of agentic-dev users, one very bad Tuesday.',
  seed: 42,
  durationSec: 24 * H,
  clockStartHour: 0,
  defaultSpeed: 480, // 24h in 3 wall-minutes
  initialDials: {
    workload: 'agentic-dev', clientTimeoutSec: 120, retryStrategy: 'aggressive',
    numUsers: 0, admissionLimit: 100_000, prefillServers: 8,
  },
  loadCurve: rushHourUsers,
  narrator: [
    { id: 'welcome', text: 'Midnight. A few cron jobs hum along. Watch the pipeline: requests take a decode slot FIRST, then wait for prefill. Remember that.', when: ({ t }) => t > 60 },
    { id: 'ramp', text: '9 AM. The org logs on. Every request is an agentic-dev monster: prompts up to 1M tokens, outputs tiny.', when: ({ t }) => t > 9 * H },
    { id: 'oversub', text: '10 AM. Demand now exceeds supply — but goodput is still decent. Are we fine? We are not fine.', when: ({ t }) => t > 10 * H },
    { id: 'collapse', text: 'Nothing is broken. Everything is busy. Goodput is cratering while every GPU reads 100%. Welcome to the worst kind of outage.', when: ({ t, sim }) => t > 10.5 * H && rollingGoodputPct(sim.history, 600) < 25 },
    { id: 'zombies', text: 'Look at the waste band: those are tokens computed for clients that hung up long ago. The queues are full of ghosts — and their retries.', when: ({ t, sim }) => t > 11 * H && rollingGoodputPct(sim.history, 600) < 20 },
    { id: 'tried-prefill', text: 'More prefill servers? You just took decode capacity to feed the same stampede. The bottleneck is not capacity — it is admission.', when: ({ sim }) => sim.dials.prefillServers > 10 },
    { id: 'tried-timeout', text: 'Longer client timeouts? Now they hold on longer before abandoning — and the zombie parade grows behind them. You cannot out-wait a stampede.', when: ({ sim }) => sim.dials.clientTimeoutSec > 240 },
    { id: 'gate', text: 'THERE it is. Failing cheap at the front door instead of expensive in the pipeline. Fewer requests in, more tokens out.', when: ({ t, sim }) => t > 10 * H && sim.dials.admissionLimit < 100 },
    { id: 'exodus', text: '3 PM. People are giving up and going home. In production, this was our fix. That is not a fix.', when: ({ t }) => t > 15 * H },
    { id: 'close', text: 'Day over. Run it again — this time the dials are yours. Hint: the hero dial is the one that says no.', when: ({ t }) => t > 20 * H },
  ],
  win: {
    windowStartSec: 9 * H, windowEndSec: 15 * H, minGoodputPct: 60,
    winText: 'You kept goodput above 60% through the crush — by admitting less. The org got more work done and nobody paged you.',
    loseText: 'Goodput fell below 60% across the working day. Try lowering the admission limit before the 11 AM wall.',
  },
};
```

`src/scenarios/spike.ts`:
```ts
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
    numUsers: 0, admissionLimit: 100_000, prefillServers: 8,
  },
  loadCurve: spikeUsers,
  narrator: [
    { id: 'steady', text: 'Steady state, ~90% of capacity. Comfortable. A little too comfortable.', when: ({ t }) => t > 30 },
    { id: 'hit', text: 'Spike. Triple the users for two minutes. Watch the queues.', when: ({ t }) => t > 185 },
    { id: 'over', text: 'The spike is OVER. Demand is back to normal. So why are the queues still growing?', when: ({ t }) => t > 330 },
    { id: 'why', text: 'Because the load is no longer your users — it is their retries, plus zombie work for clients that already gave up. The system is eating itself. This is metastable failure.', when: ({ t, sim }) => t > 420 && rollingGoodputPct(sim.history, 120) < 30 },
    { id: 'end', text: 'A 2-minute spike bought a permanent outage. An admission gate turns the same spike into 2 minutes of cheap 529s. Try it in Free Play — there is a Surge button.', when: ({ t }) => t > 840 },
  ],
};
```

`src/scenarios/freePlay.ts`:
```ts
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
    numUsers: 40, admissionLimit: 100_000, prefillServers: 8,
  },
  loadCurve: null,
  narrator: [
    { id: 'first-deep-529', text: 'First deep 529: a request died waiting for prefill while HOLDING a decode slot. That slot fed nobody.', when: ({ last }) => (last?.deadPrefillQueue ?? 0) > 0 },
    { id: 'first-ghost', text: 'The red band has appeared: GPUs computing for clients that already hung up. The server cannot tell. It never could.', when: ({ last }) => (last?.computedGhostTok ?? 0) > 0 },
    { id: 'client-note', text: 'Tweaking client dials? In production you do not own those — you publish a best-practices doc and hope. The server dials are the ones you own.', when: () => false },
  ],
};
```
(The `client-note` line's `when` is wired by the UI in Task 11 — the hook fires it on first client-dial change; keeping `() => false` here keeps the narrator engine pure.)

`src/scenarios/index.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/scenarios`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenarios
git commit -m "feat(scenarios): framework, narrator engine, Rush Hour / Spike / Free Play"
```

---

### Task 8: useSimulation hook + app shell + header bar

**Files:**
- Create: `src/ui/useSimulation.ts`, `src/ui/format.ts`, `src/ui/components/HeaderBar.tsx`
- Modify: `src/App.tsx`
- Test: `src/ui/app.test.tsx` (smoke)

**Interfaces:**
- Consumes: `Simulation`, `SCENARIOS`, `evalNarrator`, `rollingGoodputPct`.
- Produces (Tasks 9–11 consume these exact names):
```ts
interface GhostPoint { t: number; goodputPct: number }
interface SimApi {
  sim: Simulation;                    // current instance (recreated on scenario load/reset)
  scenario: Scenario;
  running: boolean; speed: number; renderSeq: number;
  narratorLog: NarratorMsg[];
  ghost: GhostPoint[] | null;         // previous completed run of this scenario
  finished: boolean; won: boolean | null;
  play(): void; pause(): void; reset(): void;
  setSpeed(s: number): void;
  loadScenario(id: Scenario['id']): void;
  changeDials(patch: Partial<Dials>): void;  // routes through sim.setDials + fires client-note
  surge(): void;                      // free play only: +60 users for 60 sim-sec
}
function useSimulation(): SimApi
// format.ts:
function simClock(tSec: number, clockStartHour: number): string  // "11:34 AM"
function fmtTok(n: number): string  // 1234567 -> "1.2M"
```

- [ ] **Step 1: Write the smoke test (failing)**

`src/ui/app.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke', () => {
  it('renders console chrome without crashing', () => {
    render(<App />);
    expect(screen.getByText(/goodput/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /play|pause/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/ui/format.ts`:
```ts
export function simClock(tSec: number, clockStartHour: number): string {
  const total = (clockStartHour * 3600 + tSec) % 86_400;
  const h24 = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function fmtTok(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}
```

`src/ui/useSimulation.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Simulation } from '../engine/engine';
import { rollingGoodputPct } from '../engine/stats';
import type { Dials } from '../engine/types';
import { SCENARIOS, evalNarrator } from '../scenarios/index';
import type { NarratorMsg, Scenario } from '../scenarios/types';
import { goodputPctWindow } from '../engine/stats';

const DT = 0.25;
const MAX_TICKS_PER_FRAME = 600;
const RENDER_INTERVAL_MS = 100;

export interface GhostPoint { t: number; goodputPct: number }

export interface SimApi {
  sim: Simulation;
  scenario: Scenario;
  running: boolean;
  speed: number;
  renderSeq: number;
  narratorLog: NarratorMsg[];
  ghost: GhostPoint[] | null;
  finished: boolean;
  won: boolean | null;
  play(): void;
  pause(): void;
  reset(): void;
  setSpeed(s: number): void;
  loadScenario(id: Scenario['id']): void;
  changeDials(patch: Partial<Dials>): void;
  surge(): void;
}

function newSim(scn: Scenario): Simulation {
  return new Simulation(scn.initialDials, scn.seed);
}

export function useSimulation(): SimApi {
  const [scenarioId, setScenarioId] = useState<Scenario['id']>('rush-hour');
  const scenario = SCENARIOS[scenarioId];
  const simRef = useRef<Simulation>(newSim(scenario));
  const firedRef = useRef<Set<string>>(new Set());
  const surgeUntilRef = useRef(0);
  const ghostsRef = useRef<Partial<Record<Scenario['id'], GhostPoint[]>>>({});
  const [narratorLog, setNarratorLog] = useState<NarratorMsg[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(scenario.defaultSpeed);
  const [renderSeq, setRenderSeq] = useState(0);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState<boolean | null>(null);

  const captureGhost = useCallback(() => {
    const sim = simRef.current;
    if (sim.simTime < 60) return; // nothing worth ghosting
    const pts: GhostPoint[] = [];
    const step = Math.max(1, Math.floor(sim.history.length / 500));
    for (let i = 0; i < sim.history.length; i += step) {
      const t = sim.history[i].t;
      pts.push({ t, goodputPct: goodputPctWindow(sim.history, t - 60, t) });
    }
    ghostsRef.current[scenarioId] = pts;
  }, [scenarioId]);

  const resetTo = useCallback((id: Scenario['id']) => {
    captureGhost();
    const scn = SCENARIOS[id];
    simRef.current = newSim(scn);
    firedRef.current = new Set();
    surgeUntilRef.current = 0;
    setNarratorLog([]);
    setScenarioId(id);
    setSpeed(scn.defaultSpeed);
    setRunning(false);
    setFinished(false);
    setWon(null);
    setRenderSeq((s) => s + 1);
  }, [captureGhost]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    let lastRender = 0;
    const loop = (now: number) => {
      acc += ((now - prev) / 1000) * speed;
      prev = now;
      const sim = simRef.current;
      const scn = SCENARIOS[scenarioId];
      let ticks = 0;
      const newMsgs: NarratorMsg[] = [];
      while (acc >= DT && ticks < MAX_TICKS_PER_FRAME) {
        if (sim.simTime >= scn.durationSec) break;
        if (scn.loadCurve) {
          sim.setTargetActiveUsers(scn.loadCurve(sim.simTime));
        } else {
          const surgeBoost = sim.simTime < surgeUntilRef.current ? 60 : 0;
          sim.setTargetActiveUsers(sim.dials.numUsers + surgeBoost);
        }
        sim.tick(DT);
        newMsgs.push(...evalNarrator(scn, sim, firedRef.current));
        acc -= DT;
        ticks += 1;
      }
      if (newMsgs.length) setNarratorLog((log) => [...log, ...newMsgs]);
      if (sim.simTime >= scn.durationSec) {
        setRunning(false);
        setFinished(true);
        if (scn.win) {
          setWon(goodputPctWindow(
            sim.history, scn.win.windowStartSec, scn.win.windowEndSec,
          ) >= scn.win.minGoodputPct);
        }
      }
      if (now - lastRender > RENDER_INTERVAL_MS) {
        lastRender = now;
        setRenderSeq((s) => s + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, scenarioId]);

  return {
    sim: simRef.current,
    scenario,
    running, speed, renderSeq, narratorLog,
    ghost: ghostsRef.current[scenarioId] ?? null,
    finished, won,
    play: () => setRunning(true),
    pause: () => setRunning(false),
    reset: () => resetTo(scenarioId),
    setSpeed,
    loadScenario: resetTo,
    changeDials: (patch) => {
      const clientKeys: (keyof Dials)[] = ['workload', 'clientTimeoutSec', 'retryStrategy', 'numUsers'];
      if (scenarioId === 'free-play' && !firedRef.current.has('client-note')
        && Object.keys(patch).some((k) => clientKeys.includes(k as keyof Dials))) {
        firedRef.current.add('client-note');
        const line = SCENARIOS['free-play'].narrator.find((l) => l.id === 'client-note');
        if (line) setNarratorLog((log) => [...log, { id: line.id, t: simRef.current.simTime, text: line.text }]);
      }
      simRef.current.setDials(patch);
      setRenderSeq((s) => s + 1);
    },
    surge: () => { surgeUntilRef.current = simRef.current.simTime + 60; },
  };
}

export { rollingGoodputPct };
```

`src/ui/components/HeaderBar.tsx`:
```tsx
import { SCENARIOS } from '../../scenarios/index';
import type { Scenario } from '../../scenarios/types';
import { simClock } from '../format';

interface Props {
  simTime: number;
  scenario: Scenario;
  running: boolean;
  speed: number;
  onPlayPause(): void;
  onReset(): void;
  onSpeed(s: number): void;
  onScenario(id: Scenario['id']): void;
}

const SPEEDS = [15, 60, 240, 480, 960];

export function HeaderBar(p: Props) {
  return (
    <header className="header-bar">
      <span className="clock">⏱ {simClock(p.simTime, p.scenario.clockStartHour)}</span>
      <button onClick={p.onPlayPause}>{p.running ? 'Pause' : 'Play'}</button>
      <button onClick={p.onReset}>Reset</button>
      <label>
        speed:{' '}
        <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
      <label>
        scenario:{' '}
        <select value={p.scenario.id} onChange={(e) => p.onScenario(e.target.value as Scenario['id'])}>
          {Object.values(SCENARIOS).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <span className="blurb">{p.scenario.blurb}</span>
    </header>
  );
}
```

`src/App.tsx`:
```tsx
import { HeaderBar } from './ui/components/HeaderBar';
import { rollingGoodputPct, useSimulation } from './ui/useSimulation';

export default function App() {
  const api = useSimulation();
  const goodput = rollingGoodputPct(api.sim.history, 60);
  return (
    <div className="console">
      <HeaderBar
        simTime={api.sim.simTime}
        scenario={api.scenario}
        running={api.running}
        speed={api.speed}
        onPlayPause={api.running ? api.pause : api.play}
        onReset={api.reset}
        onSpeed={api.setSpeed}
        onScenario={api.loadScenario}
      />
      <main>
        <h1>Goodput {goodput.toFixed(0)}%</h1>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass + eyeball**

Run: `npx vitest run` (all green) then `npm run dev` — open the page, press Play on Rush Hour, confirm the clock advances and goodput % changes over ~1 minute.
Expected: PASS + live console skeleton.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/App.tsx
git commit -m "feat(ui): simulation driver hook, header bar, live goodput headline"
```

---

### Task 9: Dials rail + goodput headline component

**Files:**
- Create: `src/ui/components/DialsRail.tsx`, `src/ui/components/GoodputHeadline.tsx`
- Modify: `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `SimApi.changeDials`, `SimApi.surge`, `Dials`, `rollingGoodputPct`.
- Produces:
```tsx
function DialsRail(p: { dials: Dials; decodeServers: number; isFreePlay: boolean; onChange(patch: Partial<Dials>): void; onSurge(): void }): JSX.Element
function GoodputHeadline(p: { pct: number }): JSX.Element
```

- [ ] **Step 1: Implement**

`src/ui/components/GoodputHeadline.tsx`:
```tsx
export function GoodputHeadline({ pct }: { pct: number }) {
  const tone = pct >= 70 ? 'good' : pct >= 35 ? 'warn' : 'bad';
  return (
    <div className={`goodput-headline ${tone}`}>
      <span className="label">GOODPUT</span>
      <span className="value">{pct.toFixed(0)}%</span>
      <span className="sub">delivered tokens ÷ tokens the GPUs actually spent (60s window)</span>
    </div>
  );
}
```

`src/ui/components/DialsRail.tsx`:
```tsx
import type { Dials } from '../../engine/types';

interface Props {
  dials: Dials;
  decodeServers: number;
  isFreePlay: boolean;
  onChange(patch: Partial<Dials>): void;
  onSurge(): void;
}

export function DialsRail({ dials, decodeServers, isFreePlay, onChange, onSurge }: Props) {
  return (
    <aside className="dials-rail">
      <section>
        <h3>Server config <span className="own">you own these</span></h3>
        <label className="hero">
          Admission limit: {dials.admissionLimit >= 100_000 ? 'OFF' : dials.admissionLimit}
          <input type="range" min={10} max={300} step={5}
            value={Math.min(dials.admissionLimit, 300)}
            onChange={(e) => onChange({ admissionLimit: Number(e.target.value) })} />
          <button className="tiny" onClick={() => onChange({ admissionLimit: 100_000 })}>disable gate</button>
        </label>
        <label>
          P:D split — {dials.prefillServers} prefill / {decodeServers} decode
          <input type="range" min={0} max={14} step={1} value={dials.prefillServers}
            onChange={(e) => onChange({ prefillServers: Number(e.target.value) })} />
          <span className="hint">prefill costs 1.5 GPUs, decode 1 — fixed budget</span>
        </label>
      </section>
      <section>
        <h3>Client behavior <span className="own">in prod: a best-practices doc and hope</span></h3>
        <label>
          Workload
          <select value={dials.workload}
            onChange={(e) => onChange({ workload: e.target.value as Dials['workload'] })}>
            <option value="agentic-dev">Agentic dev (huge prompts)</option>
            <option value="chat">Chat (medium prompts)</option>
          </select>
        </label>
        <label>
          Client timeout: {dials.clientTimeoutSec}s
          <input type="range" min={30} max={300} step={15} value={dials.clientTimeoutSec}
            onChange={(e) => onChange({ clientTimeoutSec: Number(e.target.value) })} />
        </label>
        <label>
          Retry strategy
          <select value={dials.retryStrategy}
            onChange={(e) => onChange({ retryStrategy: e.target.value as Dials['retryStrategy'] })}>
            <option value="aggressive">Aggressive (10s max backoff)</option>
            <option value="patient">Patient (5min max backoff)</option>
          </select>
        </label>
        {isFreePlay && (
          <>
            <label>
              Users: {dials.numUsers}
              <input type="range" min={1} max={150} step={1} value={dials.numUsers}
                onChange={(e) => onChange({ numUsers: Number(e.target.value) })} />
            </label>
            <button className="surge" onClick={onSurge}>⚡ Surge (+60 users, 60s)</button>
          </>
        )}
      </section>
    </aside>
  );
}
```

Update `src/App.tsx` to a grid layout mounting `DialsRail` (left) and `GoodputHeadline` (top of main), passing `api.sim.dials`, `api.sim.decodeServers`, `api.scenario.id === 'free-play'`, `api.changeDials`, `api.surge`. Add to `src/index.css` a `.console` grid (`grid-template-columns: 280px 1fr`), rail styling, and headline tones (`.good { color:#3fb950 } .warn { color:#d29922 } .bad { color:#f85149 }`).

- [ ] **Step 2: Verify**

Run: `npx vitest run && npm run dev` — turn every dial mid-run on Free Play; confirm admission limit changes visibly alter queue behavior (goodput headline reacts within seconds at 30×).
Expected: tests green; dials live.

- [ ] **Step 3: Commit**

```bash
git add src/ui src/App.tsx src/index.css
git commit -m "feat(ui): dials rail (admission hero dial, P:D split, client group) + headline"
```

---

### Task 10: Pipeline strip + charts panel

**Files:**
- Create: `src/ui/chartData.ts`, `src/ui/components/PipelineStrip.tsx`, `src/ui/components/ChartsPanel.tsx`
- Modify: `src/App.tsx`
- Test: `src/ui/chartData.test.ts`

**Interfaces:**
- Consumes: `TickMetrics[]`, `PipelineSnapshot`, `GhostPoint[]`, `percentile`.
- Produces:
```ts
interface ChartPoint {
  t: number; liveTokPerSec: number; ghostTokPerSec: number; idleTokPerSec: number;
  goodputPct: number; deliveredTokPerSec: number; activeUsers: number;
  ttftP50: number; ttftP90: number;
  shallow529: number; deep529: number; abandons: number; retries: number;
  decodeQueueDepth: number; prefillQueueDepth: number;
}
function bucketize(history: TickMetrics[], bucketSec: number, maxBuckets: number): ChartPoint[]
function PipelineStrip(p: { snap: PipelineSnapshot; queueTimeoutSec: number }): JSX.Element
function ChartsPanel(p: { points: ChartPoint[]; ghost: GhostPoint[] | null; theoreticalTokPerSec: number }): JSX.Element
```

- [ ] **Step 1: Write failing test**

`src/ui/chartData.test.ts`:
```ts
import { bucketize } from './chartData';
import type { TickMetrics } from '../engine/types';

function mk(t: number): TickMetrics {
  return {
    t, computedLiveTok: 25, computedGhostTok: 25, theoreticalMaxTok: 100, deliveredTok: 10,
    rejectedAdmission: 1, deadDecodeQueue: 0, deadPrefillQueue: 1, clientAbandons: 0,
    retriesScheduled: 2, decodeQueueDepth: 5, prefillQueueDepth: 3, decodeSlotsHeld: 4,
    decodeSlotsTotal: 8, prefillSlotsBusy: 2, prefillSlotsTotal: 4, activeUsers: 10,
    ttftSamples: [t], tpotSamples: [],
  };
}

describe('bucketize', () => {
  it('aggregates ticks into per-second rates', () => {
    const h: TickMetrics[] = [];
    for (let i = 1; i <= 40; i++) h.push(mk(i * 0.25)); // 10 sim-sec
    const pts = bucketize(h, 2, 100);
    expect(pts.length).toBe(5);
    const p = pts[0];
    expect(p.liveTokPerSec).toBeCloseTo(100);   // 25 tok * 8 ticks / 2 sec
    expect(p.ghostTokPerSec).toBeCloseTo(100);
    expect(p.idleTokPerSec).toBeCloseTo(200);   // 100 max * 8 / 2 - live - ghost
    expect(p.goodputPct).toBeCloseTo(100 * 80 / 400);
    expect(p.deep529).toBe(8);
    expect(p.shallow529).toBe(8);
  });
  it('caps bucket count by dropping oldest', () => {
    const h: TickMetrics[] = [];
    for (let i = 1; i <= 400; i++) h.push(mk(i * 0.25));
    expect(bucketize(h, 2, 10).length).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/chartData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/ui/chartData.ts`:
```ts
import { percentile } from '../engine/stats';
import type { TickMetrics } from '../engine/types';

export interface ChartPoint {
  t: number;
  liveTokPerSec: number; ghostTokPerSec: number; idleTokPerSec: number;
  goodputPct: number; deliveredTokPerSec: number; activeUsers: number;
  ttftP50: number; ttftP90: number;
  shallow529: number; deep529: number; abandons: number; retries: number;
  decodeQueueDepth: number; prefillQueueDepth: number;
}

export function bucketize(
  history: TickMetrics[], bucketSec: number, maxBuckets: number,
): ChartPoint[] {
  const out: ChartPoint[] = [];
  const perBucket = Math.max(1, Math.round(bucketSec / 0.25));
  const start = Math.max(0, history.length - perBucket * maxBuckets);
  for (let i = start; i + perBucket <= history.length; i += perBucket) {
    let live = 0, ghost = 0, max = 0, delivered = 0, shallow = 0, deepDq = 0, deepPq = 0,
      abandons = 0, retries = 0;
    const ttft: number[] = [];
    for (let j = i; j < i + perBucket; j++) {
      const m = history[j];
      live += m.computedLiveTok; ghost += m.computedGhostTok; max += m.theoreticalMaxTok;
      delivered += m.deliveredTok; shallow += m.rejectedAdmission;
      deepDq += m.deadDecodeQueue; deepPq += m.deadPrefillQueue;
      abandons += m.clientAbandons; retries += m.retriesScheduled;
      ttft.push(...m.ttftSamples);
    }
    const last = history[i + perBucket - 1];
    const computed = live + ghost;
    out.push({
      t: last.t,
      liveTokPerSec: live / bucketSec,
      ghostTokPerSec: ghost / bucketSec,
      idleTokPerSec: Math.max(0, (max - live - ghost) / bucketSec),
      goodputPct: computed === 0 ? 100 : Math.min(100, (100 * delivered) / computed),
      deliveredTokPerSec: delivered / bucketSec,
      activeUsers: last.activeUsers,
      ttftP50: percentile(ttft, 50), ttftP90: percentile(ttft, 90),
      shallow529: shallow, deep529: deepDq + deepPq, abandons, retries,
      decodeQueueDepth: last.decodeQueueDepth, prefillQueueDepth: last.prefillQueueDepth,
    });
  }
  return out;
}
```

`src/ui/components/PipelineStrip.tsx` — five stage cells with occupancy bars; age-based coloring:
```tsx
import type { PipelineSnapshot } from '../../engine/types';

function ageTone(oldestSec: number, timeoutSec: number): string {
  const f = oldestSec / timeoutSec;
  return f > 0.8 ? 'bad' : f > 0.5 ? 'warn' : 'good';
}

function Bar({ label, value, cap, tone }: { label: string; value: number; cap: number; tone: string }) {
  const pct = cap > 0 ? Math.min(100, (100 * value) / cap) : 0;
  return (
    <div className={`stage ${tone}`}>
      <span className="stage-label">{label}</span>
      <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
      <span className="stage-num">{value}{cap > 0 && cap < 100_000 ? `/${cap}` : ''}</span>
    </div>
  );
}

export function PipelineStrip({ snap, queueTimeoutSec }: { snap: PipelineSnapshot; queueTimeoutSec: number }) {
  return (
    <div className="pipeline-strip">
      <Bar label="admitted" value={snap.admittedCount} cap={snap.admissionLimit} tone="good" />
      <span className="arrow">→</span>
      <Bar label={`decode queue (oldest ${snap.oldestDecodeWaitSec.toFixed(0)}s)`}
        value={snap.decodeQueueDepth} cap={0}
        tone={ageTone(snap.oldestDecodeWaitSec, queueTimeoutSec)} />
      <span className="arrow">→</span>
      <Bar label={`decode slots (${snap.decodeServers} srv)`} value={snap.decodeSlotsHeld}
        cap={snap.decodeSlotsTotal} tone="good" />
      <span className="arrow">→</span>
      <Bar label={`prefill queue (oldest ${snap.oldestPrefillWaitSec.toFixed(0)}s)`}
        value={snap.prefillQueueDepth} cap={0}
        tone={ageTone(snap.oldestPrefillWaitSec, queueTimeoutSec)} />
      <span className="arrow">→</span>
      <Bar label={`prefill slots (${snap.prefillServers} srv)`} value={snap.prefillSlotsBusy}
        cap={snap.prefillSlotsTotal} tone="good" />
    </div>
  );
}
```

`src/ui/components/ChartsPanel.tsx` — four Recharts charts fed by `points`:
```tsx
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { GhostPoint } from '../useSimulation';
import type { ChartPoint } from '../chartData';

interface Props { points: ChartPoint[]; ghost: GhostPoint[] | null; theoreticalTokPerSec: number }

const fmtT = (t: number) => `${(t / 3600).toFixed(1)}h`;

export function ChartsPanel({ points, ghost }: Props) {
  const merged = points.map((p) => ({
    ...p,
    ghostGoodputPct: ghost
      ? ghost.reduce<number | null>((best, g) =>
          Math.abs(g.t - p.t) < 120 ? g.goodputPct : best, null)
      : null,
  }));
  return (
    <div className="charts">
      <div className="chart-box">
        <h4>Token spend — where the GPU cycles went</h4>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={merged}>
            <CartesianGrid strokeOpacity={0.15} />
            <XAxis dataKey="t" tickFormatter={fmtT} /><YAxis /><Tooltip /><Legend />
            <Area stackId="1" dataKey="liveTokPerSec" name="for live clients" fill="#3fb950" stroke="#3fb950" />
            <Area stackId="1" dataKey="ghostTokPerSec" name="for ghosts (waste)" fill="#f85149" stroke="#f85149" />
            <Area stackId="1" dataKey="idleTokPerSec" name="idle capacity" fill="#484f58" stroke="#484f58" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box">
        <h4>Goodput % (dashed = previous run)</h4>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={merged}>
            <CartesianGrid strokeOpacity={0.15} />
            <XAxis dataKey="t" tickFormatter={fmtT} /><YAxis domain={[0, 100]} /><Tooltip />
            <Line dataKey="goodputPct" name="goodput %" dot={false} stroke="#3fb950" />
            <Line dataKey="ghostGoodputPct" name="previous run" dot={false} stroke="#8b949e" strokeDasharray="5 4" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-row">
        <div className="chart-box half">
          <h4>Failures by depth (per interval)</h4>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={merged}>
              <XAxis dataKey="t" tickFormatter={fmtT} /><YAxis /><Tooltip /><Legend />
              <Bar stackId="f" dataKey="shallow529" name="529 at gate (cheap)" fill="#58a6ff" />
              <Bar stackId="f" dataKey="deep529" name="deep 529 (waste)" fill="#f85149" />
              <Bar stackId="f" dataKey="abandons" name="client gave up" fill="#d29922" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box half">
          <h4>TTFT p50/p90 (s) & active users</h4>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={merged}>
              <XAxis dataKey="t" tickFormatter={fmtT} /><YAxis /><Tooltip /><Legend />
              <Line dataKey="ttftP50" name="TTFT p50" dot={false} stroke="#58a6ff" />
              <Line dataKey="ttftP90" name="TTFT p90" dot={false} stroke="#d29922" />
              <Line dataKey="activeUsers" name="users" dot={false} stroke="#8b949e" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

Wire into `src/App.tsx`: compute `const points = bucketize(api.sim.history, api.scenario.id === 'rush-hour' ? 120 : 5, 400);` per render (renderSeq dependency), `<PipelineStrip snap={api.sim.snapshot()} queueTimeoutSec={api.sim.constants.queueTimeoutSec} />` above `<ChartsPanel …/>`.

- [ ] **Step 4: Verify**

Run: `npx vitest run` then `npm run dev` — play Rush Hour end to end (3 min at 480×). Confirm: green band dominates early, red band devours it near 11:30, gray disappears at saturation, pipeline strip shows decode slots pinned + prefill queue red, TTFT climbs toward client timeout.
Expected: the collapse is *visible* without reading a number.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/App.tsx
git commit -m "feat(ui): pipeline occupancy strip and chart panel with ghost overlay"
```

---

### Task 11: Narrator bar + win banner + final wiring

**Files:**
- Create: `src/ui/components/NarratorBar.tsx`
- Modify: `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `SimApi.narratorLog`, `finished`, `won`, `scenario.win`.
- Produces: `function NarratorBar(p: { log: NarratorMsg[]; finished: boolean; won: boolean | null; win?: WinCondition }): JSX.Element`

- [ ] **Step 1: Implement**

`src/ui/components/NarratorBar.tsx`:
```tsx
import { useState } from 'react';
import type { NarratorMsg, WinCondition } from '../../scenarios/types';

interface Props { log: NarratorMsg[]; finished: boolean; won: boolean | null; win?: WinCondition }

export function NarratorBar({ log, finished, won, win }: Props) {
  const [expanded, setExpanded] = useState(false);
  const latest = log[log.length - 1];
  return (
    <footer className={`narrator ${finished ? (won ? 'won' : won === false ? 'lost' : '') : ''}`}>
      {finished && win && won !== null ? (
        <p className="msg">{won ? `🏆 ${win.winText}` : `💀 ${win.loseText}`}</p>
      ) : latest ? (
        <p className="msg">{latest.text}</p>
      ) : (
        <p className="msg dim">Press Play. The narrator was there. He remembers.</p>
      )}
      {log.length > 1 && (
        <button className="tiny" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'hide' : `history (${log.length})`}
        </button>
      )}
      {expanded && (
        <ul className="log">{log.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
      )}
    </footer>
  );
}
```

Mount in `App.tsx` as the bottom grid row. Final `App.tsx` structure:
```tsx
<div className="console">
  <HeaderBar … />
  <div className="body-row">
    <DialsRail … />
    <main>
      <GoodputHeadline pct={goodput} />
      <PipelineStrip … />
      <ChartsPanel … />
    </main>
  </div>
  <NarratorBar log={api.narratorLog} finished={api.finished} won={api.won} win={api.scenario.win} />
</div>
```

- [ ] **Step 2: Verify the full loop (manual acceptance)**

Run: `npm run dev`. Acceptance script:
1. Rush Hour, hands off → collapse ~11:30, lose banner at end.
2. Reset → ghost line appears → lower admission limit to ~60 before 10 AM → win banner.
3. Narrator reacts to raising client timeout (>240s) and P:D shifts (>10 prefill).
4. Spike → watch no-recovery; Free Play → ⚡ Surge → recreate it; client-note fires on first client-dial change.

Expected: all four behaviors observed. Fix engine/scenario tuning if the win path is impossible or trivial — the win should require the gate.

- [ ] **Step 3: Run all tests, commit**

```bash
npx vitest run
git add src/ui src/App.tsx src/index.css
git commit -m "feat(ui): narrator bar, win/lose banner, full console wiring"
```

---

### Task 12: Visual design pass, build, deploy

**Files:**
- Modify: `src/index.css` (+ any component classNames), `README.md`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the finished app.
- Produces: deployed GitHub Pages URL; README with link, screenshot, run instructions.

- [ ] **Step 1: Visual design pass**

Invoke the `frontend-design:frontend-design` skill first, then restyle `src/index.css` within these bounds: dark ops-console aesthetic (deep neutral background, monospace numerals for metrics, restrained accent palette already used by charts: green #3fb950 / amber #d29922 / red #f85149 / blue #58a6ff / gray #484f58); the goodput headline is the largest element on screen; layout stays the Task 11 grid. No new dependencies, no layout rewrites.

- [ ] **Step 2: Deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx vitest run
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

Note for the human partner: enable Pages (Settings → Pages → Source: GitHub Actions) on the GitHub repo, and push to a GitHub remote if none exists yet.

- [ ] **Step 3: README**

Rewrite `README.md`: keep the existing war-story intro verbatim, add — live demo link, one screenshot (`docs/screenshot.png`, captured from the running app), "What you're looking at" (3 sentences: goodput vs throughput, the slot-holding cascade, the admission gate), local dev (`npm install && npm run dev`), test (`npm test`), and a pointer to the spec + plan under `docs/superpowers/`.

- [ ] **Step 4: Final verification + commit + push**

```bash
npx vitest run && npm run build
git add -A ':!Resume-Doumaux.md' ':!SWE_take-home-assignment.md'
git commit -m "feat: visual design pass, deploy workflow, README"
```
Then push, watch the Actions run, open the Pages URL, and run the Task 11 acceptance script once against production.

---

## Self-Review (performed at write time)

- **Spec coverage:** engine rules §3 → Tasks 3–5; calibration gate §7 → Task 6; dials/constants/outputs §4 → Tasks 2, 9, 10 (streaming stretch intentionally unplanned — add only if all 12 tasks land inside ~5h); UI §5 → Tasks 8–11; scenarios/narration §6 → Task 7 + 11; deploy §8 → Tasks 1, 12. Video + written rationale are human-partner deliverables outside this plan.
- **Metric refinement:** the token-spend chart's live/ghost/idle formulation refines spec §3.5's "waste by death stage" (queue deaths compute no tokens; they're charted as failure depth instead) — recorded in Global Constraints and flagged to the human partner.
- **Type consistency:** `Dials`/`Constants`/`TickMetrics`/`PipelineSnapshot` names verified identical across Tasks 2–10; `SimApi` names verified across Tasks 8–11; `goodputPctWindow`/`rollingGoodputPct`/`percentile`/`bucketize` signatures consistent.
- **Placeholder scan:** clean — every step has runnable content or an explicit manual acceptance script.
