import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <PackageSearch className="mx-auto mb-3 h-10 w-10 text-brand-orange" />
      <h1 className="text-lg font-bold text-ink">Page not found</h1>
      <p className="mt-1 text-sm text-ink-500">This product or page isn&apos;t available. It may have been removed or is no longer sold.</p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Link href="/shop" className="inline-flex h-10 items-center rounded-xl bg-brand-orange px-4 text-sm font-bold text-white hover:bg-brand-orange-600">
          Browse products
        </Link>
        <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-700 hover:bg-surface-muted">
          Home
        </Link>
      </div>
    </div>
  );
}
