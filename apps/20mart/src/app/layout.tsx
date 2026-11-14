import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '../lib/store';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { getHeaderCategories } from '../lib/catalog';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: '20Mart – Your Everyday Value Market',
  description:
    'Useful household products, affordable prices, everyday convenience. Buy kitchenware, cleaning supplies, and home essentials with fast doorstep delivery.',
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
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
  maximumScale: 1,
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
          <Header categories={categories} />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileBottomNav />
        </StoreProvider>
      </body>
    </html>
  );
}
