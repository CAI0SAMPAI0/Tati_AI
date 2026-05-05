'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, ...props }, ref) => {
    return (
      <div className="mb-4 relative z-[1]">
        {label && (
          <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 bg-input border border-border rounded-md',
            'text-text text-sm font-body outline-none appearance-none',
            'transition-[border-color,box-shadow] duration-base',
            'focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)]',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

Select.displayName = 'Select';
export { Select };
