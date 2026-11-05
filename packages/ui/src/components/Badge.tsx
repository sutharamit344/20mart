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
    discount: 'bg-[#FFF6E9] text-[#FF7A00] border border-orange-100 font-bold',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold',
    warning: 'bg-amber-50 text-amber-800 border border-amber-100 font-semibold',
    info: 'bg-blue-50 text-blue-700 border border-blue-100 font-semibold',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200 font-medium',
    brand: 'bg-[#0B5D3B] text-white font-bold',
  };

  const sizes = {
    sm: 'text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  };

  return (
    <span className={cn('inline-flex items-center tracking-tight', variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
