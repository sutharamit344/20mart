'use client';

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { ProductImage } from './ProductImage';

export interface ProductGalleryProps {
  images: string[];
  productName: string;
  className?: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images,
  productName,
  className,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeImage = images[selectedIdx] || images[0] || '';

  return (
    <div className={cn('flex flex-col gap-2.5 sm:gap-3', className)}>
      {/* Main Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-100 bg-white flex items-center justify-center shadow-xs">
        <ProductImage
          src={activeImage}
          alt={productName}
          aspectRatio="square"
          padding="none"
          priority={true}
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                'relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all cursor-pointer',
                selectedIdx === idx
                  ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 opacity-70 hover:opacity-100'
              )}
            >
              <ProductImage
                src={img}
                alt={`${productName} thumbnail ${idx + 1}`}
                aspectRatio="square"
                padding="none"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
