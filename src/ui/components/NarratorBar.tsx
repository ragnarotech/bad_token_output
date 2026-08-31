import { useState } from 'react';
import type { NarratorMsg, WinCondition } from '../../scenarios/types';

interface Props { log: NarratorMsg[]; finished: boolean; won: boolean | null; win?: WinCondition }

export function NarratorBar({ log, finished, won, win }: Props) {
  const [expanded, setExpanded] = useState(false);
  const latest = log[log.length - 1];
  return (
    <footer className={`narrator ${finished ? (won ? 'won' : won === false ? 'lost' : '') : ''}`}>
      {finished && win && won !== null ? (
        <p className="msg">{won ? `🏆 ${win.winText}` : `💀 ${win.loseText}`}</p>
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
