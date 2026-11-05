'use client';

import React from 'react';
import { cn } from '../lib/utils';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No records found',
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B5D3B] border-t-transparent" />
          <span>Loading data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm', className)}>
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase font-semibold text-gray-500">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} scope="col" className={cn('px-4 py-3.5 whitespace-nowrap', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors hover:bg-gray-50/70',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={cn('px-4 py-3.5', col.className)}>
                    {col.cell
                      ? col.cell(row)
                      : col.accessorKey
                      ? String(row[col.accessorKey] ?? '')
                      : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required = false,
  hint,
  children,
  className,
}) => {
  return (
    <div className={cn('w-full space-y-1', className)}>
      <label className="block text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-gray-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};

export interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'processing' | 'delivered' | 'cancelled' | 'pending';
  label?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label }) => {
  const configs = {
    active: { bg: 'bg-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-50', defaultLabel: 'Active' },
    inactive: { bg: 'bg-gray-400', text: 'text-gray-700', pill: 'bg-gray-100', defaultLabel: 'Inactive' },
    processing: { bg: 'bg-amber-500', text: 'text-amber-700', pill: 'bg-amber-50', defaultLabel: 'Processing' },
    delivered: { bg: 'bg-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-50', defaultLabel: 'Delivered' },
    cancelled: { bg: 'bg-red-500', text: 'text-red-700', pill: 'bg-red-50', defaultLabel: 'Cancelled' },
    pending: { bg: 'bg-blue-500', text: 'text-blue-700', pill: 'bg-blue-50', defaultLabel: 'Pending' },
  };

  const conf = configs[status] || configs.pending;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', conf.pill, conf.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', conf.bg)} />
      <span>{label || conf.defaultLabel}</span>
    </span>
  );
};
