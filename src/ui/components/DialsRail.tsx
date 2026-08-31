import type { Dials } from '../../engine/types';

interface Props {
  dials: Dials;
  decodeServers: number;
  isFreePlay: boolean;
  onChange(patch: Partial<Dials>): void;
  onSurge(): void;
}

export function DialsRail({ dials, decodeServers, isFreePlay, onChange, onSurge }: Props) {
  return (
    <aside className="dials-rail">
      <section>
        <h3>Server config <span className="own">you own these</span></h3>
        <label className="hero">
          Admission limit: {dials.admissionLimit >= 100_000 ? 'OFF' : dials.admissionLimit}
          <input type="range" min={10} max={300} step={5}
            value={Math.min(dials.admissionLimit, 300)}
            onChange={(e) => onChange({ admissionLimit: Number(e.target.value) })} />
          <button className="tiny" onClick={() => onChange({ admissionLimit: 100_000 })}>disable gate</button>
        </label>
        <label>
          P:D split — {dials.prefillServers} prefill / {decodeServers} decode
          <input type="range" min={0} max={9} step={1} value={dials.prefillServers}
            onChange={(e) => onChange({ prefillServers: Number(e.target.value) })} />
          <span className="hint">prefill costs 2.5 GPUs, decode 1 — fixed budget</span>
        </label>
      </section>
      <section>
        <h3>Client behavior <span className="own">in prod: a best-practices doc and hope</span></h3>
        <label>
          Workload
          <select value={dials.workload}
            onChange={(e) => onChange({ workload: e.target.value as Dials['workload'] })}>
            <option value="agentic-dev">Agentic dev (huge prompts)</option>
            <option value="chat">Chat (medium prompts)</option>
          </select>
        </label>
        <label>
          Client timeout: {dials.clientTimeoutSec}s
          <input type="range" min={30} max={300} step={15} value={dials.clientTimeoutSec}
            onChange={(e) => onChange({ clientTimeoutSec: Number(e.target.value) })} />
        </label>
        <label>
          Retry strategy
          <select value={dials.retryStrategy}
            onChange={(e) => onChange({ retryStrategy: e.target.value as Dials['retryStrategy'] })}>
            <option value="aggressive">Aggressive (10s max backoff)</option>
            <option value="patient">Patient (5min max backoff)</option>
          </select>
        </label>
        {isFreePlay && (
          <>
            <label>
              Users: {dials.numUsers}
              <input type="range" min={1} max={150} step={1} value={dials.numUsers}
                onChange={(e) => onChange({ numUsers: Number(e.target.value) })} />
            </label>
            <button className="surge" onClick={onSurge}>⚡ Surge (+60 users, 60s)</button>
          </>
        )}
      </section>
    </aside>
  );
}
