'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, onChange, id, ...props }, ref) => {
    const autoId = React.useId();
    const internalId = id || `checkbox-${autoId}`;

    return (
      <label htmlFor={internalId} className="inline-flex items-center gap-2.5 cursor-pointer select-none">
        <div className="relative flex items-center justify-center">
          <input
            id={internalId}
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div className="w-4 h-4 rounded border border-gray-300 bg-white transition-all peer-checked:border-brand-orange peer-checked:bg-brand-orange peer-focus:ring-2 peer-focus:ring-brand-orange/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-white stroke-[3] opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>
        {label && <span className={cn('text-sm text-ink-700', className)}>{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, checked, onChange, id, ...props }, ref) => {
    const autoId = React.useId();
    const internalId = id || `radio-${autoId}`;

    return (
      <label htmlFor={internalId} className="inline-flex items-center gap-2.5 cursor-pointer select-none">
        <div className="relative flex items-center justify-center">
          <input
            id={internalId}
            ref={ref}
            type="radio"
            checked={checked}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-line-strong bg-surface transition-colors peer-checked:border-brand-orange peer-checked:bg-brand-orange peer-checked:[&>div]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange/40 peer-focus-visible:ring-offset-1">
            <div className="h-1.5 w-1.5 rounded-full bg-white opacity-0 transition-opacity" />
          </div>
        </div>
        {label && <span className={cn('text-sm text-ink-700', className)}>{label}</span>}
      </label>
    );
  }
);

Radio.displayName = 'Radio';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label className={cn('inline-flex items-center gap-2.5 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-orange/30',
          checked ? 'bg-brand-green' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
    </label>
  );
};
