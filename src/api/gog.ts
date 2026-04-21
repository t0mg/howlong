import { PROXY_BASE } from './config';
import type { GOGResult } from './types';

/**
 * Searches GOG for a game by name via the proxy.
 * Returns the best match or null if nothing found.
 */
export async function searchGOG(
  gameName: string,
  cc: string,
  currency: string,
  checkCancelled?: () => boolean
): Promise<{ result: GOGResult | null; errorStatus?: number; cacheStatus?: string | null }> {
  if (checkCancelled?.()) return { result: null };
  try {
    const url = `${PROXY_BASE}/gog/search?q=${encodeURIComponent(gameName)}&cc=${cc}&currency=${currency}&t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-cache' });
    const cacheStatus = res.headers.get('X-Cache-Status');

    if (!res.ok) {
      console.warn(`[GOG] Search failed for "${gameName}": Status ${res.status}`);
      return { result: null, errorStatus: res.status, cacheStatus };
    }

    const data: GOGResult = await res.json();
    return { result: data, cacheStatus };
  } catch (err) {
    console.error(`[GOG] Error fetching "${gameName}":`, err);
    return { result: null, errorStatus: 500 };
  }
}

/**
 * Searches GOG for multiple games in a batch.
 */
export async function searchGOGBatch(
  gameNames: string[],
  cc: string,
  currency: string
): Promise<{ results: ({ name: string; error?: boolean } & GOGResult)[] | null; errorStatus?: number }> {
  if (!gameNames.length) return { results: [] };
  try {
    const url = `${PROXY_BASE}/gog/search-batch`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: gameNames, cc, currency })
    });

    if (!res.ok) {
      console.warn(`[GOG] Batch search failed: Status ${res.status}`);
      return { results: null, errorStatus: res.status };
    }

    const data = await res.json();
    return { results: data };
  } catch (err) {
    console.error(`[GOG] Error fetching batch:`, err);
    return { results: null, errorStatus: 500 };
  }
}
