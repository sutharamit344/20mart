import Link from 'next/link';

/** Sub-navigation inside Analytics (server-safe). */
export function AnalyticsTabs({ active }: { active: 'overview' | 'products' }) {
  const tabs = [
    { key: 'overview', href: '/analytics', label: 'Overview' },
    { key: 'products', href: '/analytics/products', label: 'Product demand' },
  ] as const;
  return (
    <nav aria-label="Analytics sections" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs font-bold ${active === t.key ? 'border-brand-green text-brand-green' : 'border-transparent text-ink-500 hover:text-ink-800'}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
