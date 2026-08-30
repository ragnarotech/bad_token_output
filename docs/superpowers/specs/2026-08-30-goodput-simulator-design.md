# The Goodput Simulator — Design Spec

**Date:** 2026-08-30
**Author:** Andrew Doumaux (with Claude Code)
**Status:** Approved pending final review

## 1. Context & Goal

Take-home assignment for Anthropic (target 1–2h, hard cap 8h; budget for this
project: **4–6 hours** including video + written rationale). Theme: **Theme 1,
Exploration & Understanding** — "a simulation of emergent dynamics" — with
Theme 3 (Systems & Reliability) domain credibility.

The simulator recreates a production incident pattern the author operated
through: a frontier LLM deployed on an air-gapped network with fixed capacity
and demand far exceeding supply. GPUs at 100% utilization delivered near-zero
useful output because timeouts and retries turned the workload into waste.

**The core insight the tool teaches (the "aha"):** the best lever is the
counterintuitive one. Obvious fixes (more prefill servers, longer timeouts)
fail or barely help; **admitting fewer requests serves more tokens.** Failing
cheap at the front door beats failing expensive deep in the pipeline.
Supporting insights that emerge along the way:
- Throughput ≠ goodput: a 100%-busy GPU can be producing ~0 delivered tokens.
- Retries *are* the load: past the collapse point, the system does not recover
  even when demand drops back below capacity (metastable failure).
- The cost of a failure rises with its depth in the pipeline.

**Reviewer experience requirement:** the aha must be reachable in ~2 minutes
of interaction via a guided scenario. Fully self-contained: no data, no keys,
no backend — a static site.

## 2. Experience Shape

A **live operator console** with **guided scenarios**. The sim runs
continuously in accelerated sim-time; the user turns dials *while it runs*
and watches queues, slot occupancy, and goodput respond with realistic lag.
Collapse is something you watch happen — and dig yourself out of. A scripted
narrator guides scenarios; free play follows.

"Live" means live-updating charts and occupancy bars redrawn per tick — NOT
per-request animated dots (explicit scope control).

## 3. Simulation Engine (headless, pure TypeScript)

### 3.1 Time model
- Fixed timestep: `dt = 250ms` sim-time per tick.
- Wall-clock acceleration adjustable (1×–120×); a 24h scenario day plays in
  ~2–3 minutes.
- **Seeded RNG everywhere.** A scenario run is reproducible: failed run and
  fixed run see identical arrival sequences, making before/after honest.

### 3.2 Capacity model
- Fixed GPU budget (e.g. 24 GPUs).
- P:D slider partitions it (corrected in plan review from the earlier 1.5:1 estimate): **prefill server = 2.5 GPUs, decode server = 1 GPU.**
- Frozen constants: slots per decode server, slots per prefill server.
- **Shared-throughput rule:** a server's tok/s is divided equally among its
  occupied slots (8 requests on one decode server each stream at 1/8 speed).
  This yields TPOT degradation under load mechanically, which is what makes
  "admit less, serve more" true rather than asserted.

### 3.3 Request lifecycle (state machine)

```
created → ADMISSION GATE ── over limit? → instant 529 (cheap) → client retry
        → decode queue   ── wait >30s?  → 529; waste: client time only
        → decode slot HELD → prefill queue ── wait >30s? → 529; waste: held slot
        → prefilling (promptTokens ÷ share of prefill tok/s)
        → decoding in held slot (outputTokens ÷ share of decode tok/s); TTFT recorded
        → delivered ✓  goodput += input+output tokens
```

