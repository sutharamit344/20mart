import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Shared admin primitives (server-safe: no hooks in this file).       */
/* ------------------------------------------------------------------ */

export const inputCls =
  'w-full h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-400 transition-[border-color,box-shadow] hover:border-line-strong focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 focus:outline-none disabled:bg-surface-muted disabled:text-ink-500';
export const textareaCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-400 transition-[border-color,box-shadow] hover:border-line-strong focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 focus:outline-none';
export const labelCls = 'block text-2xs font-semibold text-ink-700 mb-1';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink leading-tight">{title}</h1>
        {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line-subtle bg-surface shadow-card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line-subtle">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'green' | 'orange' | 'amber' | 'red' | 'blue';
const toneText: Record<Tone, string> = {
  neutral: 'text-ink',
  green: 'text-brand-green',
  orange: 'text-brand-orange-600',
  amber: 'text-warning',
  red: 'text-danger',
  blue: 'text-info',
};
const toneIcon: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-600',
  green: 'bg-success-soft text-brand-green',
  orange: 'bg-brand-orange-50 text-brand-orange',
  amber: 'bg-warning-soft text-warning',
  red: 'bg-danger-soft text-danger',
  blue: 'bg-info-soft text-info',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="flex items-start justify-between gap-2 rounded-2xl border border-line-subtle bg-surface p-3 sm:p-4 shadow-card h-full transition-[border-color,box-shadow] hover:border-line hover:shadow-card-hover">
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500 truncate">{label}</p>
        <p className={`mt-1.5 text-lg sm:text-xl font-bold tabular-nums leading-none ${toneText[tone]}`}>{value}</p>
        {hint && <p className="mt-1.5 text-2xs text-ink-400 truncate">{hint}</p>}
      </div>
      {icon && <div className={`hidden sm:block shrink-0 rounded-xl p-2 ${toneIcon[tone]}`}>{icon}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

const badgeTones: Record<string, string> = {
  ACTIVE: 'bg-success-soft text-success ring-success/15',
  IN_STOCK: 'bg-success-soft text-success ring-success/15',
  DRAFT: 'bg-surface-muted text-ink-600 ring-ink-500/15',
  INACTIVE: 'bg-surface-muted text-ink-600 ring-ink-500/15',
  SUSPENDED: 'bg-danger-soft text-danger ring-danger/15',
  ARCHIVED: 'bg-surface-muted text-ink-500 ring-ink-500/15',
  LOW: 'bg-warning-soft text-warning ring-warning/15',
  OUT: 'bg-danger-soft text-danger ring-danger/15',
  FEATURED: 'bg-brand-orange-50 text-brand-orange-600 ring-brand-orange/20',
};
const badgeLabels: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW: 'Low stock',
  OUT: 'Out of stock',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = badgeTones[status] ?? 'bg-info-soft text-info ring-info/15';
  const text = label ?? badgeLabels[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ring-inset ${cls}`}>
      {text}
    </span>
  );
}

/* ---------------------------- Tables -------------------------------- */

export function Table({ children, minWidth = 640 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-ink-600" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-page text-2xs font-semibold uppercase tracking-wide text-ink-500 border-b border-line-subtle">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 sm:px-4 py-2.5 whitespace-nowrap ${className}`}>{children}</th>;
}

export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 sm:px-4 py-2.5 align-middle ${className}`}>{children}</td>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line-subtle [&>tr]:transition-colors [&>tr:hover]:bg-surface-page">{children}</tbody>;
}

export function TableEmpty({
  colSpan,
  title,
  description,
  action,
}: {
  colSpan: number;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
        {action && <div className="mt-3 inline-flex">{action}</div>}
      </td>
    </tr>
  );
}

/* --------------------------- Pagination ----------------------------- */

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== 'page' && sp.set(k, v));
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-2xs font-semibold transition-colors';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 border-t border-line-subtle text-2xs text-ink-500">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} border-line bg-surface hover:bg-surface-muted`} aria-label="Previous page">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className={`${btn} border-line-subtle text-ink-400/60`}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </span>
        )}
        <span className="px-2 font-semibold text-ink-700 tabular-nums">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={`${btn} border-line bg-surface hover:bg-surface-muted`} aria-label="Next page">
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className={`${btn} border-line-subtle text-ink-400/60`}>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-danger-line bg-surface p-6 text-center shadow-card">
      <p className="text-sm font-semibold text-ink">You don&apos;t have access to this page</p>
      <p className="mt-1 text-xs text-ink-500">
        Missing permission <code className="rounded bg-surface-muted px-1 py-0.5 text-2xs">{permission}</code>. Ask a
        Super Admin to update your role.
      </p>
    </div>
  );
}

export const formatINR = (paise: number) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });
