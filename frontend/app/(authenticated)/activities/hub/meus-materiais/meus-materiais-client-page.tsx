'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/providers/auth-provider';
import ProductCard from '@/components/catalog/ProductCard';
import HubShell from '@/components/catalog/HubShell';
import type { CatalogMaterial } from '@/lib/catalog';

export default function MyMaterialsClientPage() {
  const { user, isLoaded } = useAuth();

  const { data: items = [], isLoading } = useQuery<CatalogMaterial[]>({
    queryKey: ['hub-my-materials'],
    queryFn: () =>
      apiGet<CatalogMaterial[]>('/activities/hub').then((list) =>
        list.filter((item) => item.has_access)
      ),
    enabled: isLoaded && !!user,
  });

  if (!isLoaded || isLoading) {
    return (
      <HubShell>
        <div className="flex min-h-[50vh] items-center justify-center p-10">
          <Spinner />
        </div>
      </HubShell>
    );
  }

  if (!user) {
    return (
      <HubShell>
        <div className="mx-auto max-w-lg p-10 text-center">
          <h1 className="section-title mb-3">My materials</h1>
          <p className="mb-6 text-muted">Sign in to your account to view the library.</p>
        </div>
      </HubShell>
    );
  }

  if (!items.length) {
    return (
      <HubShell>
        <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
          <div>
            <h1 className="section-title text-3xl">My Materials</h1>
            <p className="mt-2 text-muted">Your personal library of exclusive content.</p>
          </div>
          <div className="card-surface flex flex-col items-center p-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-hub bg-primarySoft text-primary">
              <BookOpen size={32} />
            </div>
            <h2 className="font-display text-xl font-bold text-ink">Your library is empty</h2>
            <p className="mt-2 max-w-md text-sm text-muted">
              You haven't acquired any materials yet. Explore the gallery to get started.
            </p>
            <Link href="/activities/hub" className="btn-primary mt-6">
              Explore gallery
            </Link>
          </div>
        </div>
      </HubShell>
    );
  }

  return (
    <HubShell>
      <div className="space-y-8 p-6 md:p-10">
        <div>
          <h1 className="section-title text-3xl">My Materials</h1>
          <p className="mt-2 text-muted">{items.length} material(s) available</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} showOwned={true} />
          ))}
        </div>
      </div>
    </HubShell>
  );
}