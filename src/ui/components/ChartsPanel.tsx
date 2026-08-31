import { memo, useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { GhostPoint } from '../useSimulation';
import type { ChartPoint } from '../chartData';
import { fmtTok2 } from '../format';

interface Props { points: ChartPoint[]; ghost: GhostPoint[] | null; theoreticalTokPerSec: number }

const fmtT = (t: number) => `${(t / 3600).toFixed(1)}h`;
const fmtPct2 = (v: number) => `${Number(v).toFixed(2)}%`;

function ChartsPanelImpl({ points, ghost }: Props) {
  const merged = useMemo(() => points.map((p) => {
    let ghostGoodputPct: number | null = null;
    if (ghost) {
      let bestDist = 120;
      for (const g of ghost) {
        const d = Math.abs(g.t - p.t);
        if (d < bestDist) { bestDist = d; ghostGoodputPct = g.goodputPct; }
      }
    }
    return { ...p, ghostGoodputPct };
  }), [points, ghost]);
  return (
    <div className="charts">
      <div className="chart-box">
        <h4>Token spend — where the GPU cycles went</h4>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={merged}>
            <CartesianGrid strokeOpacity={0.15} />
            <XAxis dataKey="t" tickFormatter={fmtT} />
            <YAxis tickFormatter={fmtTok2} />
            <Tooltip formatter={(value: number, name: string) => [fmtTok2(value), name]} />
            <Legend />
            <Area stackId="1" dataKey="liveTokPerSec" name="for live clients" fill="#3fb950" stroke="#3fb950" isAnimationActive={false} />
            <Area stackId="1" dataKey="ghostTokPerSec" name="for ghosts (waste)" fill="#f85149" stroke="#f85149" isAnimationActive={false} />
            <Area stackId="1" dataKey="idleTokPerSec" name="idle capacity" fill="#484f58" stroke="#484f58" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box">
        <h4>Goodput % (dashed = previous run)</h4>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={merged}>
            <CartesianGrid strokeOpacity={0.15} />
            <XAxis dataKey="t" tickFormatter={fmtT} />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(value: number, name: string) => [fmtPct2(value), name]} />
            <Line dataKey="goodputPct" name="goodput %" dot={false} stroke="#3fb950" isAnimationActive={false} />
            <Line dataKey="ghostGoodputPct" name="previous run" dot={false} stroke="#8b949e" strokeDasharray="5 4" connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-row">
        <div className="chart-box half">
          <h4>Failures by depth (per interval)</h4>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={merged}>
              <XAxis dataKey="t" tickFormatter={fmtT} /><YAxis /><Tooltip /><Legend />
              <Bar stackId="f" dataKey="shallow529" name="529 at gate (cheap)" fill="#58a6ff" isAnimationActive={false} />
              <Bar stackId="f" dataKey="deep529" name="deep 529 (waste)" fill="#f85149" isAnimationActive={false} />
              <Bar stackId="f" dataKey="abandons" name="client abandoned (timeout)" fill="#d29922" isAnimationActive={false} />
              <Bar stackId="f" dataKey="giveUps" name="gave up (10 retries)" fill="#8b949e" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box half">
          <h4>TTFT p50/p90 (s) & active users</h4>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={merged}>
              <XAxis dataKey="t" tickFormatter={fmtT} /><YAxis /><Tooltip /><Legend />
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
