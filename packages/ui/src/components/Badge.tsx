import React from 'react';
import { cn } from '../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'discount' | 'success' | 'warning' | 'info' | 'neutral' | 'brand';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'discount',
  size = 'sm',
  children,
  ...props
}) => {
  const variants = {
    discount: 'bg-brand-orange-50 text-brand-orange-700 border border-brand-orange-200/70 font-bold',
    success: 'bg-success-soft text-success border border-success-line font-semibold',
    warning: 'bg-warning-soft text-warning border border-warning-line font-semibold',
    info: 'bg-info-soft text-info border border-info-line font-semibold',
    neutral: 'bg-surface-muted text-ink-700 border border-line font-medium',
    brand: 'bg-brand-green text-white font-bold',
  };

  const sizes = {
    sm: 'text-2xs px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  };

  return (
    <span className={cn('inline-flex items-center tracking-tight', variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
