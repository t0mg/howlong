import type { HLTBResult } from './api/types';

const HLTB_CACHE_KEY = 'howlong_hltb_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  data: HLTBResult | null;
  timestamp: number;
}

type CacheStore = Record<string, CacheEntry>;

function loadCache(): CacheStore {
  try {
    const raw = localStorage.getItem(HLTB_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: CacheStore): void {
  try {
    localStorage.setItem(HLTB_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full — clear old entries
    localStorage.removeItem(HLTB_CACHE_KEY);
  }
}

/**
 * Get a cached HLTB result for a game name.
 * Returns undefined if not in cache or expired.
 */
export function getCachedHLTB(gameName: string): HLTBResult | null | undefined {
  const cache = loadCache();
  const key = gameName.toLowerCase().trim();
  const entry = cache[key];

  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[key];
    saveCache(cache);
    return undefined;
  }

  return entry.data;
}

/**
 * Store an HLTB result (or null for not-found) in the cache.
 */
export function setCachedHLTB(gameName: string, data: HLTBResult | null): void {
  const cache = loadCache();
  cache[gameName.toLowerCase().trim()] = {
    data,
    timestamp: Date.now(),
  };
  saveCache(cache);
}

export function clearCache(): void {
  localStorage.removeItem(HLTB_CACHE_KEY);
}
