'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiGet, HUB_ENDPOINTS } from '@tati/hub-core';
import type { PremiumCatalogItem } from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';
import HeroBanner from '@/components/catalog/HeroBanner';
import FilterChips from '@/components/catalog/FilterChips';
import ProductCard from '@/components/catalog/ProductCard';
import {
  type CatalogMaterial,
  type FilterId,
  filterMaterials,
  searchMaterials,
} from '@/lib/catalog';

function mergeAccess(
  base: CatalogMaterial[] | null,
  authenticated: PremiumCatalogItem[] | null,
): CatalogMaterial[] {
  const safeBase = base || [];
  if (!authenticated) return safeBase;
  const accessMap = new Map(authenticated.map((item) => [item.id, item.has_access]));
  return safeBase.map((item) => ({
    ...item,
    has_access: accessMap.get(item.id) ?? item.has_access,
  }));
}

function Section({
  title,
  items,
  showOwned,
  onAccessGranted,
}: {
  title: string;
  items: CatalogMaterial[];
  showOwned?: boolean;
  onAccessGranted?: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="section-title">{title}</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            showOwned={showOwned || item.has_access}
            onAccessGranted={() => onAccessGranted?.(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default function CatalogPageClient() {
  const { token } = useHubAuth();
  const [filter, setFilter] = useState<FilterId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [accessOverrides, setAccessOverrides] = useState<Record<string, boolean>>({});

  const { data: catalog = [] } = useQuery<CatalogMaterial[]>({
    queryKey: ['hub-catalog'],
    queryFn: () => apiGet<CatalogMaterial[]>('/catalog'),
  });

  const { data: authenticatedCatalog } = useQuery<PremiumCatalogItem[]>({
    queryKey: ['hub-public-catalog'],
    queryFn: () => apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC),
    enabled: Boolean(token),
  });

  const items = useMemo(() => {
    const merged = mergeAccess(catalog, authenticatedCatalog ?? null) || [];
    return merged.map((item) =>
      accessOverrides[item.id] ? { ...item, has_access: true } : item,
    );
  }, [catalog, authenticatedCatalog, accessOverrides]);

  const handleAccessGranted = useCallback((id: string) => {
    setAccessOverrides((prev) => ({ ...prev, [id]: true }));
  }, []);

  const categoryFiltered = useMemo(() => filterMaterials(items, filter), [items, filter]);

  const searchFiltered = useMemo(
    () => searchMaterials(categoryFiltered, searchQuery),
    [categoryFiltered, searchQuery],
  );

  const featured = useMemo(
    () =>
      searchFiltered.filter(
        (item) => item.is_featured && filter === 'all' && !searchQuery.trim(),
      ),
    [searchFiltered, filter, searchQuery],
  );

  const showSections = filter === 'all' && !searchQuery.trim();

  return (
    <div className="space-y-10 p-6 md:p-10">
      <HeroBanner />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <FilterChips active={filter} onChange={setFilter} />

        <div className="relative w-full md:w-64 lg:w-80">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            className="input-hub w-full pl-10"
            placeholder="Pesquisar materiais..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Pesquisar materiais"
          />
        </div>
      </div>

      {showSections && featured.length > 0 && (
        <Section title="Em destaque" items={featured} onAccessGranted={handleAccessGranted} />
      )}

      <Section
        title={showSections ? 'Todos os materiais' : 'Resultados'}
        items={searchFiltered}
        onAccessGranted={handleAccessGranted}
      />

      {searchFiltered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-line py-20 text-center text-muted">
          <p>Nenhum material encontrado com esses filtros.</p>
        </div>
      )}
    </div>
  );
}
