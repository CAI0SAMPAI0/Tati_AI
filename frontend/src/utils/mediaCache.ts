/**
 * Utilitário de cache de mídia utilizando a Cache Storage API do navegador.
 * Fornece armazenamento persistente por 30 dias para materiais protegidos, documentos e mídias.
 */

const CACHE_NAME = 'tati_materials_pages_v1';
const blobUrlMap = new Map<string, string>();

export async function getCachedMediaUrl(originalUrl: string): Promise<string> {
  if (typeof window === 'undefined' || !('caches' in window) || !originalUrl) {
    return originalUrl;
  }

  // Se já mapeado para uma object URL nesta sessão, retorna diretamente
  if (blobUrlMap.has(originalUrl)) {
    return blobUrlMap.get(originalUrl)!;
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(originalUrl);

    if (cachedResponse && cachedResponse.ok) {
      const blob = await cachedResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlMap.set(originalUrl, objectUrl);
      return objectUrl;
    }

    // Baixa a mídia e armazena no cache
    const response = await fetch(originalUrl, { mode: 'cors' });
    if (response.ok) {
      await cache.put(originalUrl, response.clone());
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlMap.set(originalUrl, objectUrl);
      return objectUrl;
    }
  } catch (err) {
    // Em caso de falha de CORS ou CacheStorage, utiliza a URL original como contingência
    console.debug('[mediaCache] Fallback to direct URL for:', originalUrl);
  }

  return originalUrl;
}

export function releaseCachedMediaUrls(): void {
  for (const url of blobUrlMap.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  blobUrlMap.clear();
}
