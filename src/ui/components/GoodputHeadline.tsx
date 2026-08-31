import { fmtTok } from '../format';

interface Props { pct: number; usefulTpm: number; theoreticalTpm: number; helpTickets: number }

export function GoodputHeadline({ pct, usefulTpm, theoreticalTpm, helpTickets }: Props) {
  const tone = pct >= 70 ? 'good' : pct >= 35 ? 'warn' : 'bad';
  return (
    <div className={`goodput-headline ${tone}`}>
      <span className="label">GOODPUT</span>
      <span className="value">{pct.toFixed(0)}%</span>
      <span className="tpm" title="Completions credit their full prompt+output at delivery, so a draining backlog can burst above theoretical for a window — that's real delivered work, not an error">useful TPM {fmtTok(usefulTpm)} <em>of {fmtTok(theoreticalTpm)} theoretical</em></span>
      <span className={`tickets ${helpTickets > 0 ? 'warn' : ''}`} title="Sessions dead after 10 retries — each one is a user telling their agent 'continue' and filing a ticket">🎫 help tickets: {helpTickets}</span>
      <span className="sub">delivered tokens ÷ tokens the GPUs actually spent (60s window) — only tokens that reach a user count</span>
    </div>
  );
}
