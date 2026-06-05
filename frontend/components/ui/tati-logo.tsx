'use client';

import Image from 'next/image';
import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/images/tati_logo.jpg';

interface TatiLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

/** Avatar/logo da Prof. Tatiana com fallback se o arquivo não carregar. */
export function TatiLogo({ size = 32, className, alt = 'Teacher Tati' }: TatiLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-primary text-white shrink-0',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <GraduationCap size={Math.round(size * 0.5)} />
      </div>
    );
  }

  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={cn('object-cover shrink-0', className)}
      onError={() => setFailed(true)}
    />
  );
}
