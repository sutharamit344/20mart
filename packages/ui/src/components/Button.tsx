import React from 'react';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'brand' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none active:scale-[0.98] leading-none';

    const variants = {
      primary:
        'bg-brand-orange hover:bg-brand-orange-600 text-white shadow-sm focus-visible:ring-brand-orange/40',
      brand:
        'bg-brand-green hover:bg-brand-green-hover text-white shadow-sm focus-visible:ring-brand-green/40',
      secondary:
        'bg-brand-orange-50 hover:bg-brand-orange-100 text-brand-orange-700 border border-brand-orange-200/70 focus-visible:ring-brand-orange/30',
      outline:
        'border border-line-strong bg-surface text-ink-700 hover:bg-surface-muted hover:border-ink-400 focus-visible:ring-ink-400/40',
      ghost:
        'text-ink-700 hover:bg-surface-muted focus-visible:ring-ink-400/40',
      danger:
        'bg-danger hover:bg-red-700 text-white shadow-sm focus-visible:ring-danger/40',
    };

    const sizes = {
      sm: 'text-xs px-3 gap-1.5 h-8 rounded-lg',
      md: 'text-sm px-4 gap-2 h-10',
      lg: 'text-sm sm:text-base px-5 gap-2.5 h-11 sm:h-12',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span className="inline-flex items-center min-w-0 whitespace-nowrap">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
