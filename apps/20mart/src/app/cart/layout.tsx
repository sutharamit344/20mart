import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your cart – 20Mart', robots: { index: false, follow: false } };

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
