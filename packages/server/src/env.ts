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
  STORAGE_DRIVER: z.enum(['local', 's3', 'vercel-blob']).default('local'),
  /** Set automatically by Vercel when a Blob store is connected (STORAGE_DRIVER=vercel-blob). */
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(''),
  /** Set by Vercel when a Blob store is connected via OIDC (no static token). */
  BLOB_STORE_ID: z.string().optional().default(''),
  STORAGE_LOCAL_DIR: z.string().optional().default(''),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  CRON_SECRET: z.string().optional().default(''),
  /** Resend (https://resend.com). Email stays off until the key and a verified sender are set. */
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(''),
  /**
   * Reverse geocoding for "Use my current location". Off (manual PIN entry only) unless set.
   * google = Google Geocoding API (needs GOOGLE_MAPS_API_KEY); nominatim = OpenStreetMap
   * Nominatim (light use only, needs GEOCODING_CONTACT per its usage policy).
   */
  GEOCODING_PROVIDER: z.enum(['', 'google', 'nominatim']).optional().default(''),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  GEOCODING_CONTACT: z.string().optional().default(''),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server environment. Throws a readable error listing invalid keys. */
export function env(): Env {
  if (cached) return cached;
  // MAIL_FROM is accepted as an alias of EMAIL_FROM (older env files used it; without this, email silently stayed off).
  const parsed = schema.safeParse({ ...process.env, EMAIL_FROM: process.env.EMAIL_FROM || process.env.MAIL_FROM || '' });
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
export const razorpayConfigured = () => !!(env().RAZORPAY_KEY_ID && env().RAZORPAY_KEY_SECRET && env().RAZORPAY_WEBHOOK_SECRET);
export const emailConfigured = () => !!(env().RESEND_API_KEY && env().EMAIL_FROM);
export const googleConfigured = () => !!(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
export const geocodingConfigured = () => {
  const e = env();
  return (e.GEOCODING_PROVIDER === 'google' && !!e.GOOGLE_MAPS_API_KEY) || (e.GEOCODING_PROVIDER === 'nominatim' && !!e.GEOCODING_CONTACT);
};
