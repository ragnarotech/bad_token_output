import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke', () => {
  it('renders console chrome without crashing', () => {
    render(<App />);
    expect(screen.getByText(/goodput/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /play|pause/i })).toBeTruthy();
  });
});
