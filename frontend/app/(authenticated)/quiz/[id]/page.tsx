import { Suspense } from 'react';
import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import { Spinner } from '@/components/ui/spinner';
import QuizClientPage from './quiz-client-page';

export default async function Page({ params }: { params: { id: string } }) {
  const state = await prefetchRoute('quiz', { id: params.id });
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>}>
      <PrefetchHydration state={state}>
        <QuizClientPage />
      </PrefetchHydration>
    </Suspense>
  );
}
