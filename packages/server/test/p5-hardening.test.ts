/**
 * P5 hardening: request body cap, client IP on Vercel without req.ip (removed in Next 15),
 * and image dimension checks after the image-size 2.x upgrade.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertBodySize, clientIp, MAX_JSON_BODY_BYTES } from '../src/next/http';
import { validateImage } from '../src/media';
import { toAppError } from '../src/errors';
import { rateLimit, setRateLimitFetchForTests, sharedRateLimitConfigured } from '../src/rateLimit';

const req = (method: string, headers: Record<string, string>) => new NextRequest('http://localhost:3000/api/x', { method, headers });

describe('request body cap', () => {
  it('rejects oversized JSON bodies with 413 and leaves GET and multipart alone', () => {
    const big = String(MAX_JSON_BODY_BYTES + 1);
    let err: unknown;
    try {
      assertBodySize(req('POST', { 'content-type': 'application/json', 'content-length': big }));
    } catch (e) {
      err = e;
    }
    expect(toAppError(err)).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
    expect(() => assertBodySize(req('POST', { 'content-type': 'application/json', 'content-length': '512' }))).not.toThrow();
    expect(() => assertBodySize(req('POST', { 'content-type': 'multipart/form-data; boundary=x', 'content-length': big }))).not.toThrow();
    expect(() => assertBodySize(req('GET', { 'content-length': big }))).not.toThrow();
  });
});

describe('client IP on Vercel', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('uses the platform X-Real-IP on Vercel and ignores it elsewhere', () => {
    const r = req('GET', { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1, 192.0.2.9' });
    vi.stubEnv('VERCEL', '1');
    expect(clientIp(r)).toBe('203.0.113.7');
    vi.stubEnv('VERCEL', '');
    expect(clientIp(r)).toBe('192.0.2.9'); // proxy-appended entry, not the client-controlled left one
  });
});

describe('image validation (image-size 2.x)', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const dv = new DataView(b.buffer);
    dv.setUint32(16, w);
    dv.setUint32(20, h);
    return b;
  };
  it('reads dimensions and enforces limits', () => {
    expect(validateImage(png(800, 600), 'image/png')).toMatchObject({ width: 800, height: 600, mimeType: 'image/png' });
    expect(() => validateImage(png(10, 10), 'image/png')).toThrow(/at least/);
    expect(() => validateImage(png(800, 600), 'image/jpeg')).toThrow(/does not match/);
  });
});

describe('shared rate limiter (Upstash REST)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setRateLimitFetchForTests(null);
  });
  it('counts in the shared store across calls and falls back to memory when the store is down', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tkn');
    const store = new Map<string, number>();
    const calls: string[] = [];
    setRateLimitFetchForTests((async (url: string, init: RequestInit) => {
      calls.push(url);
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer tkn');
      const [[, key]] = JSON.parse(String(init.body)) as string[][];
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return new Response(JSON.stringify([{ result: n }, { result: 1 }, { result: 30_000 }]), { status: 200 });
    }) as unknown as typeof fetch);
    const key = `t:${Math.random()}`;
    expect(sharedRateLimitConfigured()).toBe(true);
    expect(await rateLimit(key, 2, 60_000)).toEqual({ ok: true, retryAfterSec: 0 });
    expect((await rateLimit(key, 2, 60_000)).ok).toBe(true);
    expect(await rateLimit(key, 2, 60_000)).toEqual({ ok: false, retryAfterSec: 30 });
    expect(calls[0]).toBe('https://redis.example.test/pipeline');

    setRateLimitFetchForTests((async () => new Response('down', { status: 503 })) as unknown as typeof fetch);
    expect((await rateLimit(`t:${Math.random()}`, 1, 60_000)).ok).toBe(true); // memory fallback, not a hard failure
  });
});
