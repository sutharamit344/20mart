'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Loader2, X } from 'lucide-react';

export interface FilterSelect {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * URL-driven filter bar. Writes `q` and select values to the query string
 * (resetting `page`), so filtering/pagination happen on the server.
 */
export function FilterBar({
  placeholder = 'Search…',
  selects = [],
  children,
}: {
  placeholder?: string;
  selects?: FilterSelect[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
  const first = useRef(true);

  const push = (updates: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    sp.delete('page');
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Debounced search
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q.trim()) push({ q: q.trim() });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = !!params.get('q') || selects.some((s) => params.get(s.name));

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-2xs">
      <div className="relative flex-1 min-w-[180px]">
        {pending ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        )}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0B5D3B] focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {selects.map((s) => (
          <select
            key={s.name}
            aria-label={s.label}
            value={params.get(s.name) ?? ''}
            onChange={(e) => push({ [s.name]: e.target.value })}
            className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-[#0B5D3B] focus:outline-none sm:w-auto min-w-0"
          >
            <option value="">{s.label}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
