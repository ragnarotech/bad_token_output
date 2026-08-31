import type { PipelineSnapshot } from '../../engine/types';

function ageTone(oldestSec: number, timeoutSec: number): string {
  const f = oldestSec / timeoutSec;
  return f > 0.8 ? 'bad' : f > 0.5 ? 'warn' : 'good';
}

function Bar({ label, value, cap, tone }: { label: string; value: number; cap: number; tone: string }) {
  const pct = cap > 0 ? Math.min(100, (100 * value) / cap) : 0;
  return (
    <div className={`stage ${tone}`}>
      <span className="stage-label">{label}</span>
      <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
      <span className="stage-num">{value}{cap > 0 && cap < 100_000 ? `/${cap}` : ''}</span>
    </div>
  );
}

export function PipelineStrip({ snap, queueTimeoutSec }: { snap: PipelineSnapshot; queueTimeoutSec: number }) {
  return (
    <div className="pipeline-strip">
      <Bar label="admitted" value={snap.admittedCount} cap={snap.admissionLimit} tone="good" />
      <span className="arrow">→</span>
      <Bar label={`decode queue (oldest ${snap.oldestDecodeWaitSec.toFixed(0)}s)`}
        value={snap.decodeQueueDepth} cap={0}
        tone={ageTone(snap.oldestDecodeWaitSec, queueTimeoutSec)} />
      <span className="arrow">→</span>
      <Bar label={`decode slots (${snap.decodeServers} srv)`} value={snap.decodeSlotsHeld}
        cap={snap.decodeSlotsTotal} tone="good" />
      <span className="arrow">→</span>
      <Bar label={`prefill queue (oldest ${snap.oldestPrefillWaitSec.toFixed(0)}s)`}
        value={snap.prefillQueueDepth} cap={0}
        tone={ageTone(snap.oldestPrefillWaitSec, queueTimeoutSec)} />
      <span className="arrow">→</span>
      <Bar label={`prefill slots (${snap.prefillServers} srv)`} value={snap.prefillSlotsBusy}
        cap={snap.prefillSlotsTotal} tone="good" />
    </div>
  );
}
