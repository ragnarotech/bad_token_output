import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Scope to this project's sources: local tool caches and linked
    // worktrees (.claude/, CLAUDE_CONFIG_DIR/) otherwise get swept in.
    exclude: [...configDefaults.exclude, '.claude/**', 'CLAUDE_CONFIG_DIR/**'],
  },
});
