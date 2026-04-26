import type { SteamWishlistResponse, SteamWishlistItem, SteamAppDetailsResponse } from './types';
import { PROXY_BASE } from './config';

/**
 * Fetches the raw list of appids from the official Steam IWishlistService.
 */
export async function fetchSteamWishlist(
  steamId: string
): Promise<SteamWishlistItem[]> {
  const url = `${PROXY_BASE}/steam/wishlist/${encodeURIComponent(steamId)}?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-cache' });

  if (!res.ok) {
    if (res.status === 404 || res.status === 500) {
      throw new Error(
        'Could not fetch wishlist. Make sure your Steam profile and wishlist are set to Public, and the Steam64 ID is correct.'
      );
    }
    throw new Error(`Steam API error: ${res.status}`);
  }

  const data: SteamWishlistResponse = await res.json();
  if (data.response && data.response.items) {
    return data.response.items;
  }

  return [];
}

/**
 * Fetches prices for a batch of AppIDs in one call.
 */
export async function fetchSteamPriceBatch(
  appIds: string[],
  cc = 'us'
): Promise<SteamAppDetailsResponse | null> {
  if (appIds.length === 0) return null;
  const ids = appIds.join(',');
  const url = `${PROXY_BASE}/steam/prices-batch?ids=${ids}&cc=${cc}&t=${Date.now()}`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.status === 200) return await res.json() as SteamAppDetailsResponse;

      if (res.status === 429 || res.status === 403) {
        console.warn(`[Steam] Batch price fetch rate limited (${res.status}). Attempt ${attempts + 1}/${maxAttempts}`);
      } else if (res.status >= 500) {
        console.warn(`[Steam] Batch price fetch server error (${res.status}). Attempt ${attempts + 1}/${maxAttempts}`);
      } else {
        return null; // Don't retry on other errors
      }
    } catch (err) {
      console.error(`[Steam] Batch price fetch failed (attempt ${attempts + 1}/${maxAttempts}):`, err);
    }

    attempts++;
    if (attempts < maxAttempts) {
      const delay = Math.pow(2, attempts) * 500; // 1s, 2s, 4s...
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return null;
}

/**
 * Fetches basic metadata (name, image) for a single app.
 * Worker handles caching and scraping fallback.
 */
export async function fetchSteamMetadata(
  appId: string
): Promise<SteamAppDetailsResponse | null> {
  const url = `${PROXY_BASE}/steam/metadata/${appId}?t=${Date.now()}`;

  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.status === 200) return await res.json() as SteamAppDetailsResponse;
    return null;
  } catch (err) {
    console.error(`[Steam] Metadata fetch failed for ${appId}:`, err);
    return null;
  }
}

/**
 * Fetches review summary for a single app.
 */
export async function fetchSteamReviews(appId: string, lang = 'all') {
  lang = "all"; // For score consistency it's actually better to get all languages
  const url = `${PROXY_BASE}/steam/reviews/${appId}?lang=${lang}`;

  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.status === 200) return await res.json();
    return null;
  } catch (err) {
    console.error(`[Steam] Reviews fetch failed for ${appId}:`, err);
    return null;
  }
}

