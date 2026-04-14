const HLTB_CACHE_KEY = 'howlong_hltb_cache';
const STEAM_CACHE_KEY = 'howlong_steam_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadStore(key: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(key: string, data: Record<string, any>): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    localStorage.removeItem(key);
  }
}

export function getCachedHLTB(gameName: string): HLTBResult | null | undefined {
  const cache = loadStore(HLTB_CACHE_KEY);
  const key = gameName.toLowerCase().trim();
  const entry = cache[key];

  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[key];
    saveStore(HLTB_CACHE_KEY, cache);
    return undefined;
  }

  return entry.data;
}

export function setCachedHLTB(gameName: string, data: HLTBResult | null): void {
  const cache = loadStore(HLTB_CACHE_KEY);
  cache[gameName.toLowerCase().trim()] = {
    data,
    timestamp: Date.now(),
  };
  saveStore(HLTB_CACHE_KEY, cache);
}

import type { HLTBResult, CachedSteamData, SteamCacheEntry } from './api/types';

/**
 * Steam Cache
 */
export function getCachedSteam(appId: string): CachedSteamData | undefined {
  const cache = loadStore(STEAM_CACHE_KEY);
  const entry = cache[appId] as SteamCacheEntry | undefined;

  if (!entry) return undefined;
  // Metadata is very stable, 7 days is fine
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[appId];
    saveStore(STEAM_CACHE_KEY, cache);
    return undefined;
  }

  return entry.data;
}

export function setCachedSteam(appId: string, data: CachedSteamData): void {
  const cache = loadStore(STEAM_CACHE_KEY);
  cache[appId] = {
    data,
    timestamp: Date.now(),
  };
  saveStore(STEAM_CACHE_KEY, cache);
}

export function clearCache(): void {
  localStorage.removeItem(HLTB_CACHE_KEY);
  localStorage.removeItem(STEAM_CACHE_KEY);
}
