import type { HLTBResult } from './types';
import { PROXY_BASE } from './config';

/**
 * Searches HowLongToBeat for a game by name via the proxy.
 * Returns the best match or null if nothing found.
 */
/**
 * Formats a duration in seconds to hours according to the precision rules:
 * - Below 2 hours: round to nearest 0.25 (quarter hour)
 * - Below 10 hours: round to nearest 0.5 (half hour)
 * - 10 hours and above: round to nearest 1 (full hour)
 */
export function formatDurationHours(seconds: number | null | undefined): number {
  if (!seconds) return 0;

  const hours = seconds / 3600;
  if (hours === 0) return 0;

  if (hours < 2) {
    // Round to nearest 0.25
    return Math.round(hours * 4) / 4;
  } else if (hours < 10) {
    // Round to nearest 0.5
    return Math.round(hours * 2) / 2;
  } else {
    // Round to nearest 1
    return Math.round(hours);
  }
}

export async function searchHLTB(
  gameName: string,
  checkCancelled?: () => boolean
): Promise<{ result: HLTBResult | null; errorStatus?: number; cacheStatus?: string | null }> {
  if (checkCancelled?.()) return { result: null };
  try {
    const url = `${PROXY_BASE}/hltb/search?q=${encodeURIComponent(gameName)}&t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-cache' });
    const cacheStatus = res.headers.get('X-Cache-Status');

    if (!res.ok) {
      console.warn(`[HLTB] Search failed for "${gameName}": Status ${res.status}`);
      return { result: null, errorStatus: res.status, cacheStatus };
    }

    const data: HLTBResult[] = await res.json();
    if (!data || data.length === 0) return { result: null, cacheStatus };

    return { result: data[0], cacheStatus };
  } catch (err) {
    console.error(`[HLTB] Error fetching "${gameName}":`, err);
    return { result: null, errorStatus: 500 };
  }
}
