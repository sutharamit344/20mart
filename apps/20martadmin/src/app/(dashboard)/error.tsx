'use client';

import { useEffect } from 'react';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-100 bg-white p-6 text-center shadow-2xs">
      <p className="text-sm font-bold text-gray-900">This page failed to load</p>
      <p className="mt-1 text-xs text-gray-500">The error has been logged. You can retry, or go back to the dashboard.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={reset} className="h-8 rounded-lg bg-brand-green px-3 text-xs font-semibold text-white">
          Retry
        </button>
        <a href="/" className="inline-flex h-8 items-center rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700">
          Dashboard
        </a>
      </div>
    </div>
  );
}
