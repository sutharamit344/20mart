'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { ProductCategory } from '@20mart/shared';
import {
  CookingPot,
  Sparkles,
  BookOpen,
  Layers,
  Heart,
  Grid,
  ShoppingBag,
  Package,
} from 'lucide-react';

export interface CategoryCardProps {
  category: ProductCategory;
  onClick?: (category: ProductCategory) => void;
  variant?: 'circle' | 'card' | 'chip';
  className?: string;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onClick,
  variant = 'circle',
  className,
}) => {
  const getCategoryTheme = (slug: string) => {
    switch (slug) {
      case 'kitchen-home':
        return {
          bg: '#FFEED9',
          iconColor: '#FF7A00',
          icon: CookingPot,
        };
      case 'cleaning-care':
        return {
          bg: '#DCFCE7',
          iconColor: '#0B5D3B',
          icon: Sparkles,
        };
      case 'stationery-school':
        return {
          bg: '#F3E8FF',
          iconColor: '#9333EA',
          icon: BookOpen,
        };
      case 'daily-use':
        return {
          bg: '#FEF3C7',
          iconColor: '#D97706',
          icon: Layers,
        };
      case 'personal-care':
        return {
          bg: '#FCE7F3',
          iconColor: '#DB2777',
          icon: Heart,
        };
      default:
        return {
          bg: '#FFF6E9',
          iconColor: '#FF7A00',
          icon: Grid,
        };
    }
  };

  const theme = getCategoryTheme(category.slug);
  const IconComponent = theme.icon;

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={() => onClick?.(category)}
        className={cn(
          'group flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-white hover:bg-orange-50/20 border border-gray-200/90 hover:border-[#FF7A00]/50 shadow-2xs hover:shadow-xs shrink-0 cursor-pointer select-none transition-all duration-150',
          className
        )}
      >
        <div
          style={{ backgroundColor: theme.bg }}
          className="flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center rounded-full shrink-0"
        >
          <IconComponent
            className="h-3 w-3 sm:h-3.5 sm:w-3.5"
            style={{ color: theme.iconColor }}
          />
        </div>
        <span className="text-[13px] sm:text-sm font-medium text-gray-700 group-hover:text-[#FF7A00] transition-colors whitespace-nowrap">
          {category.name}
        </span>
      </button>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        onClick={() => onClick?.(category)}
        className={cn(
          'group flex flex-col items-center cursor-pointer text-center select-none transition-all duration-200 hover:-translate-y-1',
          className
        )}
      >
        {/* Square rounded card with pastel bg (Screen 01 reference – category tiles) */}
        <div
          style={{ backgroundColor: theme.bg }}
          className="relative flex w-full aspect-square items-center justify-center rounded-2xl sm:rounded-3xl shadow-2xs transition-all duration-300 group-hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)] border border-white/80 ring-1 ring-black/[0.03] p-3 sm:p-4 overflow-hidden"
        >
          {/* Subtle glossy gradient highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/[0.02] pointer-events-none" />
          <IconComponent
            className="h-8 w-8 sm:h-9 sm:w-9 transition-transform duration-300 group-hover:scale-115 relative z-10"
            style={{ color: theme.iconColor }}
          />
        </div>

        <span className="mt-2 text-[11px] sm:text-xs font-bold text-gray-800 line-clamp-1 group-hover:text-[#FF7A00] transition-colors leading-snug">
          {category.name}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">
          {category.itemCount}+
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(category)}
      className={cn(
        'group flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100/90 bg-white hover:border-orange-200 hover:shadow-xs transition-all duration-200 cursor-pointer select-none',
        className
      )}
    >
      <div
        style={{ backgroundColor: theme.bg }}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/60 shadow-2xs"
      >
        <IconComponent className="h-6 w-6 transition-transform group-hover:scale-110" style={{ color: theme.iconColor }} />
      </div>
      <div>
        <h4 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[#0B5D3B] transition-colors leading-snug">
          {category.name}
        </h4>
        <p className="text-[11px] text-gray-400 mt-0.5">{category.itemCount}+ items</p>
      </div>
    </div>
  );
};
