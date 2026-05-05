'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

import { ActivityCard } from '@/components/activities/activity-card';
import { Spinner } from '@/components/ui/spinner';
import { type Podcast } from '@/lib/api/types/podcast';
import { useRouter } from 'next/navigation';
import { Clock, Tag } from 'lucide-react';

export function PodcastList() {
  
  const router = useRouter();

  const { data: podcasts, isLoading, error } = useQuery<Podcast[]>({
    queryKey: ['podcasts-recommendations'],
    queryFn: () => apiGet<Podcast[]>(`${ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS}?lang=${'en-US'}`),
  });

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Spinner size="lg" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center bg-danger/5 border border-danger/20 rounded-2xl text-danger">
      {'Error. Please try again.'}
    </div>
  );

  if (!podcasts || podcasts.length === 0) {
    return (
      <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
        {'No podcasts available.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
      {podcasts.map((p) => (
        <ActivityCard
          key={p.id}
          title={p.title}
          description={p.description || 'Get ready to listen and practice.'}
          imageUrl={p.thumbnail}
          type="podcast"
          onClick={() => router.push(`/podcasts/${p.id}`)}
          actionLabel={'▶ Play'}
          meta={[
            { icon: <Tag size={12} />, label: p.level },
            { icon: <Clock size={12} />, label: p.duration || '--:--' }
          ]}
        />
      ))}
    </div>
  );
}
