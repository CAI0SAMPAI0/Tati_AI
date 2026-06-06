'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import CatalogPageClient from '@/components/catalog/CatalogPageClient';
import HubShell from '@/components/catalog/HubShell';
import type { CatalogMaterial } from '@/lib/catalog';

export default function HubClientPage() {
  const {
    data: materials = [],
    isLoading,
    isError,
  } = useQuery<CatalogMaterial[]>({
    queryKey: ['hub-catalog'],
    queryFn: () => apiGet<CatalogMaterial[]>('/catalog'),
  });

  return (
    <HubShell>
      {isLoading ? (
        <div className="flex justify-center py-32">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="p-10 text-center text-muted">
          <p>Não foi possível carregar o catálogo. Verifique se o backend está rodando.</p>
        </div>
      ) : (
        <CatalogPageClient initialItems={materials} />
      )}
    </HubShell>
  );
}
