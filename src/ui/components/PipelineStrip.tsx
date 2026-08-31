import type { PipelineSnapshot } from '../../engine/types';

function ageTone(oldestSec: number, timeoutSec: number): string {
  const f = oldestSec / timeoutSec;
  return f > 0.8 ? 'bad' : f > 0.5 ? 'warn' : 'good';
}

interface BarProps {
  label: string; value: number; tone: string;
  /** Hard capacity: fill = value/cap and the number reads "value/cap". */
  cap?: number;
  /** Reference scale for unbounded stages (queues): fill = value/scale, capped at full. */
  scale?: number;
}

function Bar({ label, value, cap, scale, tone }: BarProps) {
  const ref = cap ?? scale ?? 0;
  const pct = ref > 0 ? Math.min(100, (100 * value) / ref) : 0;
  const showCap = cap !== undefined && cap > 0 && cap < 100_000;
  return (
    <div className={`stage ${tone}`}>
      <span className="stage-label">{label}</span>
      <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
      <span className="stage-num">{value}{showCap ? `/${cap}` : ''}</span>
    </div>
  );
}

export function PipelineStrip({ snap, queueTimeoutSec }: { snap: PipelineSnapshot; queueTimeoutSec: number }) {
  return (
    <div className="pipeline-strip">
      {/* Gate OFF (limit 100000): no cap to fill against, so scale to the decode slot pool. */}
      {snap.admissionLimit < 100_000
        ? <Bar label="admitted" value={snap.admittedCount} cap={snap.admissionLimit} tone="good" />
        : <Bar label="admitted (gate off)" value={snap.admittedCount} scale={snap.decodeSlotsTotal} tone="good" />}
      <span className="arrow">→</span>
      {/* Queues are unbounded, so the fill is scaled against the slots they feed:
          a full bar means the backlog is at least one whole slot pool deep. */}
      <Bar label={`decode queue (oldest ${snap.oldestDecodeWaitSec.toFixed(0)}s)`}
        value={snap.decodeQueueDepth} scale={snap.decodeSlotsTotal}
        tone={ageTone(snap.oldestDecodeWaitSec, queueTimeoutSec)} />
      <span className="arrow">→</span>
      <Bar label={`decode slots (${snap.decodeServers} srv)`} value={snap.decodeSlotsHeld}
        cap={snap.decodeSlotsTotal} tone="good" />
      <span className="arrow">→</span>
      <Bar label={`prefill queue (oldest ${snap.oldestPrefillWaitSec.toFixed(0)}s)`}
        value={snap.prefillQueueDepth} scale={snap.prefillSlotsTotal}
        tone={ageTone(snap.oldestPrefillWaitSec, queueTimeoutSec)} />
      <span className="arrow">→</span>
      <Bar label={`prefill slots (${snap.prefillServers} srv)`} value={snap.prefillSlotsBusy}
        cap={snap.prefillSlotsTotal} tone="good" />
    </div>
  );
}
