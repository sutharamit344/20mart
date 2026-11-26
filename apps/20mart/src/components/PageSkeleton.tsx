import React from 'react';

export default function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="h-28 sm:h-36 w-full rounded-2xl bg-line/80" />

      {/* Control / Bar Skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-line-subtle">
        <div className="h-4 w-28 bg-line rounded-md" />
        <div className="h-7 w-24 bg-line rounded-xl" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl sm:rounded-2xl border border-line-subtle bg-surface p-2 sm:p-2.5 space-y-2.5"
          >
            <div className="aspect-square w-full rounded-lg sm:rounded-xl bg-surface-muted" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-1/3 bg-surface-muted rounded" />
              <div className="h-3.5 w-full bg-surface-muted rounded" />
              <div className="h-3.5 w-2/3 bg-surface-muted rounded" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="h-4 w-12 bg-surface-muted rounded" />
              <div className="h-7 w-14 bg-surface-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

