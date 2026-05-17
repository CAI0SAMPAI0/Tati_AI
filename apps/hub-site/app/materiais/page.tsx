import CatalogPageClient from '@/components/catalog/CatalogPageClient';
import type { CatalogMaterial } from '@/lib/catalog';
import { resolveApiUrl } from '@/lib/catalog';

async function getMateriais(): Promise<CatalogMaterial[]> {
  const apiUrl = resolveApiUrl();
  const res = await fetch(`${apiUrl}/catalog`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function CatalogoPage() {
  const materiais = await getMateriais();

  return <CatalogPageClient initialItems={materiais} />;
}
