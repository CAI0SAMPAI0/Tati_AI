'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, WifiOff, PackageOpen } from 'lucide-react';
import { apiGet, HUB_ENDPOINTS } from '@tati/hub-core';
import type { PremiumCatalogItem } from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';
import HeroBanner from '@/components/catalog/HeroBanner';
import FilterChips from '@/components/catalog/FilterChips';
import ProductCard from '@/components/catalog/ProductCard';
import CatalogSkeleton from '@/components/catalog/CatalogSkeleton';
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

/* ─── Estado visual: Erro / Timeout ───────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center">
      <WifiOff size={40} className="mb-4 text-text-subtle" strokeWidth={1.5} />
      <p className="text-base font-semibold text-text">
        Não foi possível carregar os materiais.
      </p>
      <p className="mt-1 text-sm text-muted">
        Verifique sua conexão e tente novamente.
      </p>
      <button
        onClick={onRetry}
        className="btn-primary mt-5 flex items-center gap-2"
      >
        <RefreshCw size={14} />
        Tentar novamente
      </button>
    </div>
  );
}

/* ─── Estado visual: Vazio (HTTP 200 + []) ────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center">
      <PackageOpen size={40} className="mb-4 text-text-subtle" strokeWidth={1.5} />
      <p className="text-base font-semibold text-text">
        Nenhum material disponível no momento.
      </p>
      <p className="mt-1 text-sm text-muted">
        Novos materiais serão publicados em breve!
      </p>
    </div>
  );
}

/* ─── Estado visual: Nenhum resultado de busca/filtro ─────── */
function NoResultsState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line py-20 text-center text-muted">
      <p>Nenhum material encontrado com esses filtros.</p>
    </div>
  );
}

export default function CatalogPageClient() {
  const { token } = useHubAuth();
  const [filter, setFilter] = useState<FilterId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [accessOverrides, setAccessOverrides] = useState<Record<string, boolean>>({});

  const {
    data: catalogData,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    refetch: refetchCatalog,
  } = useQuery<CatalogMaterial[]>({
    queryKey: ['hub-catalog'],
    queryFn: () => apiGet<CatalogMaterial[]>('/catalog'),
    staleTime: 5 * 60 * 1000,   // 5 min — stale-while-revalidate
    gcTime: 10 * 60 * 1000,     // 10 min — mantém no cache
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const catalog = catalogData ?? [];

  const { data: authenticatedCatalog } = useQuery<PremiumCatalogItem[]>({
    queryKey: ['hub-public-catalog'],
    queryFn: () => apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  // ─── Estados visuais corretos ──────────────────────────────
  // 1. Loading  → Skeleton
  // 2. Erro     → Mensagem de erro + retry
  // 3. Vazio    → "Nenhum material" (somente com HTTP 200 + [])
  // 4. Filtros  → "Nenhum resultado com esses filtros"

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
            id="catalog-search"
            type="search"
            className="input-hub w-full pl-10"
            placeholder="Pesquisar materiais..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Pesquisar materiais"
          />
        </div>
      </div>

      {/* LOADING — Skeleton enquanto carrega */}
      {isCatalogLoading && (
        <section className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-border/40" />
          <CatalogSkeleton count={6} />
        </section>
      )}

      {/* ERRO — Mensagem com retry */}
      {isCatalogError && !isCatalogLoading && (
        <ErrorState onRetry={() => refetchCatalog()} />
      )}

      {/* CONTEÚDO CARREGADO */}
      {!isCatalogLoading && !isCatalogError && (
        <>
          {/* Dados realmente vazios (HTTP 200 + []) */}
          {catalog.length === 0 && <EmptyState />}

          {/* Dados existem mas filtro/busca não retornou nada */}
          {catalog.length > 0 && (
            <>
              {showSections && featured.length > 0 && (
                <Section title="Em destaque" items={featured} onAccessGranted={handleAccessGranted} />
              )}

              <Section
                title={showSections ? 'Todos os materiais' : 'Resultados'}
                items={searchFiltered}
                onAccessGranted={handleAccessGranted}
              />

              {searchFiltered.length === 0 && <NoResultsState />}
            </>
          )}
        </>
      )}
    </div>
  );
}
