'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fetchSecureAccess } from '@tati/hub-core';
import type { SecureViewerAccess } from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';
import SecureDocumentViewer from '@/components/secure/SecureDocumentViewer';

export default function LerMaterialPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isLoaded } = useHubAuth();
  const contentId = params.id as string;

  const [access, setAccess] = useState<SecureViewerAccess | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!token) {
      router.replace(`/login?next=/materiais/${contentId}/ler`);
      return;
    }

    fetchSecureAccess(contentId)
      .then((data) => {
        if (!data.is_secure_viewer && data.url) {
          window.location.replace(data.url);
          return;
        }
        setAccess(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Não foi possível abrir o material.');
      })
      .finally(() => setLoading(false));
  }, [isLoaded, token, contentId, router]);

  const watermarkText = user?.email
    ? `${user.email} · Tati Hub`
    : 'Tati Hub · Uso exclusivo';

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <Link
        href="/meus-materiais"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para meus materiais
      </Link>

      {loading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      )}

      {!loading && error && (
        <div className="card-surface p-8 text-center">
          <p className="text-danger">{error}</p>
          <Link href={`/meus-materiais`} className="btn-primary mt-6 inline-block">
            Voltar para a biblioteca
          </Link>
        </div>
      )}

      {!loading && access && (
        <div>
          <h1 className="section-title mb-6 text-2xl">
            {access.title || 'Material'}
          </h1>
          <SecureDocumentViewer access={access} watermarkText={watermarkText} />
        </div>
      )}
    </div>
  );
}
