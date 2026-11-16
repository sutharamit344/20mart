/** @type {import('next').NextConfig} */

const storageHost = (() => {
  try {
    const u = new URL(process.env.STORAGE_PUBLIC_BASE_URL || '');
    return [{ protocol: u.protocol.replace(':', ''), hostname: u.hostname, ...(u.port ? { port: u.port } : {}) }];
  } catch {
    return [];
  }
})();

const isDev = process.env.NODE_ENV !== 'production';
const httpsOrigin = /^https:\/\//.test(process.env.ADMIN_APP_URL || '');
const storageOrigin = (() => {
  try {
    const o = new URL(process.env.STORAGE_PUBLIC_BASE_URL || '').origin;
    return o.startsWith('http:') ? ` ${o}` : '';
  } catch {
    return '';
  }
})();

/** Admin CSP: no third-party scripts, frames or connections at all. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${storageOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "frame-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(httpsOrigin ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  ...(httpsOrigin ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  // Lets a production build run side by side with `next dev` (e.g. NEXT_DIST_DIR=.next-prod).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@20mart/ui', '@20mart/shared', '@20mart/database', '@20mart/server'],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }, ...storageHost],
  },
  serverExternalPackages: ['@node-rs/argon2', '@prisma/client'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: { bodySizeLimit: '6mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
