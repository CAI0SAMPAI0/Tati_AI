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

export function resolvePrice(
  item: CatalogMaterial,
  user?: { role?: string | null; is_hub_only?: boolean | null } | string | null
): number {
  if (!user) {
    // Deslogado: valor de comprador do hub
    return item.price_buyers ?? item.price ?? 0;
  }
  const role = typeof user === 'string' ? user : user.role;
  const isHubOnly = typeof user === 'object' && user ? Boolean(user.is_hub_only) : false;

  // Aluno da plataforma Tati AI: valor de aluno
  const isStudent = role === 'student' || (!isHubOnly && role !== 'buyer' && Boolean(role));
  if (isStudent) {
    return item.price_students ?? item.price ?? 0;
  }

  // Usuário apenas do Hub: valor de hub
  return item.price_buyers ?? item.price ?? 0;
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
  const env = (import.meta as any).env || {};
  return (
    env.VITE_API_URL ??
    env.VITE_API_BASE_URL ??
    'http://localhost:8000'
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
