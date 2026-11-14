import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

/** Apply migrations to the test database once per run (non-destructive `migrate deploy`). */
export default function setup() {
  const env = parseEnv(readFileSync(path.resolve(__dirname, '../.env.test'), 'utf8')) as Record<string, string>;
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../../database'),
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
    stdio: 'pipe',
  });
}
