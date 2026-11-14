import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Shared admin primitives (server-safe: no hooks in this file).       */
/* ------------------------------------------------------------------ */

export const inputCls =
  'w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#0B5D3B] focus:ring-2 focus:ring-[#0B5D3B]/10 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500';
export const textareaCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#0B5D3B] focus:ring-2 focus:ring-[#0B5D3B]/10 focus:outline-none';
export const labelCls = 'block text-[11px] font-semibold text-gray-700 mb-1';

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
        <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight">{title}</h1>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
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
    <section className={`rounded-xl border border-gray-200/80 bg-white shadow-2xs ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100">
          {title && <h2 className="text-sm font-bold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'green' | 'orange' | 'amber' | 'red' | 'blue';
const toneText: Record<Tone, string> = {
  neutral: 'text-gray-900',
  green: 'text-[#0B5D3B]',
  orange: 'text-[#E66E00]',
  amber: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-blue-700',
};
const toneIcon: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  green: 'bg-emerald-50 text-[#0B5D3B]',
  orange: 'bg-orange-50 text-[#FF7A00]',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
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
    <div className="flex items-start justify-between gap-2 rounded-xl border border-gray-200/80 bg-white p-3 sm:p-4 shadow-2xs h-full transition-colors hover:border-gray-300">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-500 truncate">{label}</p>
        <p className={`mt-1 text-lg sm:text-xl font-extrabold leading-none ${toneText[tone]}`}>{value}</p>
        {hint && <p className="mt-1.5 text-[10px] text-gray-400 truncate">{hint}</p>}
      </div>
      {icon && <div className={`hidden sm:block shrink-0 rounded-lg p-1.5 ${toneIcon[tone]}`}>{icon}</div>}
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
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  IN_STOCK: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-500/15',
  INACTIVE: 'bg-gray-100 text-gray-600 ring-gray-500/15',
  SUSPENDED: 'bg-red-50 text-red-700 ring-red-600/15',
  ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-500/15',
  LOW: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  OUT: 'bg-red-50 text-red-700 ring-red-600/15',
  FEATURED: 'bg-orange-50 text-[#E66E00] ring-orange-500/20',
};
const badgeLabels: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW: 'Low stock',
  OUT: 'Out of stock',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = badgeTones[status] ?? 'bg-blue-50 text-blue-700 ring-blue-600/15';
  const text = label ?? badgeLabels[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${cls}`}>
      {text}
    </span>
  );
}

/* ---------------------------- Tables -------------------------------- */

export function Table({ children, minWidth = 640 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-gray-600" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
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
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
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
        <p className="text-sm font-bold text-gray-800">{title}</p>
        {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
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
    'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition-colors';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 text-[11px] text-gray-500">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} border-gray-200 bg-white hover:bg-gray-50`} aria-label="Previous page">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className={`${btn} border-gray-100 text-gray-300`}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </span>
        )}
        <span className="px-2 font-semibold text-gray-700">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={`${btn} border-gray-200 bg-white hover:bg-gray-50`} aria-label="Next page">
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className={`${btn} border-gray-100 text-gray-300`}>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-100 bg-white p-6 text-center shadow-2xs">
      <p className="text-sm font-bold text-gray-900">You don&apos;t have access to this page</p>
      <p className="mt-1 text-xs text-gray-500">
        Missing permission <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">{permission}</code>. Ask a
        Super Admin to update your role.
      </p>
    </div>
  );
}

export const formatINR = (paise: number) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });
