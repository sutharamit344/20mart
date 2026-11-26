import type { Metadata, Viewport } from 'next';
// Self-hosted (no Google Fonts download at build time, which made builds flaky).
import localFont from 'next/font/local';
import './globals.css';
import { StoreProvider } from '../lib/store';
import { LocationProvider } from '../lib/location';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { getHeaderCategories } from '../lib/catalog';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, siteOrigin } from '../lib/seo';
import { ConsentBanner } from '../components/ConsentBanner';
import { AppOpened } from '../components/TrackView';

const inter = localFont({
  src: [
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
  preload: false,
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
  preload: false,
});

/** Site-wide defaults; pages override title/description/canonical (see lib/seo.ts). */
export const generateMetadata = (): Metadata => ({
  metadataBase: new URL(siteOrigin()),
  title: '20Mart – Your Everyday Value Market',
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN', images: [DEFAULT_OG_IMAGE] },
  twitter: { card: 'summary_large_image' },
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
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets env(safe-area-inset-*) report the iPhone home-indicator inset (bottom navigation padding).
  viewportFit: 'cover',
  themeColor: '#0B5D38',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getHeaderCategories();
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen flex flex-col bg-surface-page text-ink antialiased pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 overflow-x-clip font-sans">
        <StoreProvider>
          <LocationProvider>
            <Header categories={categories} />
            <main className="flex-1">{children}</main>
            <Footer categories={categories} />
            <MobileBottomNav />
            <ConsentBanner />
            <AppOpened />
          </LocationProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
