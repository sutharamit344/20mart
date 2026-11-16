#!/usr/bin/env node
/**
 * Post-deployment smoke verification (read-only; creates no data).
 *
 *   node scripts/verify-deployment.mjs --store https://shop.example.in --admin https://admin.example.in \
 *        [--health-secret <CRON_SECRET>] [--admin-user u --admin-pass p] [--allow-http]
 *
 * Exit code 0 only when every check passes. Warnings are printed but do not fail the run.
 */
import tls from 'node:tls';

const argv = process.argv;
const arg = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const STORE = (arg('store') || process.env.STORE_URL || '').replace(/\/$/, '');
const ADMIN = (arg('admin') || process.env.ADMIN_URL || '').replace(/\/$/, '');
const HEALTH_SECRET = arg('health-secret') || process.env.HEALTH_SECRET || '';
const ADMIN_USER = arg('admin-user') || process.env.ADMIN_USER;
const ADMIN_PASS = arg('admin-pass') || process.env.ADMIN_PASS;
const allowHttp = argv.includes('--allow-http');
if (!STORE || !ADMIN) {
  console.error('Usage: verify-deployment.mjs --store <url> --admin <url> [--health-secret s] [--admin-user u --admin-pass p]');
  process.exit(2);
}

const results = [];
const pass = (name, detail = '') => results.push({ status: 'PASS', name, detail });
const fail = (name, detail = '') => results.push({ status: 'FAIL', name, detail });
const warn = (name, detail = '') => results.push({ status: 'WARN', name, detail });
const check = (name, ok, detail = '', soft = false) => (ok ? pass(name, detail) : soft ? warn(name, detail) : fail(name, detail));

