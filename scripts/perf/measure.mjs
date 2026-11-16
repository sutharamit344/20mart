#!/usr/bin/env node
/**
 * Server response-time measurement (no dependencies).
 *
 *   STORE=http://localhost:3100 ADMIN=http://localhost:3101 ADMIN_USER=owner ADMIN_PASS=... \
 *     node scripts/perf/measure.mjs [--runs 15] [--label baseline] [--out perf.json]
 *
 * Each target is warmed up twice, then requested --runs times sequentially; p50/p95/max of the
 * full response (headers + body) are reported. Admin targets are skipped without credentials.
 */
import { writeFile } from 'node:fs/promises';

const argv = process.argv;
const arg = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const STORE = process.env.STORE || 'http://localhost:3100';
const ADMIN = process.env.ADMIN || 'http://localhost:3101';
const RUNS = Number(arg('runs', 15));
const label = arg('label', 'run');
const out = arg('out');

const storeTargets = [
  ['home', '/'],
  ['shop page 1', '/shop'],
  ['shop page 100 (deep)', '/shop?page=100'],
  ['category listing', '/category/kitchen'],
  ['product detail', '/product/load-123'],
  ['api: listing (filter+sort)', '/api/catalog/products?sort=price_asc&inStock=1&pageSize=24'],
  ['api: text search', '/api/catalog/products?q=steel%20bottle'],
  ['api: suggestions', '/api/catalog/search?q=bott'],
  ['sitemap.xml', '/sitemap.xml'],
];
const adminTargets = [
  ['admin: dashboard page', '/'],
  ['admin: orders page', '/orders'],
  ['admin: customers page', '/customers'],
  ['admin: analytics page (30d)', '/analytics?range=30d'],
  ['admin: products page', '/products'],
  ['api: admin orders', '/api/admin/orders'],
  ['api: admin customers search', '/api/admin/customers?q=load%201'],
  ['api: admin analytics', '/api/admin/analytics?range=30d'],
];

const pct = (xs, p) => xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

async function time(url, headers) {
  const t = performance.now();
  const res = await fetch(url, { headers, redirect: 'manual' });
  const body = await res.arrayBuffer();
  return { ms: performance.now() - t, status: res.status, bytes: body.byteLength };
}

async function measure(base, [name, path], headers = {}) {
  const url = base + path;
  for (let i = 0; i < 2; i++) await time(url, headers).catch(() => null);
  const xs = [];
  let status = 0;
  let bytes = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = await time(url, headers);
    xs.push(r.ms);
    status = r.status;
    bytes = r.bytes;
  }
  xs.sort((a, b) => a - b);
  return { name, path, status, kb: +(bytes / 1024).toFixed(1), p50: +pct(xs, 50).toFixed(1), p95: +pct(xs, 95).toFixed(1), max: +xs.at(-1).toFixed(1) };
}

async function adminCookie() {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) return null;
  const res = await fetch(`${ADMIN}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ADMIN },
    body: JSON.stringify({ identifier: process.env.ADMIN_USER, password: process.env.ADMIN_PASS }),
  });
  if (!res.ok) throw new Error(`admin login failed: ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

const results = [];
for (const t of storeTargets) results.push(await measure(STORE, t));
const cookie = await adminCookie();
if (cookie) for (const t of adminTargets) results.push(await measure(ADMIN, t, { cookie }));

console.log(`\n${label} — ${RUNS} runs each (ms)`);
console.table(results);
if (out) await writeFile(out, JSON.stringify({ label, runs: RUNS, at: new Date().toISOString(), results }, null, 2));
