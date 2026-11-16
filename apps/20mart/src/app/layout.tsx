import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '../lib/store';
import { LocationProvider } from '../lib/location';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { getHeaderCategories } from '../lib/catalog';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, siteOrigin } from '../lib/seo';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  // Not preloaded: with display=swap text paints immediately in the metric-matched fallback, and the
  // font files no longer compete with CSS/JS at top priority on slow mobile connections.
  preload: false,
});

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['500', '600', '700', '800'],
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
      <body className="min-h-screen flex flex-col bg-[#F8F9FA] text-gray-900 antialiased pb-16 md:pb-0 overflow-x-clip font-sans">
        <StoreProvider>
          <LocationProvider>
            <Header categories={categories} />
            <main className="flex-1">{children}</main>
            <Footer categories={categories} />
            <MobileBottomNav />
          </LocationProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
