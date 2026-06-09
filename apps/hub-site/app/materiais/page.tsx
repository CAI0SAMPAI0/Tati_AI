import CatalogPageClient from '@/components/catalog/CatalogPageClient';
import { prefetchHubCatalog } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Catálogo | Tati Hub',
  description:
    'Explore o catálogo completo de materiais premium da Teacher Tati — e-books, guias de estudo e recursos selecionados para alunos de inglês.',
  keywords: [
    'Tati Hub',
    'Catálogo',
    'English Class',
    'Materiais',
    'Exercícios',
    'Guias',
    'Livros',
    'Gramática',
    'Vocabulário',
    'Inglês Online',
    'Cursos de Inglês',
  ],
  alternates: {
    canonical: 'https://tati-hub.vercel.app/materiais',
  },
  openGraph: {
    title: 'Catálogo | Tati Hub',
    description: 'Explore o catálogo completo de materiais premium da Teacher Tati.',
    images: '/images/tati_logo.jpg',
    url: 'https://tati-hub.vercel.app/materiais',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Catálogo | Tati Hub',
    description: 'Explore o catálogo completo de materiais premium da Teacher Tati.',
    images: '/images/tati_logo.jpg',
  },
};

export default async function CatalogoPage() {
  const state = await prefetchHubCatalog();

  return (
    <PrefetchHydration state={state}>
      <CatalogPageClient />
    </PrefetchHydration>
  );
}
