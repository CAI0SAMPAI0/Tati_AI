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
  price: number;              // legado — mantido para compatibilidade
  price_students?: number | null; // preço para alunos da Tati AI
  price_buyers?: number | null;   // preço para clientes do Hub
  thumbnail_url?: string | null;
  preview_url?: string | null;
  category?: string | null;
  is_featured?: boolean | null;
  processing_status?: string | null;
  type?: string | null;
  has_access?: boolean;
};

/**
 * Resolve o preço correto com base no role do usuário.
 * - 'buyer'   → price_buyers
 * - qualquer outro (student, staff, sem login) → price_students
 * Fallback para `price` legado se as colunas novas forem null/undefined.
 */
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
  { id: 'all', label: 'Todos' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'travel', label: 'Travel' },
  { id: 'business', label: 'Business' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'writing', label: 'Writing' },
] as const;

export type FilterId = (typeof FILTER_OPTIONS)[number]['id'];

export function resolveApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:8001'
  );
}

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
  return labels[category];
}

export function categoryStyles(category: MaterialCategory) {
  if (category === 'travel' || category === 'vocabulary') {
    return {
      header: 'bg-catGreen text-success',
      icon: 'bg-success/15 text-success',
    };
  }
  if (category === 'business') {
    return {
      header: 'bg-catOrange text-warning',
      icon: 'bg-warning/15 text-warning',
    };
  }
  return {
    header: 'bg-catPurple text-primary',
    icon: 'bg-primary/15 text-primary',
  };
}

export function filterMaterials(
  items: CatalogMaterial[],
  filter: FilterId,
): CatalogMaterial[] {
  if (filter === 'all') return items;
  return items.filter((item) => normalizeCategory(item.category) === filter);
}

export function searchMaterials(
  items: CatalogMaterial[],
  query: string,
): CatalogMaterial[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const title = item.title?.toLowerCase() ?? '';
    const desc = item.description?.toLowerCase() ?? '';
    const cat = categoryLabel(normalizeCategory(item.category)).toLowerCase();
    return title.includes(q) || desc.includes(q) || cat.includes(q);
  });
}

export function getInitials(name?: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}