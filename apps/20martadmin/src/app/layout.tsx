import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AdminProvider } from '../lib/admin-store';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';

export const metadata: Metadata = {
  title: '20Mart Admin – Control Center',
  description: 'Operations, Catalog, Inventory, and Business Configurations for 20Mart.',
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
  themeColor: '#074028',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F9FA] text-gray-900 antialiased flex overflow-x-hidden">
        <AdminProvider>
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
            <AdminHeader />
            <main className="p-4 sm:p-6 lg:p-8 flex-1">{children}</main>
          </div>
        </AdminProvider>
      </body>
    </html>
  );
}
