import { PROXY_BASE } from './config';
import type { GOGResult } from './types';
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
