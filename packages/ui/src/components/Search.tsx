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
      <SearchIcon className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-9.5 rounded-full border border-gray-200 bg-gray-50/70 py-2 pl-9.5 pr-8 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-[#FF7A00] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/15"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-2.5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
