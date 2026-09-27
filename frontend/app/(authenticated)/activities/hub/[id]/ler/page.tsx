'use client';

import { useEffect, useState } from 'react';
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

  const [access, setAccess] = useState<SecureViewerAccess | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Opening material...');

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace(`/login?redirect=/activities/hub/${contentId}/read`);
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 12;

    const fetchAccess = () => {
      apiGet<SecureViewerAccess & { url?: string; processing_status?: string }>(`/activities/hub/${contentId}/access`)
        .then((data) => {
          if (!isMounted) return;

          // Se estiver em processamento ou sincronizando páginas em background, aguarda e tenta novamente
          const isProcessing =
            data.processing_status === 'processing' ||
            (data.is_secure_viewer && (!data.pages || data.pages.length === 0));

          if (isProcessing) {
            if (retryCount < maxRetries) {
              retryCount++;
              setStatusMessage(`Sincronizando páginas do material... (${retryCount}/${maxRetries})`);
              setTimeout(fetchAccess, 2000);
              return;
            }
          }

          if (!data.is_secure_viewer && data.url) {
            window.location.replace(data.url);
            return;
          }
          if (!data.is_secure_viewer && (!data.pages || data.pages.length === 0)) {
            setError('This material does not use the secure viewer.');
            return;
          }

          setAccess(data);
          setError('');
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          const message = err instanceof Error ? err.message : 'Could not open the material.';
          setError(message);
        })
        .finally(() => {
          if (isMounted && retryCount >= maxRetries) {
            setLoading(false);
          } else if (isMounted && access) {
            setLoading(false);
          }
        });
    };

    fetchAccess();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, user, contentId, router]);

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

        {loading && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-primary" size={36} />
            <p className="text-sm font-medium text-text-muted animate-pulse">{statusMessage}</p>
          </div>
        )}

        {!loading && error && (
          <div className="card-surface p-8 text-center">
            <p className="font-medium text-danger">{error}</p>
            <Link href="/activities/hub" className="btn-primary mt-6 inline-block">
              Back to Taty's Materials
            </Link>
          </div>
        )}

        {!loading && access && (
          <div>
            <h1 className="section-title mb-6 text-2xl">{access.title || 'Material'}</h1>
            <SecureDocumentViewer access={access} watermarkText={watermarkText} />
          </div>
        )}
      </div>
    </HubShell>
  );
}