'use client';

import { useEffect } from 'react';

export default function HubRedirectPage() {
  useEffect(() => {
    const hubUrl = process.env.NEXT_PUBLIC_HUB_SITE_URL || 'http://localhost:3001/materiais';
    window.location.href = hubUrl;
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-muted">Redirecionando para o Taty Hub Premium...</p>
      </div>
    </div>
  );
}
