import type { SteamWishlistResponse, SteamWishlistItem, SteamAppDetailsResponse } from './types';
import { PROXY_BASE } from './config';

/**
 * Fetches the raw list of appids from the official Steam IWishlistService.
 */
export async function fetchSteamWishlist(
  steamId: string
): Promise<SteamWishlistItem[]> {
  const url = `${PROXY_BASE}/steam/wishlist/${encodeURIComponent(steamId)}`;
  const res = await fetch(url);

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
 * Fetches details (name, image, price) for a single Steam app.
 * Implements retry with backoff for rate limits (429/403).
 */
export async function fetchSteamAppDetails(
  appId: string,
  retryCount = 0,
  checkCancelled?: () => boolean,
  onThrottle?: (until: number | null) => void,
  cc = 'us'
): Promise<SteamAppDetailsResponse | null> {
  if (checkCancelled?.()) return null;
  const url = `${PROXY_BASE}/steam/price/${appId}?cc=${cc}`;
  
  try {
    const res = await fetch(url);

    if (res.status === 200) {
      onThrottle?.(null); // Clear throttle state on success
      return await res.json() as SteamAppDetailsResponse;
    }

    if (res.status === 429) {
      const until = Date.now() + 10000;
      console.warn(`[Steam] 429 Too Many Requests for ${appId}. Waiting 10s (Retry ${retryCount})...`);
      onThrottle?.(until);
      
      for (let i = 0; i < 20; i++) { // Check every 500ms
        if (checkCancelled?.()) {
          onThrottle?.(null);
          return null;
        }
        await sleep(500);
      }
      return fetchSteamAppDetails(appId, retryCount + 1, checkCancelled, onThrottle);
    }

    if (res.status === 403) {
      const waitTime = 5 * 60 * 1000;
      const until = Date.now() + waitTime;
      console.warn(`[Steam] 403 Forbidden for ${appId}. Waiting 5m (Retry ${retryCount})...`);
      onThrottle?.(until);

      for (let i = 0; i < 600; i++) { // Check every 500ms (300s total)
        if (checkCancelled?.()) {
          onThrottle?.(null);
          return null;
        }
        await sleep(500);
      }
      return fetchSteamAppDetails(appId, retryCount + 1, checkCancelled, onThrottle);
    }

    console.error(`[Steam] App ${appId} failed with status: ${res.status}`);
    return null;
  } catch (err) {
    if (retryCount < 3) {
      console.warn(`[Steam] Fetch error for ${appId}, retrying in 2s...`, err);
      await sleep(2000);
      return fetchSteamAppDetails(appId, retryCount + 1);
    }
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
