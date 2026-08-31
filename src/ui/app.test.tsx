import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock ResizeObserver for recharts
const win = typeof window !== 'undefined' ? window : globalThis as any;
if (!win.ResizeObserver) {
  win.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe('App smoke', () => {
  it('renders console chrome without crashing', () => {
    render(<App />);
    expect(screen.getAllByText(/goodput/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /play|pause/i })).toBeTruthy();
  });
});
