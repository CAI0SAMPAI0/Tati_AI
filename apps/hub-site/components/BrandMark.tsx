import React from 'react';

type BrandMarkProps = {
  variant?: 'compact' | 'hero';
  subtitle?: string;
  className?: string;
};

export default function BrandMark({
  variant = 'compact',
  subtitle,
  className = '',
}: BrandMarkProps) {
  const isHero = variant === 'hero';

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span
        lang="en"
        translate="no"
        className={`notranslate font-script leading-none text-primary ${
          isHero ? 'text-3xl md:text-4xl' : 'text-2xl'
        }`}
      >
        Taty&apos;s
      </span>
      <span
        lang="en"
        translate="no"
        className={`notranslate font-display font-extrabold uppercase tracking-[0.12em] text-ink ${
          isHero ? 'text-sm md:text-base' : 'text-[10px]'
        }`}
      >
        {subtitle ?? (isHero ? 'English Class' : 'Tati Hub')}
      </span>
    </span>
  );
}