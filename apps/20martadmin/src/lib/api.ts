'use client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
  }
}

/** Fetch an admin API route. Throws ApiError with server-provided, user-safe messages. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body || init.form ? 'POST' : 'GET'),
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (res.status === 401) {
    // Session expired or revoked (e.g. account deactivated): go back to sign-in.
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiError('Your session has expired', 401, 'UNAUTHORIZED');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(err.message ?? 'Request failed', res.status, err.code ?? 'ERROR', err.details?.fieldErrors ?? {});
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
