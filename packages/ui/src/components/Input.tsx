import React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-ink-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-ink-400">
              {leftIcon}
            </div>
          )}
          <input
            id={id}
            ref={ref}
            className={cn(
              'w-full h-10 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-400 transition-[border-color,box-shadow] hover:border-line-strong focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-brand-orange/10 disabled:bg-surface-muted disabled:text-ink-500',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-danger hover:border-danger focus:border-danger focus:ring-danger/10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-ink-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
