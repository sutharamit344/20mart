import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../env';
import { pkceChallenge, randomToken, signPayload, verifyPayload } from '../crypto';
import { AppError } from '../errors';
import type { VerifiedGoogleIdentity } from './customer';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  s: string; // state
  n: string; // nonce
  v: string; // PKCE verifier
  r: string; // return path
  t: number; // issued at
}

/** Dependencies are injectable so the flow can be tested without calling Google. */
export interface GoogleDeps {
  jwks: JWTVerifyGetKey;
  fetchToken: (body: URLSearchParams) => Promise<Response>;
}

let defaultJwks: JWTVerifyGetKey | null = null;
const defaultDeps = (): GoogleDeps => ({
  jwks: (defaultJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))),
  fetchToken: (body) =>
    fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    }),
});

export const googleRedirectUri = () => `${env().APP_URL.replace(/\/$/, '')}/api/auth/google/callback`;

/** Only allow same-origin relative paths as post-login destinations. */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '/account';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/account';
  if (value.startsWith('/api/') || value.startsWith('/auth')) return '/account';
  return value.slice(0, 300);
}

/** Build the Google authorization URL and the signed state cookie value. */
export function beginGoogleLogin(returnTo?: string | null) {
  const { GOOGLE_CLIENT_ID } = env();
  if (!GOOGLE_CLIENT_ID) throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured');
  const payload: OAuthStatePayload = {
    s: randomToken(24),
    n: randomToken(24),
    v: randomToken(48),
    r: sanitizeReturnTo(returnTo),
    t: Date.now(),
  };
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: payload.s,
    nonce: payload.n,
    code_challenge: pkceChallenge(payload.v),
    code_challenge_method: 'S256',
    prompt: 'select_account',
    access_type: 'online',
  }).toString();
  return { url: url.toString(), stateCookieValue: signPayload(payload) };
}

/**
 * Validate the callback (state/CSRF, PKCE), exchange the code server-side and
 * verify the ID token signature + claims. Returns a verified identity.
 */
export async function completeGoogleLogin(
  params: { code: string | null; state: string | null; error?: string | null; stateCookie: string | undefined },
  deps: GoogleDeps = defaultDeps()
): Promise<{ identity: VerifiedGoogleIdentity; returnTo: string }> {
  if (params.error) throw new AppError(400, 'OAUTH_DENIED', 'Google sign-in was cancelled');
  const saved = verifyPayload<OAuthStatePayload>(params.stateCookie);
  if (!saved || !params.state || saved.s !== params.state || Date.now() - saved.t > STATE_TTL_MS) {
    throw new AppError(400, 'OAUTH_STATE_INVALID', 'Sign-in session expired. Please try again.');
  }
  if (!params.code || params.code.length > 2048) throw new AppError(400, 'OAUTH_CODE_MISSING', 'Missing authorization code');

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  const res = await deps.fetchToken(
    new URLSearchParams({
      code: params.code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
      code_verifier: saved.v,
    })
  );
  if (!res.ok) throw new AppError(400, 'OAUTH_EXCHANGE_FAILED', 'Could not complete Google sign-in');
  const tokenJson = (await res.json().catch(() => null)) as { id_token?: string } | null;
  if (!tokenJson?.id_token) throw new AppError(400, 'OAUTH_EXCHANGE_FAILED', 'Could not complete Google sign-in');

  let claims: Record<string, unknown>;
  try {
    const verified = await jwtVerify(tokenJson.id_token, deps.jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: GOOGLE_CLIENT_ID,
      algorithms: ['RS256'],
      clockTolerance: 30,
    });
    claims = verified.payload as Record<string, unknown>;
  } catch {
    throw new AppError(400, 'OAUTH_TOKEN_INVALID', 'Google sign-in could not be verified');
  }
  if (claims.nonce !== saved.n) throw new AppError(400, 'OAUTH_TOKEN_INVALID', 'Google sign-in could not be verified');
  if (typeof claims.sub !== 'string' || !claims.sub) {
    throw new AppError(400, 'OAUTH_TOKEN_INVALID', 'Google sign-in could not be verified');
  }
  if (claims.email_verified !== true || typeof claims.email !== 'string') {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Your Google email address must be verified');
  }

  // Only identity attributes are taken from Google. Roles/permissions are never read from the token.
  return {
    identity: {
      sub: claims.sub,
      email: claims.email,
      emailVerified: true,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : undefined,
    },
    returnTo: saved.r,
  };
}
