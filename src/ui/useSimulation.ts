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
