'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
  objectFit?: 'cover' | 'contain';
  sizes?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className,
  imgClassName,
  aspectRatio = 'square',
  padding = 'none',
  priority = false,
  objectFit = 'cover',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw',
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
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          onError={() => setHasError(true)}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'transition-all duration-300',
            objectFit === 'contain' ? 'object-contain' : 'object-cover',
            !isLoaded && 'opacity-0 scale-95',
            isLoaded && 'opacity-100 scale-100',
            imgClassName
          )}
        />
      )}
    </div>
  );
};

