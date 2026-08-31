import { DialsRail } from './ui/components/DialsRail';
import { GoodputHeadline } from './ui/components/GoodputHeadline';
import { HeaderBar } from './ui/components/HeaderBar';
import { rollingGoodputPct, useSimulation } from './ui/useSimulation';

export default function App() {
  const api = useSimulation();
  const goodput = rollingGoodputPct(api.sim.history, 60);

  // Compute usefulTpm: sum of deliveredTok over trailing 60 sim-seconds
  let usefulTpm = 0;
  if (api.sim.history.length > 0) {
    const lastMetric = api.sim.history[api.sim.history.length - 1];
    const cutoffTime = lastMetric.t - 60;
    for (let i = api.sim.history.length - 1; i >= 0; i--) {
      const m = api.sim.history[i];
      if (m.t >= cutoffTime) {
        usefulTpm += m.deliveredTok;
      } else {
        break;
      }
    }
  }

  // Compute theoreticalTpm: last.theoreticalMaxTok * 240
  let theoreticalTpm = 0;
  if (api.sim.history.length > 0) {
    const lastMetric = api.sim.history[api.sim.history.length - 1];
    theoreticalTpm = lastMetric.theoreticalMaxTok * 240;
  }

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
      <div className="main-container">
        <DialsRail
          dials={api.sim.dials}
          decodeServers={api.sim.decodeServers}
          isFreePlay={api.scenario.id === 'free-play'}
          onChange={api.changeDials}
          onSurge={api.surge}
        />
        <main>
          <GoodputHeadline
            pct={goodput}
            usefulTpm={usefulTpm}
            theoreticalTpm={theoreticalTpm}
            helpTickets={api.sim.totalGiveUps}
          />
        </main>
      </div>
    </div>
  );
}
