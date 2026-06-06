'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { fetchSecureAccess } from '@tati/hub-core';
import type { SecureViewerAccess } from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';
import SecureDocumentViewer from '@/components/secure/SecureDocumentViewer';

export default function LerClientPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isLoaded } = useHubAuth();
  const contentId = params.id as string;

  const { data: access, error, isLoading } = useQuery<SecureViewerAccess>({
    queryKey: ['hub-secure-access', contentId],
    queryFn: async () => {
      const data = await fetchSecureAccess(contentId);
      if (!data.is_secure_viewer && data.url) {
        window.location.replace(data.url);
      }
      return data;
    },
    enabled: isLoaded && Boolean(token),
    retry: false,
  });

  if (isLoaded && !token) {
    router.replace(`/login?next=/materiais/${contentId}/ler`);
    return null;
  }

  const watermarkText = user?.email ? `${user.email} · Tati Hub` : 'Tati Hub · Uso exclusivo';

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <Link
        href="/meus-materiais"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para meus materiais
      </Link>

      {isLoading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && error && (
        <div className="card-surface p-8 text-center">
          <p className="text-danger">
            {error instanceof Error ? error.message : 'Não foi possível abrir o material.'}
          </p>
          <Link href="/meus-materiais" className="btn-primary mt-6 inline-block">
            Voltar para a biblioteca
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
  );
}
