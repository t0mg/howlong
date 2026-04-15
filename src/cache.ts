import { get, set, clear as idbClear, createStore, del } from 'idb-keyval';
import type { HLTBResult, CachedSteamData } from './api/types';

// Use separate databases for each purpose to avoid IndexedDB versioning issues with idb-keyval's simple API.
const hltbStore = createStore('howlong-cache-hltb', 'keyval');
const steamStore = createStore('howlong-cache-steam', 'keyval');
const settingsStore = createStore('howlong-settings', 'keyval');

export async function getCachedHLTB(gameName: string): Promise<HLTBResult | null | undefined> {
  const key = 'hltb_' + gameName.toLowerCase().trim();
  return await get<HLTBResult | null>(key, hltbStore);
}

export async function setCachedHLTB(gameName: string, data: HLTBResult | null): Promise<void> {
  const key = 'hltb_' + gameName.toLowerCase().trim();
  await set(key, data, hltbStore);
}

export async function getCachedSteam(appId: string): Promise<CachedSteamData | undefined> {
  const key = 'steam_' + appId;
  return await get<CachedSteamData>(key, steamStore);
}

export async function setCachedSteam(appId: string, data: CachedSteamData): Promise<void> {
  const key = 'steam_' + appId;
  await set(key, data, steamStore);
}

/**
 * App-wide settings storage (Region, Last Steam ID, etc.)
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  return await get<T>(key, settingsStore);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await set(key, value, settingsStore);
}

export async function delSetting(key: string): Promise<void> {
  await del(key, settingsStore);
}

/**
 * Clears only the HLTB cache
 */
export async function clearHLTBCache(): Promise<void> {
  await idbClear(hltbStore);
}

/**
 * Clears only the Steam metadata cache
 */
export async function clearSteamCache(): Promise<void> {
  await idbClear(steamStore);
}

/**
 * Wipes all caches and settings
 */
export async function clearCache(): Promise<void> {
  // Clear all stores
  await Promise.all([
    idbClear(hltbStore),
    idbClear(steamStore),
    idbClear(settingsStore),
  ]);
}