- **Oblivious-server rule (v1):** the server never detects client disconnect.
  Once admitted, a request lives out its whole lifecycle even if the client
  abandoned it in the decode queue — holding a slot, burning a full prefill,
  decoding to a dead socket. All its tokens count as waste ("computed for a
  ghost"). True to the black-box vendor stack operated in production, where
  prefill ran for every request regardless of client presence.
- **Client watchdog:** if TTFT (queue waits + prefill) exceeds the client
  timeout, the client abandons and schedules a retry — while the server keeps
  computing. Zombie work + its own retry is the double-load mechanism behind
  metastable collapse.

### 3.4 Clients & workloads
- N users, each a tiny agent: think-time between requests; on
  failure/abandonment, retries per strategy (exponential backoff + jitter):
  - **Aggressive:** caps at 10s max backoff.
  - **Patient:** caps at 5min max backoff.
- Workload presets (named, with baked-in token distributions — no raw token
  sliders):
  - **Agentic dev:** prompts ~50k–1M tokens skewed large; outputs ~200–2k.
  - **Chat:** medium prompts / medium outputs.
- Scenario load curves modulate active-user count over sim-time.

### 3.5 Per-tick metrics (ring buffer consumed by UI)
Goodput tok/s (in + out); wasted tok/s **by death stage** (died-in-decode-queue,
died-in-prefill-queue-holding-slot, computed-for-a-ghost); queue depths; slot
occupancy; TTFT/TPOT rolling percentiles; 529s split shallow (admission) vs
deep (past first gate); retries in flight; active users.

### 3.6 Explicitly NOT modeled (v1 cuts, each one line in the rationale)
- Prompt caching (both scalar hit% and thrash dynamics) — without it every
  retry costs full price, which sharpens the retry-storm lesson.
- Batching internals, KV-cache memory, network transit, per-server placement
  (slots are pooled per role).
- Decode early-exit on broken pipe — second-order at agentic-dev prompt scale;
  arrives with the streaming stretch, where it belongs.

## 4. Dials, Constants, Outputs

### Dials — Client behavior group
(narrator note: in production you don't own these; you publish best-practices
docs and hope)
| Dial | Range/values |
|---|---|
| Workload preset | agentic-dev / chat — listed first: an organization *falls into* a workload behavior, and in a closed/air-gapped population there is no law-of-large-numbers smoothing toward an even mix; you get one org's skew, undiluted |
| Client timeout | 30s ↔ 5min |
| Retry strategy | aggressive (10s cap) / patient (5min cap) |
| # users | slider |

### Dials — Server config group (the ones you own)
| Dial | Notes |
|---|---|
| **Admission limit** | THE hero dial; max concurrent admitted; top of group, visually prominent |
| P:D split | repartitions fixed GPU budget at 2.5:1 cost — equal slots-per-server on both roles makes 'equal server counts' the easy answer, but the true optimum under agentic-dev is prefill-heavy and worth discovering: officials want max TPM, and only TPMs that reach users count |

### Frozen constants
GPU budget; slots per decode server; slots per prefill server (equal to the
decode value by design); client max retries = 10 (the Claude Code default —
where aggressive backoff bites; users who raised it to 1,000 existed but were
the minority); both queue timeouts = 30s; **prefill tok/s and decode tok/s per server** (tied to
model/vendor/hardware — not operator-tunable). Exact values for GPU budget,
slots-per-server, and tok/s rates are calibrated during the engine-validation
step (Section 7): they are chosen so the three qualitative invariants emerge
at realistic dial settings, then frozen.

### Outputs
Headline **Goodput %** (delivered tokens ÷ tokens GPUs actually spent), big and
color-coded. TPM in/out vs theoretical max. TTFT/TPOT. Deep-529 count (made it
past the first gate) vs shallow. Wasted prefill tokens. Client
failures/retries. Give-ups (client exhausted its 10 retries) surfaced as a
cumulative **🎫 help-tickets counter**: each one is a user who fired off
agentic work, left for a meeting, and came back to a dead session — a
"continue" prompt for them, a ticket in the devops queue for you. The CEO
reads TPM; devops reads tickets. Live queue depth + slot occupancy.

### Stretch #1 (only if inside ~5h): Streaming toggle
Changes timeout semantics (non-streaming: client timeout covers queue + prefill
+ entire decode; streaming: client is safe once first token flows) AND adds
server-side disconnect detection on first token write (streaming frees the slot
early — partial waste; non-streaming discovers at final write — total waste).
Motivated by production: overnight `claude -p` cron traffic was non-streaming
by default, learned the hard way.

## 5. UI — the Operator Console (React + Recharts, one screen)

```
┌──────────────────────────────────────────────────────────────┐
│ ⏱ 11:34 AM  ▶ ⏸ speed:60×   [Scenario: Rush Hour ▾] [Reset] │
├────────────┬─────────────────────────────────────────────────┤
│  DIALS     │   GOODPUT  34%  (headline, red when bad)        │
│  (client / │   PIPELINE occupancy strip                      │
│   server   │   CHARTS (scrolling, sim-time x-axis)           │
│   groups)  │                                                 │
├────────────┴─────────────────────────────────────────────────┤
│  NARRATOR bar (scripted messages / event ticker)             │
└──────────────────────────────────────────────────────────────┘
```

1. **Dials rail:** two groups, *Client behavior* vs *Server config*; admission
   limit prominent at top of server group.
2. **Pipeline occupancy strip:** bars for each stage (admission → decode queue
   → decode slots → prefill queue → prefill slots); bar color shifts
   green→amber→red as the oldest waiter approaches the 30s timeout. The
   signature pathology must be visible at a glance: decode slots 100% held,
   prefill queue overflowing, decode servers idle. No per-request animation.
3. **Charts:** the **stacked token-spend area chart is the centerpiece**
   (green = goodput; waste bands colored by death stage). Supporting: offered
   load vs capacity vs delivered; TTFT/TPOT percentiles; 529s + retries.
4. **Narrator bar:** guided-scenario messages; event ticker in free play.

**Ghost run:** same seed ⇒ same arrivals; on scenario re-run, the previous
run's goodput line renders dashed on the charts. "Same day, same users, one
dial different."

Visual design pass at implementation time (frontend-design skill); dark
ops-console aesthetic.

## 6. Scenarios & Narration

Scenario = `{ load curve, workload, starting dials, narrator script, win
condition }` — pure data, ~50 lines each.

1. **Rush Hour** (flagship; the true story). Diurnal 24h curve, agentic-dev,
   admission limit wide open. Overnight calm (cron traffic; narrator teaches
   the console). 9am ramp. ~10am oversubscribed but goodput decent ("demand
   now exceeds supply, but we're fine. Are we?"). 11:30 collapse ("Nothing is
   broken. Everything is busy. Welcome to the worst kind of outage."). 3pm
   exodus; system limps back. Close: "Today, your fix was the end of the
   workday. Run it again — this time, the dials are yours." Re-run with ghost
   line; win = goodput above threshold through the 9–3 window. Narrator reacts
   differently to obvious-fix attempts (more prefill servers, longer timeouts)
   before the counterintuitive one lands.
2. **The Spike** (teaches "retries are the load"). Steady ~90% capacity, a
   10-minute demand spike, then back to 90% — and the system never recovers
   unaided: queues full of zombies and retries. Metastability isolated from
   the diurnal drama. Plays in ~60 seconds.
3. **Free play.** All dials; flat/ramp/diurnal load; **⚡ Surge button**
   injects a momentary demand spike so users can recreate The Spike against
   their own configuration. Narrator becomes an event ticker.

Narrator engine: ordered `{ trigger: simTime | state-predicate, message,
once: true }`, checked per tick. No LLM. Message copy carries the author's
ops voice and is polishable late without code changes.

## 7. Testing Strategy

- **TDD on the engine:** slot accounting, timeout transitions, retry
  scheduling, waste attribution by stage, seeded determinism.
- **Three qualitative invariants as headless integration tests — the collapse
  must emerge before any React is written:**
  1. Under-capacity load → ~100% goodput.
  2. Rush-hour curve without admission gate → collapse, and no recovery until
     load drops.
  3. Same curve with admission gate → goodput stays high.
- UI: hand-tested + one smoke test. Budget goes to the engine; the rationale
  says so explicitly as a conscious scoping decision.

## 8. Architecture & Repo

- `engine/` — pure TS, zero dependencies, no DOM. Exposes: create(config,
  seed) → tick(dt) → state snapshot + metrics ring buffer.
- `ui/` — React + TypeScript + Recharts (Vite). Subscribes to engine ticks.
- `scenarios/` — data modules (curves + scripts + win conditions).
- Deploy: static build → GitHub Pages or Vercel.

## 9. Time Budget (~4–6h total)

| Phase | Est. |
|---|---|
| Engine + tests (incl. collapse validation) | ~1h |
| UI console | ~2h |
| Scenarios + narration + polish | ~1h |
| Deploy | ~30m |
| Slack / streaming stretch (only if inside 5h) | remainder |
| Video + written rationale | separate, budgeted |

## 10. Deliverables Checklist (from assignment)

- [ ] Deployed prototype link (static site; no install, no keys)
- [ ] GitHub repo
- [ ] ~5min video rationale (open with the war story)
- [ ] Written rationale: theme choice, non-obvious insight, key decisions &
      cuts (each v1 cut gets its line), extensions, hours spent
- [ ] Claude/AI transcripts (this design session included)

## 11. Future Work (rationale material)

- Prompt cache: scalar hit% first, then eviction/thrash dynamics under
  diverse traffic (observed in production; second-order but real).
- Streaming toggle if it doesn't make v1 (semantics + early slot release).
- Decode early-exit on client disconnect (streaming case).
- Best-practices adoption modeling: you can't set client dials, but comms
  shift user behavior slowly and partially.
- Multi-tenant fairness / per-team rate limits (LiteLLM-gateway experience).
- Per-user retry-cap overrides (the 1,000-retry power user vs the default-10 majority).
