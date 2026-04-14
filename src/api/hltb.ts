import type { HLTBResult } from './types';
import { PROXY_BASE } from './config';

/**
 * Searches HowLongToBeat for a game by name via the proxy.
 * Returns the best match or null if nothing found.
 */
export async function searchHLTB(
  gameName: string,
  checkCancelled?: () => boolean
): Promise<HLTBResult | null> {
  if (checkCancelled?.()) return null;
  try {
    const url = `${PROXY_BASE}/hltb/search?q=${encodeURIComponent(gameName)}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      console.warn(`[HLTB] Search failed for "${gameName}": Status ${res.status}`);
      return null;
    }

    const data: HLTBResult[] = await res.json();
    if (!data || data.length === 0) return null;

    return data[0];
  } catch (err) {
    console.error(`[HLTB] Error fetching "${gameName}":`, err);
    return null;
  }
}
