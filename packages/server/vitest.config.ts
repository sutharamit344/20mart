import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

// Tests run against a disposable database configured in .env.test (never the dev DB).
const env = parseEnv(readFileSync(path.resolve(__dirname, '.env.test'), 'utf8')) as Record<string, string>;
if (!env.DATABASE_URL?.includes('test')) throw new Error('Refusing to run tests: DATABASE_URL in .env.test must point at a *test* database');

export default defineConfig({
  test: {
    environment: 'node',
    env: { ...env, NODE_ENV: 'test' },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false, // one shared database
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: { 'server-only': path.resolve(__dirname, 'test/empty.ts') },
  },
});
