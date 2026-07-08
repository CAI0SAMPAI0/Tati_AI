'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import { PodcastViewer } from '@/components/podcasts/podcast-viewer';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { type Podcast } from '@/lib/api/types/podcast';

export default function PodcastDetailClientPage() {
  const { id } = useParams();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();

  const { data: podcast, isLoading, error } = useQuery<Podcast>({
    queryKey: ['podcast', id],
    queryFn: () => apiGet<Podcast>(ENDPOINTS.ACTIVITIES_PODCAST_DETAIL(id as string)),
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Spinner size="lg" />
    </div>
  );

  if (error || !podcast) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-4 text-center">
      <h1 className="text-xl font-bold text-danger mb-2">Podcast não encontrado</h1>
      <Button onClick={() => router.push('/activities')}>Voltar às Atividades</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />
      
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-text-muted hover:text-primary transition-colors text-sm font-bold group"
            >
              <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
              Back
            </button>

            <PodcastViewer podcast={podcast} />
          </div>
        </main>
      </div>
    </div>
  );
}
