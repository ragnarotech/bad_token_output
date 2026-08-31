import { memo, useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { GhostPoint } from '../useSimulation';
import type { ChartPoint } from '../chartData';
import { fmtTok2 } from '../format';

interface Props { points: ChartPoint[]; ghost: GhostPoint[] | null; durationSec: number }

const H = 3600;
const fmtMin = (t: number) => `${Math.round(t / 60)}m`;
const fmtHour = (t: number) => `${(t / H).toFixed(1)}h`;
const fmtPct2 = (v: number) => `${Number(v).toFixed(2)}%`;
const fmtTpm = (v: number) => `${fmtTok2(v)} TPM`;

/**
 * Time axis: numeric, and for a finite scenario pinned to the whole run from
 * t=0 — like a dashboard with a fixed time range, the day fills in left to
 * right. A category axis stretches however many points exist across the full
 * width, so early in a run the tooltip snaps to a bucket tens of pixels from
 * the pointer; with real time on the axis the snap is at most half a bucket.
 */
function timeAxis(durationSec: number, lastT: number) {
  const span = Number.isFinite(durationSec) ? durationSec : lastT;
  const fmt = span < 2 * H ? fmtMin : fmtHour;
  if (!Number.isFinite(durationSec)) return { domain: ['dataMin', 'dataMax'] as const, ticks: undefined, fmt };
  const step = [60, 120, 300, 600, 1800, H, 2 * H, 4 * H].find((s) => durationSec / s <= 8) ?? 4 * H;
  const ticks: number[] = [];
  for (let t = 0; t <= durationSec + 1; t += step) ticks.push(t);
  return { domain: [0, Math.max(durationSec, lastT)] as const, ticks, fmt };
}

function ChartsPanelImpl({ points, ghost, durationSec }: Props) {
  const lastT = points.length ? points[points.length - 1].t : 0;
  const axis = useMemo(() => timeAxis(durationSec, lastT), [durationSec, lastT]);
  // Goodput chart: current run, plus the previous run's line for the part of the
  // day this run has not reached yet — the ghost is the whole previous day.
  const goodputData = useMemo(() => {
    const merged = points.map((p) => {
      let ghostGoodputPct: number | null = null;
      if (ghost) {
        let bestDist = 120;
        for (const g of ghost) {
          const d = Math.abs(g.t - p.t);
          if (d < bestDist) { bestDist = d; ghostGoodputPct = g.goodputPct; }
        }
      }
      return { t: p.t, goodputPct: p.goodputPct as number | null, ghostGoodputPct };
    });
    if (ghost) {
      for (const g of ghost) {
        if (g.t > lastT) merged.push({ t: g.t, goodputPct: null, ghostGoodputPct: g.goodputPct });
      }
    }
    return merged;
  }, [points, ghost, lastT]);
  const xAxis = (
    <XAxis dataKey="t" type="number" domain={axis.domain as unknown as [number, number]}
      ticks={axis.ticks} tickFormatter={axis.fmt} allowDataOverflow />
  );
  return (
    <div className="charts">
      <div className="chart-box">
        <h4>Token spend (TPM) — where the GPU cycles went</h4>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <CartesianGrid strokeOpacity={0.15} />
            {xAxis}
            <YAxis tickFormatter={fmtTok2} />
            <Tooltip labelFormatter={axis.fmt} formatter={(value: number, name: string) => [fmtTpm(value), name]} />
            <Legend />
            <Area stackId="1" dataKey="liveTpm" name="for live clients" fill="#3fb950" stroke="#3fb950" isAnimationActive={false} />
            <Area stackId="1" dataKey="ghostTpm" name="for ghosts (waste)" fill="#f85149" stroke="#f85149" isAnimationActive={false} />
            <Area stackId="1" dataKey="idleTpm" name="idle capacity" fill="#484f58" stroke="#484f58" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box">
        <h4>Goodput % (dashed = previous run)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={goodputData}>
            <CartesianGrid strokeOpacity={0.15} />
            {xAxis}
            <YAxis domain={[0, 100]} />
            <Tooltip labelFormatter={axis.fmt} formatter={(value: number, name: string) => [fmtPct2(value), name]} />
            <Line dataKey="goodputPct" name="goodput %" dot={false} stroke="#3fb950" isAnimationActive={false} />
            <Line dataKey="ghostGoodputPct" name="previous run" dot={false} stroke="#8b949e" strokeDasharray="5 4" connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-row">
        <div className="chart-box half">
          <h4>Failures by depth (per interval)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points}>
              {xAxis}<YAxis /><Tooltip labelFormatter={axis.fmt} /><Legend />
              <Bar stackId="f" dataKey="shallow529" name="529 at gate (cheap)" fill="#58a6ff" isAnimationActive={false} />
              <Bar stackId="f" dataKey="deep529" name="deep 529 (waste)" fill="#f85149" isAnimationActive={false} />
              <Bar stackId="f" dataKey="abandons" name="client abandoned (timeout)" fill="#d29922" isAnimationActive={false} />
              <Bar stackId="f" dataKey="giveUps" name="gave up (10 retries)" fill="#8b949e" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box half">
          <h4>TTFT p50/p90 (s) & active users</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              {xAxis}<YAxis /><Tooltip labelFormatter={axis.fmt} /><Legend />
              <Line dataKey="ttftP50" name="TTFT p50" dot={false} stroke="#58a6ff" isAnimationActive={false} />
              <Line dataKey="ttftP90" name="TTFT p90" dot={false} stroke="#d29922" isAnimationActive={false} />
              <Line dataKey="activeUsers" name="users" dot={false} stroke="#8b949e" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export const ChartsPanel = memo(ChartsPanelImpl);
