import CatalogPageClient from '@/components/catalog/CatalogPageClient';
import type { Metadata } from 'next';
import type { CatalogMaterial } from '@/lib/catalog';
import { resolveApiUrl } from '@/lib/catalog';

export const metadata: Metadata = {
  title: "Catálogo | Tati Hub",
  description:
    "Explore o catálogo completo de materiais premium da Teacher Tati — e-books, guias de estudo e recursos selecionados para alunos de inglês.",
  keywords: ["Tati Hub", "Catálogo", "English Class",
    "Materiais", "Exercícios", "Guias", "Livros", "Gramática",
    "Vocabulário", "Inglês Online", "Cursos de Inglês"],
  alternates: {
    canonical: 'https://tati-hub.vercel.app/materiais',
  },
  openGraph: {
    title: "Catálogo | Tati Hub",
    description: "Explore o catálogo completo de materiais premium da Teacher Tati.",
    images: "/images/tati_logo.jpg",
    url: 'https://tati-hub.vercel.app/materiais',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Catálogo | Tati Hub",
    description: "Explore o catálogo completo de materiais premium da Teacher Tati.",
    images: "/images/tati_logo.jpg",
  },
};

async function getMateriais(): Promise<CatalogMaterial[]> {
  const apiUrl = resolveApiUrl();
  console.log('[Hub SSR] Fetching from:', `${apiUrl}/catalog`);
  try {
    const res = await fetch(`${apiUrl}/catalog`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error('[Hub SSR] Fetch failed:', res.status, res.statusText);
      return [];
    }
    return res.json();
  } catch (err) {
    console.error('[Hub SSR] Fetch error:', err);
    return[];
  }
}

export default async function CatalogoPage() {
  const materiais = await getMateriais();

  return <CatalogPageClient initialItems={materiais} />;
}
