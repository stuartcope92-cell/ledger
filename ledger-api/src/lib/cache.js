// Tiny in-memory TTL cache. Food data barely changes, so caching lookups keeps
// us well under provider rate limits and makes repeat searches instant.
//
// For a multi-instance deployment swap this for Redis with the same get/set API.

const store = new Map(); // key -> { value, expires }

const DEFAULT_TTL = 1000 * 60 * 60 * 24; // 24h

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(key, value, ttl = DEFAULT_TTL) {
  store.set(key, { value, expires: Date.now() + ttl });
  // opportunistic cleanup so the map can't grow unbounded
  if (store.size > 5000) {
    const now = Date.now();
    for (const [k, v] of store) if (now > v.expires) store.delete(k);
  }
  return value;
}

// Wrap an async producer with caching.
export async function cached(key, ttl, producer) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  return cacheSet(key, value, ttl);
}
