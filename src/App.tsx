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
