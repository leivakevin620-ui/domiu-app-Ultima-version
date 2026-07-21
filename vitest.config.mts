import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': resolve(process.cwd(), 'src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/test/**/*.test.{ts,tsx}',
      'src/lib/payments/__tests__/*.test.ts',
      'src/lib/orders/__tests__/*.test.ts',
      'src/lib/domi/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/test/**/*.{ts,tsx}',
        'src/lib/payments/__tests__/*.test.ts',
        'src/lib/orders/__tests__/*.test.ts',
        'src/lib/domi/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/test/setup.ts',
        'src/test/server-only-stub.ts',
        'src/lib/domi/**/*.test.ts',
      ],
    },
  },
});
