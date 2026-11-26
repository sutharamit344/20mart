import type { Metadata, Viewport } from 'next';
// Self-hosted (no Google Fonts download at build time, which made builds flaky).
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: [
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
});
const poppins = localFont({
  src: [
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../node_modules/@fontsource/poppins/files/poppins-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: '20Mart Admin – Control Center',
  robots: { index: false, follow: false },
  description: 'Operations, Catalog, Inventory, and Business Configurations for 20Mart.',
  icons: {
    icon: [
      { url: '/icons/favicon-v2-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-v2-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-v2-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#074028',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-surface-page text-ink antialiased overflow-x-clip">{children}</body>
    </html>
  );
}
