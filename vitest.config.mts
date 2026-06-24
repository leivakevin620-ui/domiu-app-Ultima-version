import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}', 'src/lib/payments/__tests__/*.test.ts', 'src/lib/orders/__tests__/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/test/**/*.{ts,tsx}', 'src/lib/payments/__tests__/*.test.ts', 'src/lib/orders/__tests__/*.test.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/setup.ts',
      ],
    },
  },
});
