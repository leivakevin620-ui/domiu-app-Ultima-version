const cache = new Map<string, { data: unknown; expiry: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { cache.delete(key); return null; }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

export function clearCache(pattern?: string): void {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) cache.delete(key);
  }
}
