import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ProfileClientPage from './profile-client-page';

export default async function Page() {
  const state = await prefetchRoute('profile');
  return (
    <PrefetchHydration state={state}>
      <ProfileClientPage />
    </PrefetchHydration>
  );
}
