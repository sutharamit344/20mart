import { BookOpen, CookingPot, Grid as GridIcon, Home, Layers, Sparkles, type LucideIcon } from 'lucide-react';

export interface CategoryTheme {
  bg: string;
  iconColor: string;
  icon: LucideIcon;
}

/** Visual accent per category slug (falls back to a neutral brand accent for new categories). */
export function getCategoryTheme(slug: string): CategoryTheme {
  switch (slug) {
    case 'home':
      return { bg: '#DCFCE7', iconColor: '#0B5D3B', icon: Home };
    case 'kitchen':
      return { bg: '#FFEED9', iconColor: '#FF7A00', icon: CookingPot };
    case 'stationery':
      return { bg: '#F3E8FF', iconColor: '#9333EA', icon: BookOpen };
    case 'daily-use':
      return { bg: '#FEF3C7', iconColor: '#D97706', icon: Layers };
    case 'cleaning':
      return { bg: '#E0F2FE', iconColor: '#0284C7', icon: Sparkles };
    default:
      return { bg: '#FFEED9', iconColor: '#EA580C', icon: GridIcon };
  }
}
