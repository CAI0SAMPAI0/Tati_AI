/**
 * Media Cache Utility using the browser Cache Storage API.
 * Provides offline & persistent 30-day caching for protected materials, documents, and media.
 */

const CACHE_NAME = 'tati_materials_pages_v1';
const blobUrlMap = new Map<string, string>();

export async function getCachedMediaUrl(originalUrl: string): Promise<string> {
  if (typeof window === 'undefined' || !('caches' in window) || !originalUrl) {
    return originalUrl;
  }

  // If already mapped to an object URL in this session, return it
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

    // Fetch and store in cache
    const response = await fetch(originalUrl, { mode: 'cors' });
    if (response.ok) {
      await cache.put(originalUrl, response.clone());
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlMap.set(originalUrl, objectUrl);
      return objectUrl;
    }
  } catch (err) {
    // If CORS or CacheStorage fails, fallback gracefully to original URL
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
