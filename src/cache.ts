import { get, set, clear as idbClear } from 'idb-keyval';
import type { HLTBResult, CachedSteamData } from './api/types';

export async function getCachedHLTB(gameName: string): Promise<HLTBResult | null | undefined> {
  const key = 'hltb_' + gameName.toLowerCase().trim();
  return await get<HLTBResult | null>(key);
}

export async function setCachedHLTB(gameName: string, data: HLTBResult | null): Promise<void> {
  const key = 'hltb_' + gameName.toLowerCase().trim();
  await set(key, data);
}

export async function getCachedSteam(appId: string): Promise<CachedSteamData | undefined> {
  const key = 'steam_' + appId;
  return await get<CachedSteamData>(key);
}

export async function setCachedSteam(appId: string, data: CachedSteamData): Promise<void> {
  const key = 'steam_' + appId;
  await set(key, data);
}

export async function clearCache(): Promise<void> {
  await idbClear();
}
