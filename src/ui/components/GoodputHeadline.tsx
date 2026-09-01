import { fmtTok } from '../format';

interface Props {
  pct: number; usefulTpm: number; theoreticalTpm: number; helpTickets: number;
  deliveredTok: number; wastedTok: number;
}

export function GoodputHeadline({ pct, usefulTpm, theoreticalTpm, helpTickets, deliveredTok, wastedTok }: Props) {
  const tone = pct >= 70 ? 'good' : pct >= 35 ? 'warn' : 'bad';
  return (
    <div className={`goodput-headline ${tone}`}>
      <span className="label">GOODPUT</span>
      <span className="value">{pct.toFixed(0)}%</span>
      <span className="tpm" title="Completions credit their full prompt+output at delivery, so a draining backlog can burst above theoretical for a window — that's real delivered work, not an error">useful TPM {fmtTok(usefulTpm)} <em>of {fmtTok(theoreticalTpm)} theoretical</em></span>
      <span className={`tickets ${helpTickets > 0 ? 'warn' : ''}`} title="Sessions dead after 10 retries — each one is a user telling their agent 'continue' and filing a ticket">🎫 help tickets: {helpTickets}</span>
      <div className="score" title="Running totals for this scenario. Delivered: prompt + output tokens that reached a user. Wasted: tokens the GPUs computed minus tokens delivered — prefill and decode spent on clients that had already hung up, or on requests still doomed in the pipeline.">
        <span className="score-item delivered"><span className="score-label">delivered</span><span className="score-num">{fmtTok(deliveredTok)}</span></span>
        <span className={`score-item wasted ${wastedTok > deliveredTok ? 'bad' : ''}`}><span className="score-label">wasted</span><span className="score-num">{fmtTok(wastedTok)}</span></span>
      </div>
      <span className="sub">delivered tokens ÷ tokens the GPUs actually spent (60s window) — only tokens that reach a user count</span>
    </div>
  );
}
