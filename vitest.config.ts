import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['ui-tests/**/*']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});