async function get(url, init = {}) {
  const t = performance.now();
  const res = await fetch(url, { redirect: 'manual', ...init, signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  return { res, body, ms: Math.round(performance.now() - t) };
}

function certInfo(origin) {
  const u = new URL(origin);
  return new Promise((resolve) => {
    const s = tls.connect({ host: u.hostname, port: Number(u.port) || 443, servername: u.hostname, timeout: 10_000 }, () => {
      const c = s.getPeerCertificate();
      resolve({ authorized: s.authorized, error: s.authorizationError, validTo: c?.valid_to, protocol: s.getProtocol() });
      s.end();
    });
    s.on('error', (e) => resolve({ authorized: false, error: e.message }));
    s.on('timeout', () => {
      s.destroy();
      resolve({ authorized: false, error: 'timeout' });
    });
  });
}

async function tlsChecks(label, origin) {
  if (!origin.startsWith('https://')) {
    if (allowHttp) warn(`${label}: served over HTTPS`, `${origin} — TLS checks skipped (--allow-http)`);
    else fail(`${label}: served over HTTPS`, origin);
    return;
  }
  const c = await certInfo(origin);
  check(`${label}: TLS certificate valid`, c.authorized, c.error ? String(c.error) : `${c.protocol}, expires ${c.validTo}`);
  if (c.validTo) {
    const days = Math.round((new Date(c.validTo).getTime() - Date.now()) / 86_400_000);
    check(`${label}: certificate not expiring within 14 days`, days > 14, `${days} days left`, true);
  }
  const httpUrl = origin.replace(/^https:/, 'http:');
  try {
    const r = await fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const loc = r.headers.get('location') || '';
    check(`${label}: http:// redirects to https://`, r.status >= 300 && r.status < 400 && loc.startsWith('https://'), `${r.status} → ${loc}`, true);
  } catch (e) {
    warn(`${label}: http:// redirect`, `could not connect over http (${e.message}) — fine if port 80 is closed`);
  }
}

function headerChecks(label, res, { admin = false } = {}) {
  const h = (k) => res.headers.get(k) || '';
  check(`${label}: Content-Security-Policy`, h('content-security-policy').includes("frame-ancestors 'none'"), h('content-security-policy').slice(0, 80));
  check(`${label}: X-Content-Type-Options nosniff`, h('x-content-type-options') === 'nosniff');
  check(`${label}: X-Frame-Options DENY`, h('x-frame-options') === 'DENY');
  check(`${label}: no X-Powered-By`, !h('x-powered-by'));
  if (res.url.startsWith('https://') || STORE.startsWith('https://')) check(`${label}: Strict-Transport-Security`, /max-age=\d{7,}/.test(h('strict-transport-security')), h('strict-transport-security'), allowHttp);
  if (admin) check(`${label}: X-Robots-Tag noindex`, h('x-robots-tag').includes('noindex'));
}

async function main() {
  await tlsChecks('storefront', STORE);
  await tlsChecks('admin', ADMIN);

  // Storefront basics
  const home = await get(`${STORE}/`);
  check('storefront: home page loads', home.res.status === 200, `${home.res.status} in ${home.ms} ms`);
  headerChecks('storefront', home.res);
  check('storefront: Organization/WebSite JSON-LD', /"@type":"(Organization|WebSite)"/.test(home.body));
  check('storefront: canonical link', /<link rel="canonical"/.test(home.body));

  const health = await get(`${STORE}/api/health`, HEALTH_SECRET ? { headers: { 'x-health-secret': HEALTH_SECRET } } : {});
  let hj = null;
  try {
    hj = JSON.parse(health.body);
  } catch {}
  check('storefront: /api/health OK (database reachable)', health.res.status === 200 && hj?.checks?.database?.ok === true, `${health.res.status} db ${hj?.checks?.database?.latencyMs ?? '?'} ms`);
  if (HEALTH_SECRET && hj?.config) {
    check('storefront: DB session time zone is UTC', hj.checks?.sessionTimeZone === 'UTC', String(hj.checks?.sessionTimeZone));
    check('storefront: no failed migrations', hj.checks?.migrations?.failed === 0, JSON.stringify(hj.checks?.migrations));
    const errors = hj.config.filter((i) => i.level === 'error');
    check('storefront: production config has no errors', errors.length === 0, errors.map((e) => `${e.key}: ${e.message}`).join(' | '));
    for (const w of hj.config.filter((i) => i.level === 'warning')) warn(`config warning ${w.key}`, w.message);
    for (const [k, v] of Object.entries(hj.integrations || {})) warn(`integration ${k}`, JSON.stringify(v));
  }

  const robots = await get(`${STORE}/robots.txt`);
  check('storefront: robots.txt', robots.res.status === 200 && /Disallow: \/account/.test(robots.body) && /Sitemap: https?:\/\//.test(robots.body));
  const sitemap = await get(`${STORE}/sitemap.xml`);
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check('storefront: sitemap.xml lists URLs on this origin', sitemap.res.status === 200 && urls.length > 0 && urls.every((u) => u.startsWith(STORE)), `${urls.length} URLs`);
  check('storefront: sitemap excludes private routes', !urls.some((u) => /\/(account|checkout|cart|auth|api)\b/.test(u)));

  const productUrl = urls.find((u) => u.includes('/product/'));
  if (productUrl) {
    const p = await get(productUrl);
    check('storefront: product page loads', p.res.status === 200, `${productUrl} in ${p.ms} ms`);
    check('storefront: Product JSON-LD with Offer', /"@type":"Product"/.test(p.body) && /"@type":"(Aggregate)?Offer"/.test(p.body));
    check('storefront: no fabricated ratings in structured data', !/aggregateRating|"Review"/.test(p.body));
    const og = p.body.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    if (og) {
      const img = await fetch(og.replace(/&amp;/g, '&'), { signal: AbortSignal.timeout(20_000) });
      check('storefront: product image loads', img.ok && /^image\//.test(img.headers.get('content-type') || ''), `${img.status} ${img.headers.get('content-type')}`);
    } else warn('storefront: product image', 'no og:image on product page');
  } else warn('storefront: product page', 'no product URLs in sitemap (empty catalog?)');

  const list = await get(`${STORE}/api/catalog/products?pageSize=4`);
  check('storefront: catalog API', list.res.status === 200 && Array.isArray(JSON.parse(list.body).items), `${list.ms} ms`);
  const cart = await get(`${STORE}/api/cart`);
  check('storefront: cart API (guest)', cart.res.status === 200, `${cart.ms} ms`);
  const cross = await get(`${STORE}/api/cart/items`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
  check('storefront: cross-origin POST blocked (CSRF)', cross.res.status === 403, String(cross.res.status));
  const acct = await get(`${STORE}/account`);
  check('storefront: /account requires sign-in', acct.res.status >= 300 && acct.res.status < 400 && (acct.res.headers.get('location') || '').includes('/auth'), `${acct.res.status} → ${acct.res.headers.get('location')}`);
  const orders = await get(`${STORE}/api/orders`);
  check('storefront: order API requires sign-in', orders.res.status === 401, String(orders.res.status));
  const google = await get(`${STORE}/api/auth/google?returnTo=/account`);
  const gloc = google.res.headers.get('location') || '';
  check(
    'storefront: Google OAuth start redirects to Google with PKCE + state',
    gloc.startsWith('https://accounts.google.com/') && gloc.includes('code_challenge_method=S256') && gloc.includes('state=') && gloc.includes(encodeURIComponent(`${STORE}/api/auth/google/callback`)),
    gloc.slice(0, 90)
  );
  const wh = await get(`${STORE}/api/payments/razorpay/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'bad' }, body: '{"event":"payment.captured"}' });
  check('storefront: unsigned payment webhook rejected', wh.res.status === 401 || wh.res.status === 503, String(wh.res.status));

  // Admin
  const login = await get(`${ADMIN}/login`);
  check('admin: login page loads', login.res.status === 200, `${login.ms} ms`);
  headerChecks('admin', login.res, { admin: true });
  const dash = await get(`${ADMIN}/`);
  check('admin: dashboard redirects to login without a session', dash.res.status >= 300 && dash.res.status < 400, String(dash.res.status));
  const api = await get(`${ADMIN}/api/admin/orders`);
  check('admin: admin API requires a session', api.res.status === 401, String(api.res.status));
  const ahealth = await get(`${ADMIN}/api/health`);
  check('admin: /api/health OK', ahealth.res.status === 200, String(ahealth.res.status));
  const arobots = await get(`${ADMIN}/robots.txt`);
  check('admin: robots.txt disallows everything', arobots.res.status === 200 && /Disallow: \/\s*$/m.test(arobots.body));

  if (ADMIN_USER && ADMIN_PASS) {
    const r = await fetch(`${ADMIN}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ADMIN },
      body: JSON.stringify({ identifier: ADMIN_USER, password: ADMIN_PASS }),
    });
    const cookies = r.headers.getSetCookie();
    const c = cookies.find((x) => /20m_admin=/.test(x)) || '';
    check('admin: password login works', r.status === 200, String(r.status));
    check('admin: session cookie HttpOnly + SameSite=Strict', /HttpOnly/i.test(c) && /SameSite=Strict/i.test(c), c.replace(/=([^;]{6})[^;]*/, '=$1…'));
    if (ADMIN.startsWith('https://')) check('admin: session cookie Secure + __Host- prefix', /Secure/i.test(c) && c.startsWith('__Host-'));
    const session = c.split(';')[0];
    const d = await get(`${ADMIN}/api/admin/dashboard`, { headers: { cookie: session } });
    check('admin: dashboard API with session', d.res.status === 200, `${d.ms} ms`);
    await fetch(`${ADMIN}/api/admin/auth/logout`, { method: 'POST', headers: { origin: ADMIN, cookie: session } });
    const after = await get(`${ADMIN}/api/admin/dashboard`, { headers: { cookie: session } });
    check('admin: logout invalidates the session server-side', after.res.status === 401, String(after.res.status));
  } else warn('admin: login flow', 'skipped (pass --admin-user/--admin-pass to verify)');

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) console.log(`${r.status === 'PASS' ? '✔' : r.status === 'WARN' ? '!' : '✘'} ${r.status.padEnd(4)} ${r.name.padEnd(width)}  ${r.detail}`);
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n${results.length - failed} passed/warned, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('verification crashed:', e);
  process.exit(1);
});
