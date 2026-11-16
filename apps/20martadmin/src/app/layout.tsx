import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans', weight: ['400', '500', '600', '700'] });
const poppins = Poppins({ subsets: ['latin'], display: 'swap', variable: '--font-heading', weight: ['500', '600', '700', '800'] });

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
      <body className="min-h-screen bg-[#F8F9FA] text-gray-900 antialiased overflow-x-clip">{children}</body>
    </html>
  );
}
