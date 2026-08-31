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
              <Bar stackId="f" dataKey="abandons" name="client abandoned (timeout)" fill="#d29922" />
              <Bar stackId="f" dataKey="giveUps" name="gave up (10 retries)" fill="#8b949e" />
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
