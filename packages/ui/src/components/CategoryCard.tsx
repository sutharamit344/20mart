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
  variant?: 'circle' | 'card';
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

  if (variant === 'circle') {
    return (
      <div
        onClick={() => onClick?.(category)}
        className={cn(
          'group flex flex-col items-center cursor-pointer text-center select-none transition-all hover:-translate-y-0.5',
          className
        )}
      >
        {/* Square rounded card with pastel bg (Screen 01 reference – category tiles) */}
        <div
          style={{ backgroundColor: theme.bg }}
          className="relative flex w-full aspect-square items-center justify-center rounded-2xl shadow-xs transition-all group-hover:shadow-md border border-white/50 p-3 sm:p-4"
        >
          <IconComponent
            className="h-8 w-8 sm:h-10 sm:w-10 transition-transform group-hover:scale-110"
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
        'group flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-xs transition-all cursor-pointer select-none',
        className
      )}
    >
      <div
        style={{ backgroundColor: theme.bg }}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      >
        <IconComponent className="h-6 w-6" style={{ color: theme.iconColor }} />
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
