'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** From/to date filter written to the URL (IST calendar days, filtered on the server). */
export function DateRange() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (k: 'from' | 'to', v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    sp.delete('page');
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  const cls = 'h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-brand-green focus:outline-none';
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
      <label className="sr-only" htmlFor="from">From date</label>
      <input id="from" type="date" className={cls} value={params.get('from') ?? ''} onChange={(e) => set('from', e.target.value)} />
      <span>to</span>
      <label className="sr-only" htmlFor="to">To date</label>
      <input id="to" type="date" className={cls} value={params.get('to') ?? ''} onChange={(e) => set('to', e.target.value)} />
    </div>
  );
}
