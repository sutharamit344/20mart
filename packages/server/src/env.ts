import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  APP_URL: z.string().url(),
  ADMIN_APP_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  REVALIDATE_SECRET: z.string().optional().default(''),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().optional().default(''),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server environment. Throws a readable error listing invalid keys. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test hook: forget cached env after mutating process.env. */
export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => env().NODE_ENV === 'production';
export const googleConfigured = () => !!(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
