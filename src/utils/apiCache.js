/**
 * Two-tier browser cache
 *
 * Tier 1: in-memory Map  — always used, cleared on page refresh
 * Tier 2: localStorage   — opt-in (useLS=true), survives refresh
 *
 * Use localStorage only for small payloads (e.g. the sections list).
 * Keep large section bodies in memory only to avoid quota errors.
 */

const memCache = new Map();

function lsRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded or private-browsing restriction — silently ignore
    console.warn('[apiCache] localStorage write failed for key:', key, e.message);
  }
}

/**
 * Retrieve a cached value.
 * Checks memory first; falls back to localStorage when useLS is true.
 * Returns null on cache miss.
 */
export function cacheGet(key, useLS = false) {
  if (memCache.has(key)) return memCache.get(key);
  if (useLS) {
    const v = lsRead(key);
    if (v !== null) {
      memCache.set(key, v);   // promote to memory tier
      return v;
    }
  }
  return null;
}

/**
 * Store a value in the cache.
 * Always writes to memory; also writes to localStorage when useLS is true.
 */
export function cacheSet(key, value, useLS = false) {
  memCache.set(key, value);
  if (useLS) lsWrite(key, value);
}

/** Invalidate a single key from both tiers */
export function cacheDelete(key) {
  memCache.delete(key);
  try { localStorage.removeItem(key); } catch {}
}

/** Wipe all entries that start with a given prefix */
export function cacheEvictPrefix(prefix) {
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {}
}
