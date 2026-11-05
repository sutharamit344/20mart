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
      'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed select-none active:scale-[0.98] leading-none';

    const variants = {
      primary:
        'bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-xs hover:shadow focus:ring-[#FF7A00]/40',
      brand:
        'bg-[#0B5D3B] hover:bg-[#08492E] text-white shadow-xs hover:shadow focus:ring-[#0B5D3B]/40',
      secondary:
        'bg-[#FFF6E9] hover:bg-[#FFE8CC] text-[#FF7A00] border border-orange-100 focus:ring-orange-200',
      outline:
        'border border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
      ghost:
        'text-gray-700 hover:bg-gray-100 focus:ring-gray-200',
      danger:
        'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400',
    };

    const sizes = {
      sm: 'text-xs px-3 gap-1.5 h-8',
      md: 'text-[13px] sm:text-sm px-4 gap-2 h-10',
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
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
