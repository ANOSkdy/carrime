// Private, short-lived browser memory only. Never shared through SSR or a CDN.
const TTL_MS = 30_000;
const MAX_ENTRIES = 32;
type Entry = { expiresAt: number; promise: Promise<unknown> };
const entries = new Map<string, Entry>();

export function invalidateResumeCache(resumeId: string) {
  for (const key of entries.keys()) {
    if (key.startsWith(`${resumeId}:`)) entries.delete(key);
  }
}

export function cachedResumeResource<T>(resumeId: string, resource: string, load: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return load();
  const key = `${resumeId}:${resource}`;
  const existing = entries.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.promise as Promise<T>;
  const entry: Entry = { expiresAt: Date.now() + TTL_MS, promise: Promise.resolve().then(load) };
  entries.delete(key);
  entries.set(key, entry);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  void entry.promise.catch(() => {
    // An old request must never remove a newer entry after a save invalidates it.
    if (entries.get(key) === entry) entries.delete(key);
  });
  return entry.promise as Promise<T>;
}
