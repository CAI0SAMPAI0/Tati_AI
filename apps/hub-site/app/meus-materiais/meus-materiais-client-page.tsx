'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { apiGet, HUB_ENDPOINTS } from '@tati/hub-core';
import type { PremiumCatalogItem } from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';
import ProductCard from '@/components/catalog/ProductCard';
import type { CatalogMaterial } from '@/lib/catalog';

export default function MyMaterialsClientPage() {
  const { user, isLoaded, token } = useHubAuth();

  const { data: items = [] } = useQuery<CatalogMaterial[]>({
    queryKey: ['hub-my-materials'],
    queryFn: () =>
      apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC).then((catalog) =>
        catalog
          .filter((entry) => entry.has_access)
          .map((entry) => ({
            id: entry.id,
            title: entry.title,
            description: entry.description,
            price: entry.price,
            thumbnail_url: entry.thumbnail_url,
            preview_url: entry.preview_url ?? entry.thumbnail_url,
            category: entry.category,
            is_featured: entry.is_featured,
            has_access: true,
          })),
      ),
    enabled: isLoaded && Boolean(token),
  });

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <h1 className="section-title mb-3">Meus Materiais</h1>
        <p className="mb-6 text-muted">Entre na sua conta para ver a biblioteca.</p>
        <Link href="/login" className="btn-primary inline-block">
          Entrar
        </Link>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
        <div>
          <h1 className="section-title text-3xl">Meus Materiais</h1>
          <p className="mt-2 text-muted">Sua biblioteca pessoal de conteúdos exclusivos.</p>
        </div>
        <div className="card-surface flex flex-col items-center p-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-hub bg-primarySoft text-primary">
            <BookOpen size={32} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">Sua biblioteca está vazia</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Você ainda não adquiriu nenhum material. Explore a galeria para começar.
          </p>
          <Link href="/materiais" className="btn-primary mt-6">
            Explorar galeria
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-10">
      <div>
        <h1 className="section-title text-3xl">Meus Materiais</h1>
        <p className="mt-2 text-muted">{items.length} material(is) disponível(is)</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} showOwned={true} />
        ))}
      </div>
    </div>
  );
}
