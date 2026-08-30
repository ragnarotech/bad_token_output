import { mulberry32 } from './rng';
import { WORKLOADS } from './workloads';

describe('workloads', () => {
  it('agentic-dev samples stay in spec ranges', () => {
    const rng = mulberry32(7);
    const w = WORKLOADS['agentic-dev'];
    for (let i = 0; i < 500; i++) {
      const p = w.samplePromptTokens(rng);
      const o = w.sampleOutputTokens(rng);
      expect(p).toBeGreaterThanOrEqual(50_000);
      expect(p).toBeLessThanOrEqual(1_000_000);
      expect(o).toBeGreaterThanOrEqual(200);
      expect(o).toBeLessThanOrEqual(2_000);
    }
  });
  it('agentic-dev prompts skew large (mean above midpoint)', () => {
    const rng = mulberry32(7);
    const w = WORKLOADS['agentic-dev'];
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += w.samplePromptTokens(rng);
    expect(sum / 2000).toBeGreaterThan(525_000);
  });
  it('chat samples stay in ranges', () => {
    const rng = mulberry32(9);
    const w = WORKLOADS.chat;
    for (let i = 0; i < 500; i++) {
      const p = w.samplePromptTokens(rng);
      expect(p).toBeGreaterThanOrEqual(2_000);
      expect(p).toBeLessThanOrEqual(20_000);
    }
  });
});
