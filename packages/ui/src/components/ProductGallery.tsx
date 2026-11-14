'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ProductImage } from './ProductImage';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

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
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeImage = images[selectedIdx] || images[0] || '';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePosition({ x, y });
  };

  const handleNext = () => {
    setSelectedIdx((prev) => (prev + 1) % images.length);
    setLightboxScale(1);
  };

  const handlePrev = () => {
    setSelectedIdx((prev) => (prev - 1 + images.length) % images.length);
    setLightboxScale(1);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, images.length]);

  return (
    <div className={cn('flex flex-col gap-2.5 sm:gap-3', className)}>
      {/* Main Image Container with Hover Zoom & Click for Fullscreen */}
      <div
        ref={containerRef}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setIsLightboxOpen(true)}
        className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-100 bg-white flex items-center justify-center shadow-xs cursor-zoom-in select-none"
      >
        {/* Zoomed Image on Hover */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out pointer-events-none"
          style={{
            transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`,
            transform: isZoomed ? 'scale(2.2)' : 'scale(1)',
          }}
        >
          <ProductImage
            src={activeImage}
            alt={productName}
            aspectRatio="square"
            padding="none"
            priority={true}
            objectFit="contain"
            className="w-full h-full"
          />
        </div>

        {/* Hover Zoom Hint Badge (Bottom Right) */}
        <div
          className={cn(
            'absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-gray-200/80 text-[11px] font-bold text-gray-700 shadow-xs pointer-events-none transition-opacity duration-200',
            isZoomed ? 'opacity-0' : 'opacity-100'
          )}
        >
          <ZoomIn className="w-3.5 h-3.5 text-[#FF7A00]" />
          <span className="hidden sm:inline">Roll over image to zoom in</span>
          <span className="sm:hidden">Tap to Zoom</span>
        </div>

        {/* Fullscreen Expand Icon (Top Right) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsLightboxOpen(true);
          }}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-xs border border-gray-200 text-gray-600 shadow-xs opacity-0 group-hover:opacity-100 hover:text-[#FF7A00] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          title="Open Fullscreen Zoom"
          aria-label="Open Fullscreen Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                'relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all cursor-pointer',
                selectedIdx === idx
                  ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs scale-105'
                  : 'border-gray-200 hover:border-gray-300 opacity-70 hover:opacity-100'
              )}
            >
              <ProductImage
                src={img}
                alt={`${productName} thumbnail ${idx + 1}`}
                aspectRatio="square"
                padding="none"
                objectFit="contain"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md select-none">
          {/* Lightbox Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 text-white">
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-bold text-gray-200 truncate max-w-xs sm:max-w-md">
                {productName}
              </span>
              <span className="text-xs text-gray-400">
                ({selectedIdx + 1} / {images.length})
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxScale((prev) => Math.min(3, prev + 0.5))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxScale((prev) => Math.max(1, prev - 0.5))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxScale(1)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setLightboxScale(1);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 text-white transition-colors cursor-pointer ml-2"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image Area */}
          <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-4 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer"
                  title="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-4 z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer"
                  title="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <div
              className="max-w-3xl max-h-[75vh] w-full h-full flex items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${lightboxScale})` }}
            >
              <img
                src={activeImage}
                alt={productName}
                className="max-h-[75vh] max-w-full object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Lightbox Bottom Thumbnails */}
          {images.length > 1 && (
            <div className="py-3 border-t border-white/10 flex items-center justify-center gap-2 px-4 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    setLightboxScale(1);
                  }}
                  className={cn(
                    'h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-white cursor-pointer',
                    selectedIdx === idx
                      ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/50 scale-105'
                      : 'border-transparent opacity-50 hover:opacity-90'
                  )}
                >
                  <img
                    src={img}
                    alt={`Thumb ${idx + 1}`}
                    className="h-full w-full object-contain p-1"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
