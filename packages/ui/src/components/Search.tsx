'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { Search as SearchIcon, X } from 'lucide-react';

export interface SearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
}

export const Search: React.FC<SearchProps> = ({
  className,
  value,
  onChange,
  onSearch,
  onClear,
  placeholder = 'Search for everyday products...',
  ...props
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      <SearchIcon className="absolute left-3.5 w-4 h-4 text-ink-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-10 rounded-xl border border-line bg-surface-muted py-2 pl-10 pr-8 text-sm text-ink placeholder:text-ink-400 transition-[border-color,box-shadow,background-color] hover:border-line-strong focus:border-brand-orange focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-orange/10"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          aria-label="Clear search"
          className="absolute right-2.5 p-1 rounded-full text-ink-400 hover:text-ink-700 hover:bg-line-subtle"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
