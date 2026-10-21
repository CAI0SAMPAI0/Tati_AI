'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center font-semibold font-body rounded-md transition-all duration-base ease',
          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-bg',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
          // Variants
          variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover hover:shadow-glow hover:-translate-y-px',
          variant === 'secondary' && 'bg-surface border border-border text-text hover:bg-surface-hover hover:border-border-focus',
          variant === 'ghost' && 'bg-transparent text-text-muted hover:bg-primary-dim hover:text-primary',
          variant === 'danger' && 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
          // Sizes
          size === 'sm' && 'text-xs px-3 py-1.5',
          size === 'md' && 'text-sm px-4 py-2.5',
          size === 'lg' && 'text-base px-6 py-3',
          size === 'icon' && 'h-9 w-9 p-0',
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
export { Button, type ButtonProps };
