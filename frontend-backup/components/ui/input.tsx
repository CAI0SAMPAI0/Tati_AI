'use client';

import { forwardRef, type InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="mb-4 relative z-[1]">
        {label && (
          <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            type={inputType}
            className={cn(
              'w-full px-3.5 py-2.5 bg-input border border-border rounded-md',
              'text-text text-sm font-body outline-none',
              'transition-[border-color,box-shadow] duration-base',
              'focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)]',
              'placeholder:text-text-subtle',
              isPassword && 'pr-11',
              error && 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_hsla(355,78%,60%,0.12)]',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-text-muted hover:text-primary transition-colors p-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
export { Input };
