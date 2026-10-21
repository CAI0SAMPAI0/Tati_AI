'use client';

import { FILTER_OPTIONS, type FilterId } from '@/lib/catalog';

type FilterChipsProps = {
  active: FilterId;
  onChange: (filter: FilterId) => void;
};

export default function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar materiais">
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={active === option.id}
          onClick={() => onChange(option.id)}
          className={`chip ${active === option.id ? 'chip-active' : 'chip-inactive'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
