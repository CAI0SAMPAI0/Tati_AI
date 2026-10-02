'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import SecureDocumentViewer, {
  type SecureViewerAccess,
} from '@/components/activities/SecureDocumentViewer';
import { apiGet } from '@/lib/api/client';
import HubShell from '@/components/catalog/HubShell';

export default function ReadMaterialPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useAuth();
  const contentId = params.id as string;

  const { data: access, error: queryError, isLoading } = useQuery<SecureViewerAccess & { url?: string; processing_status?: string }>({
    queryKey: ['hub-secure-access', contentId, user?.id || user?.username],
    queryFn: async () => {
      const data = await apiGet<SecureViewerAccess & { url?: string; processing_status?: string }>(`/activities/hub/${contentId}/access`);
      if (!data.is_secure_viewer && data.url) {
        window.location.replace(data.url);
      }
      return data;
    },
    enabled: isLoaded && Boolean(user),
    refetchInterval: (query) => {
      const res = query.state.data as any;
      if (res?.is_secure_viewer && (!res.pages || res.pages.length === 0 || res.processing_status === 'processing')) {
        return 2000;
      }
      return false;
    },
    retry: 2,
  });

  const error = queryError instanceof Error ? queryError.message : (queryError ? 'Could not open the material.' : '');

  const watermarkText = user?.email
    ? `${user.email} · Taty's Materials`
    : "Taty's Materials · Exclusive use";

  if (!isLoaded || !user) {
    return (
      <div className="hub-theme flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <HubShell>
      <div className="mx-auto max-w-4xl p-6 md:p-10">
        <Link
          href="/activities/hub/meus-materiais"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to my materials
        </Link>

        {isLoading && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-primary" size={36} />
            <p className="text-sm font-medium text-text-muted animate-pulse">Opening material...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="card-surface p-8 text-center">
            <p className="font-medium text-danger">{error}</p>
            <Link href="/activities/hub" className="btn-primary mt-6 inline-block">
              Back to Taty's Materials
            </Link>
          </div>
        )}

        {!isLoading && access && (
          <div>
            <h1 className="section-title mb-6 text-2xl">{access.title || 'Material'}</h1>
            <SecureDocumentViewer access={access} watermarkText={watermarkText} />
          </div>
        )}
      </div>
    </HubShell>
  );
}