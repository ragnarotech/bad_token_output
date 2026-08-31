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

const SPEEDS = [15, 30, 60, 240, 480, 960];

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
