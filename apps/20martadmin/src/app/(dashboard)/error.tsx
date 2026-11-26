'use client';

import { useEffect } from 'react';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md rounded-xl border border-danger-line bg-surface p-6 text-center ">
      <p className="text-sm font-bold text-ink">This page failed to load</p>
      <p className="mt-1 text-xs text-ink-500">The error has been logged. You can retry, or go back to the dashboard.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={reset} className="h-8 rounded-lg bg-brand-green px-3 text-xs font-semibold text-white">
          Retry
        </button>
        <a href="/" className="inline-flex h-8 items-center rounded-lg border border-line-strong px-3 text-xs font-semibold text-ink-700">
          Dashboard
        </a>
      </div>
    </div>
  );
}
