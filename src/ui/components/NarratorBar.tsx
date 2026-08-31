import { useState } from 'react';
import type { NarratorMsg } from '../../scenarios/types';
import type { Verdict } from '../../scenarios/win';

interface Props { log: NarratorMsg[]; finished: boolean; verdict: Verdict | null }

export function NarratorBar({ log, finished, verdict }: Props) {
  const [expanded, setExpanded] = useState(false);
  const latest = log[log.length - 1];
  return (
    <footer className={`narrator ${finished && verdict ? (verdict.won ? 'won' : 'lost') : ''}`}>
      {finished && verdict ? (
        <p className="msg">{verdict.won ? `🏆 ${verdict.text}` : `💀 ${verdict.text}`}</p>
      ) : latest ? (
        <p className="msg">{latest.text}</p>
      ) : (
        <p className="msg dim">Press Play. The narrator was there. He remembers.</p>
      )}
      {log.length > 1 && (
        <button className="tiny" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'hide' : `history (${log.length})`}
        </button>
      )}
      {expanded && (
        <ul className="log">{log.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
      )}
    </footer>
  );
}
