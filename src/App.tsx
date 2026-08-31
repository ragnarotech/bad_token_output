import { useMemo } from 'react';
import { DialsRail } from './ui/components/DialsRail';
import { GoodputHeadline } from './ui/components/GoodputHeadline';
import { HeaderBar } from './ui/components/HeaderBar';
import { PipelineStrip } from './ui/components/PipelineStrip';
import { ChartsPanel } from './ui/components/ChartsPanel';
import { NarratorBar } from './ui/components/NarratorBar';
import { rollingGoodputPct, useSimulation } from './ui/useSimulation';
import { bucketize } from './ui/chartData';

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

  // Compute chart data points — re-bucketize only when chartSeq advances (throttled
  // to ~1/sec in useSimulation), not on every ~10fps render.
  const points = useMemo(
    () => bucketize(api.sim.history, api.scenario.id === 'rush-hour' ? 120 : 5, 400),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.chartSeq, api.scenario.id],
  );

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
      <div className="body-row">
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
          <PipelineStrip snap={api.sim.snapshot()} queueTimeoutSec={api.sim.constants.queueTimeoutSec} />
          <ChartsPanel points={points} ghost={api.ghost} />
        </main>
      </div>
      <NarratorBar log={api.narratorLog} finished={api.finished} won={api.won} win={api.scenario.win} />
    </div>
  );
}
