export type MaterialCategory =
  | 'grammar'
  | 'speaking'
  | 'travel'
  | 'business'
  | 'vocabulary'
  | 'writing'
  | 'other';

export type CatalogMaterial = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  price_students?: number | null;
  price_buyers?: number | null;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  category?: string | null;
  is_featured?: boolean | null;
  processing_status?: string | null;
  type?: string | null;
  has_access?: boolean;
};

export function resolvePrice(item: CatalogMaterial, role?: string | null): number {
  if (role === 'buyer') {
    return item.price_buyers ?? item.price ?? 0;
  }
  return item.price_students ?? item.price ?? 0;
}

export function formatPrice(value: number): string {
  return value === 0
    ? 'Grátis'
    : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'travel', label: 'Travel' },
  { id: 'business', label: 'Business' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'writing', label: 'Writing' },
] as const;

export type FilterId = (typeof FILTER_OPTIONS)[number]['id'];

export function normalizeCategory(raw?: string | null): MaterialCategory {
  const value = (raw ?? 'other').toLowerCase().trim();
  const allowed: MaterialCategory[] = [
    'grammar',
    'speaking',
    'travel',
    'business',
    'vocabulary',
    'writing',
    'other',
  ];
  return allowed.includes(value as MaterialCategory) ? (value as MaterialCategory) : 'other';
}

export function categoryLabel(category: MaterialCategory): string {
  const labels: Record<MaterialCategory, string> = {
    grammar: 'Grammar',
    speaking: 'Speaking',
    travel: 'Travel',
    business: 'Business',
    vocabulary: 'Vocabulary',
    writing: 'Writing',
    other: 'Material',
  };
  return labels[category] || 'Material';
}

export function categoryStyles(category: MaterialCategory) {
  if (category === 'travel' || category === 'vocabulary') {
    return {
      header: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (category === 'business') {
    return {
      header: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
      icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    };
  }
  if (category === 'grammar' || category === 'writing') {
    return {
      header: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
      icon: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    };
  }
  return {
    header: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
    icon: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  };
}

export function getInitials(name?: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function filterMaterials(materials: CatalogMaterial[], filter: FilterId): CatalogMaterial[] {
  if (filter === 'all') return materials;
  return materials.filter((m) => normalizeCategory(m.category) === filter);
}

export function searchMaterials(materials: CatalogMaterial[], query: string): CatalogMaterial[] {
  if (!query.trim()) return materials;
  const q = query.toLowerCase().trim();
  return materials.filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
  );
}
