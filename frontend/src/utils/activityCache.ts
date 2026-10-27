const CACHE_PREFIX = 'tati_act_cache_v1:';

export const TTL_1_DAY_MS = 24 * 60 * 60 * 1000;
export const TTL_7_DAYS_MS = 7 * TTL_1_DAY_MS;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

function buildKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

export function peekActivityCache<T>(key: string): T | null {
  const fullKey = buildKey(key);
  const now = Date.now();

  const mem = memoryCache.get(fullKey);
  if (mem) {
    if (mem.expiresAt > now) {
      return mem.data as T;
    }
    memoryCache.delete(fullKey);
  }

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(fullKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt > now) {
      memoryCache.set(fullKey, parsed);
      return parsed.data;
    }
    window.localStorage.removeItem(fullKey);
  } catch {
    // Ignora falhas de leitura/JSON corrompido no localStorage
  }

  return null;
}

function purgeExpiredLocalStorageEntries(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(window.localStorage.getItem(k) || '');
          if (!item || typeof item.expiresAt !== 'number' || item.expiresAt <= now) {
            keysToRemove.push(k);
          }
        } catch {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignora erros de acesso ao storage
  }
}

export function setActivityCache<T>(key: string, data: T, ttlMs: number): void {
  const fullKey = buildKey(key);
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
  memoryCache.set(fullKey, entry);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {
    // Se atingir limite do localStorage, limpa chaves expiradas e tenta mais uma vez
    purgeExpiredLocalStorageEntries();
    try {
      window.localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch {
      // Permanece em memoryCache na sessão atual sem quebrar
    }
  }
}

export async function cachedActivityFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = TTL_7_DAYS_MS
): Promise<T> {
  const hit = peekActivityCache<T>(key);
  if (hit !== null) {
    return hit;
  }

  const fresh = await fetcher();
  // Só persiste se o retorno não for vazio por falha silenciosa inesperada
  if (fresh !== undefined && fresh !== null) {
    setActivityCache(key, fresh, ttlMs);
  }
  return fresh;
}

export function invalidateActivityCache(prefix = ''): void {
  const targetPrefix = buildKey(prefix);
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(targetPrefix)) {
      memoryCache.delete(k);
    }
  }
  if (typeof window === 'undefined') return;
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(targetPrefix)) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}
