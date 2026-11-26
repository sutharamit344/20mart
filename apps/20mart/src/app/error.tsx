'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-lg font-black text-gray-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-gray-500">We couldn&apos;t load this page. Please try again.</p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white hover:bg-brand-orange-600"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
        <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Go home
        </Link>
      </div>
    </div>
  );
}
