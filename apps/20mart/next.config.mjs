/** @type {import('next').NextConfig} */

// Allow next/image to optimise images served from the configured storage host.
const storageHost = (() => {
  try {
    const u = new URL(process.env.STORAGE_PUBLIC_BASE_URL || '');
    return [{ protocol: u.protocol.replace(':', ''), hostname: u.hostname, ...(u.port ? { port: u.port } : {}) }];
  } catch {
    return [];
  }
})();

const isDev = process.env.NODE_ENV !== 'production';
const httpsOrigin = /^https:\/\//.test(process.env.APP_URL || '');
// Non-https storage (local dev) must be listed explicitly; https images are allowed generally (S3/R2/CDN, Google avatars).
const storageOrigin = (() => {
  try {
    const o = new URL(process.env.STORAGE_PUBLIC_BASE_URL || '').origin;
    return o.startsWith('http:') ? ` ${o}` : '';
  } catch {
    return '';
  }
})();

/**
 * Content-Security-Policy. Next 14 App Router streams the RSC payload in inline <script> tags, so
 * script-src needs 'unsafe-inline' (no nonces without dynamic rendering of every page); everything else
 * is locked to our origin plus Razorpay Checkout (script, iframe, telemetry). frame-ancestors blocks
 * click-jacking; object-src/base-uri close classic injection vectors.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${storageOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com${isDev ? ' ws:' : ''}`,
  'frame-src https://api.razorpay.com https://checkout.razorpay.com',
  "form-action 'self' https://api.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(httpsOrigin ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://api.razorpay.com")' },
  // No Cross-Origin-Opener-Policy on the storefront: it breaks Lighthouse/PSI trace recording (verified) and
  // adds little here (no cross-window secrets; Razorpay needs popups anyway). The admin app does send COOP.
  // HSTS only when the public origin is https (never on http://localhost). Add includeSubDomains/preload deliberately.
  ...(httpsOrigin ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

/** Private pages must never be indexed or cached by shared caches. */
const privateHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  // Lets a production build run side by side with `next dev` (e.g. NEXT_DIST_DIR=.next-prod).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@20mart/ui', '@20mart/shared', '@20mart/server', '@20mart/database'],
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 375, 390, 430, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Production product images (Vercel Blob) — also used by the local catalogue seeded from live.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      ...storageHost,
    ],
  },
  serverExternalPackages: ['@node-rs/argon2', '@prisma/client'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      ...['/account/:path*', '/account', '/checkout/:path*', '/checkout', '/cart', '/wishlist', '/auth/:path*', '/auth', '/order-success', '/order-confirmation', '/api/:path*'].map(
        (source) => ({ source, headers: privateHeaders })
      ),
    ];
  },
};

export default nextConfig;
