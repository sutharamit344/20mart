'use client';

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { ShoppingBag } from 'lucide-react';

export interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  aspectRatio?: 'square' | 'video' | '4/3';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  priority?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className,
  imgClassName,
  aspectRatio = 'square',
  padding = 'sm',
  priority = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const paddingClass = {
    none: 'p-0',
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  }[padding];

  const aspectClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    '4/3': 'aspect-[4/3]',
  }[aspectRatio];

  const showPlaceholder = !src || hasError;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-white flex items-center justify-center rounded-xl select-none',
        aspectClass,
        paddingClass,
        className
      )}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {showPlaceholder ? (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-[#FFF6E9]/60 p-3 text-center border border-orange-100/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs mb-1.5">
            <ShoppingBag className="h-5 w-5 text-[#FF7A00]" />
          </div>
          <span className="text-[11px] font-bold text-[#0B5D3B] line-clamp-1 max-w-[90%]">
            20Mart
          </span>
          <span className="text-[9px] text-gray-400 font-medium">Daily Value</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setHasError(true)}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'w-full h-full max-h-full max-w-full object-contain object-center transition-all duration-300',
            !isLoaded && 'opacity-0 scale-95',
            isLoaded && 'opacity-100 scale-100',
            imgClassName
          )}
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
          }}
        />
      )}
    </div>
  );
};

