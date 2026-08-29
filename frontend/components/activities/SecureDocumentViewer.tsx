'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Image from 'next/image';
import { Shield, Maximize, Minimize } from 'lucide-react';

export type SecureViewerAccess = {
  type: string;
  pages: string[];
  total_pages: number;
  is_secure_viewer: boolean;
  title?: string;
  external_links?: {
    uri: string;
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
  }[];
};

type SecureDocumentViewerProps = {
  access: SecureViewerAccess;
  watermarkText: string;
};

export default function SecureDocumentViewer({
  access,
  watermarkText,
}: SecureDocumentViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});
  const viewerRef = useRef<HTMLDivElement>(null);

  const watermarkTiles = useMemo(() => Array.from({ length: 24 }), []);

  useEffect(() => {
    // Evita o botão direito do mouse para proteger a imagem
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen().catch(err => {
        console.error(`Erro ao tentar modo tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={viewerRef}
      className={`secure-viewer relative select-none ${isFullscreen ? 'bg-bg overflow-y-auto p-4' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <div className="mb-6 flex items-center justify-between rounded-hub border border-line bg-primarySoft px-4 py-3 text-sm text-muted">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <span>
            Visualização protegida — {access.total_pages} página(s).
          </span>
        </div>
        <button 
          onClick={toggleFullscreen}
          className="flex items-center gap-2 text-primary font-medium hover:opacity-80 transition-opacity"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          <span className="hidden sm:inline">{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {access.pages?.map((url, index) => {
          const pageLinks = access.external_links?.filter(l => l.page === index) || [];
          const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 'https://gkziqqjswecteekanwnv.supabase.co/storage/v1/object/public/hub-secure-pages';
          const safeUrl = url.startsWith('http') ? url : `${storageUrl}/${url}`;

          return (
            <figure
              key={`${url}-${index}`}
              className={`relative overflow-hidden rounded-hub border border-line bg-white shadow-sm mx-auto ${
                isFullscreen ? 'max-w-5xl my-4 shadow-lg' : 'w-full'
              }`}
            >
              <div 
                className="relative w-full mx-auto transition-all duration-300 min-h-[500px]"
                style={{ 
                  aspectRatio: aspectRatios[index] ? `${aspectRatios[index]}` : '3/4',
                  maxWidth: isFullscreen ? '1024px' : '768px'
                }}
              >
                <Image
                  src={safeUrl}
                  alt={`Página ${index + 1}`}
                  fill
                  className="object-contain bg-white"
                  sizes={isFullscreen ? "(max-width: 1200px) 100vw, 1200px" : "(max-width: 900px) 100vw, 900px"}
                  unoptimized
                  priority={index < 4}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.naturalWidth && img.naturalHeight) {
                      const ratio = img.naturalWidth / img.naturalHeight;
                      setAspectRatios((prev) => ({ ...prev, [index]: ratio }));
                    }
                  }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (!img.dataset.retried) {
                      img.dataset.retried = 'true';
                      setTimeout(() => {
                        const separator = safeUrl.includes('?') ? '&' : '?';
                        img.src = `${safeUrl}${separator}retry=${Date.now()}`;
                      }, 1000);
                    }
                  }}
                />

                {/* Links Mapeados (Botões Clicáveis Transparentes) */}
                {pageLinks.map((link, i) => (
                  <a
                    key={`link-${index}-${i}`}
                    href={link.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute z-20 cursor-pointer rounded bg-primary/0 hover:bg-primary/10 transition-colors"
                    title={link.uri}
                    style={{
                      left: `${link.left * 100}%`,
                      top: `${link.top * 100}%`,
                      width: `${link.width * 100}%`,
                      height: `${link.height * 100}%`,
                    }}
                  />
                ))}

                {/* Marca d'água */}
                <div
                  className="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 gap-8 overflow-hidden p-4 opacity-[0.12]"
                  aria-hidden
                >
                  {watermarkTiles.map((_, i) => (
                    <span
                      key={i}
                      className="rotate-[-24deg] text-center text-[10px] font-bold uppercase tracking-wide text-ink"
                    >
                      {watermarkText}
                    </span>
                  ))}
                </div>
              </div>
              <figcaption className="border-t border-line px-4 py-2 text-center text-xs text-subtle">
                Página {index + 1} de {access.total_pages}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
