import React from 'react';
import { cn } from '../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  options: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-xs font-semibold text-ink-700 mb-1">{label}</label>}
        <div className="relative flex items-center">
          <select
            ref={ref}
            className={cn(
              'w-full h-10 appearance-none rounded-xl border border-line bg-surface px-3.5 pr-10 text-sm text-ink transition-[border-color,box-shadow] hover:border-line-strong focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-brand-orange/10 disabled:bg-surface-muted',
              error && 'border-danger',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 w-4 h-4 text-ink-400 pointer-events-none" />
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

