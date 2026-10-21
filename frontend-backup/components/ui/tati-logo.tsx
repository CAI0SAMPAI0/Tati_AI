'use client';

import Image from 'next/image';
import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const PRIMARY_SRC = '/images/tati_logo.jpg';
const FALLBACK_SRC = '/images/tati_logo.png';

interface TatiLogoProps {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

/** Avatar/logo da Prof. Tatiana com fallback duplo se o arquivo não carregar. */
export function TatiLogo({
  size = 32,
  className,
  alt = "Taty's Hub",
  priority = false,
}: TatiLogoProps) {
  const [src, setSrc] = useState(PRIMARY_SRC);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (src === PRIMARY_SRC) {
      setSrc(FALLBACK_SRC);
    } else {
      setFailed(true);
    }
  };

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
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      priority={priority}
      className={cn('object-cover shrink-0', className)}
      onError={handleError}
    />
  );
}
