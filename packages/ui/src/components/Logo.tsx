'use client';

import React, { useState } from 'react';

export interface LogoProps {
  className?: string;
  imgClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  inverted?: boolean;
  variant?: 'default' | 'icon';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  imgClassName = '',
  size = 'md',
  showTagline = false,
  inverted = false,
  variant = 'default',
}) => {
  const [imgError, setImgError] = useState(false);

  // Balanced sizes for sleek header & UI integration
  const sizeMap = {
    xs: { h: 'h-6 sm:h-7', iconW: 'w-6 h-6 sm:w-7 sm:h-7', subText: 'text-[9px]' },
    sm: { h: 'h-7 sm:h-8', iconW: 'w-7 h-7 sm:w-8 sm:h-8', subText: 'text-[10px]' },
    md: { h: 'h-8 sm:h-9', iconW: 'w-8 h-8 sm:w-9 sm:h-9', subText: 'text-xs' },
    lg: { h: 'h-10 sm:h-12', iconW: 'w-10 h-10 sm:w-12 sm:h-12', subText: 'text-sm' },
    xl: { h: 'h-14 sm:h-16', iconW: 'w-14 h-14 sm:w-16 sm:h-16', subText: 'text-base' },
  };

  const cur = sizeMap[size];

  // App Icon / Favicon variant (from icons/20mart-app-icon.png)
  if (variant === 'icon') {
    return (
      <div className={`inline-flex shrink-0 select-none ${className}`}>
        <img
          src="/icons/20mart-app-icon.png"
          alt="20Mart App Icon"
          className={`${cur.iconW} rounded-xl object-contain shadow-xs`}
          loading="eager"
        />
      </div>
    );
  }

  // Exact Brand Logo from official package (logo/20mart-logo-transparent.png)
  return (
    <div
      className={`inline-flex items-center select-none ${
        inverted ? 'bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-xl shadow-xs' : ''
      } ${className}`}
    >
      {!imgError ? (
        <img
          src="/logo/20mart-logo-transparent.png"
          alt="20Mart – Your Everyday Value Market"
          className={`${cur.h} w-auto object-contain shrink-0 ${imgClassName}`}
          loading="eager"
          onError={() => setImgError(true)}
        />
      ) : (
        // High-fidelity vector SVG fallback in case static assets are not served
        <div className="inline-flex items-center gap-2">
          <svg viewBox="0 0 38 38" fill="none" className="w-8 h-8">
            <path
              d="M13 14V10C13 6.686 15.686 4 19 4C22.314 4 25 6.686 25 10V14"
              stroke="#FF7A00"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M7 13.5H31L28.8 32.2C28.6 33.3 27.6 34 26.5 34H11.5C10.4 34 9.4 33.3 9.2 32.2L7 13.5Z"
              stroke="#0B5D38"
              strokeWidth="2.8"
            />
            <path d="M13 22C14.5 25 23.5 25 25 22" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-heading font-black text-xl text-[#FF7A00]">
            20<span className="text-[#0B5D38]">Mart</span>
          </span>
        </div>
      )}
    </div>
  );
};
