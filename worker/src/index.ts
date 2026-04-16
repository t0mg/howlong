/**
 * How Long to Clear — CORS Proxy Worker
 *
 * A Cloudflare Worker that proxies requests to:
 *   - Steam Wishlist API
 *   - Steam App Details (price) API
 *   - HowLongToBeat search (via the howlongtobeat npm package)
 *
 * Deploy with: npx wrangler deploy
 */


const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleWishlist(steamId: string): Promise<Response> {
  const apiUrl = `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${steamId}`;
  console.log(`[Worker] Calling Official API: ${apiUrl}`);

  const res = await fetch(apiUrl);
  if (!res.ok) {
    return jsonResponse({ error: `Steam API error: ${res.status}` }, res.status);
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...CORS_HEADERS,
    },
  });
}

async function handlePricesBatch(url: URL): Promise<Response> {
  const ids = url.searchParams.get('ids') || '';
  const cc = url.searchParams.get('cc') || 'us';
  if (!ids) return jsonResponse({ error: 'Missing ids' }, 400);

  const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${ids}&filters=price_overview&cc=${cc}`;

  console.log(`[Worker] Fetching PriceBatch: ${ids.split(',').length} items (CC: ${cc})`);

  const res = await fetch(steamUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: 86400, // 24h for prices
      cacheKey: `steam-prices-${ids}-${cc}`,
    },
    headers: { 'User-Agent': 'Mozilla/5.0' },
  } as RequestInit);

  if (res.status === 429 || res.status === 403) {
    return jsonResponse({ error: 'Steam rate limited', status: res.status }, res.status);
  }

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Browser cache 1h
      ...CORS_HEADERS,
    },
  });
}

async function handleMetadata(appId: string): Promise<Response> {
  const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,genres,demos,release_date`;

  console.log(`[Worker] Fetching Metadata: ${appId}`);

  // Try API first
  let res = await fetch(steamUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: 604800, // 7 days for metadata
      cacheKey: `steam-meta-v3-${appId}`,
    },
    headers: { 'User-Agent': 'Mozilla/5.0' },
  } as RequestInit);

  // 429/403 or success: false? Try scraping
  let data: any = null;
  if (res.ok) {
    const raw = await res.json() as any;
    if (raw[appId]?.success) {
      data = raw;
    }
  }

  // Fallback: Scrape HTML for title
  if (!data) {
    console.warn(`[Worker] AppDetails failed for ${appId}. Falling back to HTML scraping...`);
    const storeUrl = `https://store.steampowered.com/app/${appId}`;
    const htmlRes = await fetch(storeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        let title = titleMatch[1].trim();
        // Clean title: "Save 50% on Game Name on Steam" -> "Game Name"
        title = title.replace(/ on Steam$/i, '').replace(/^Save \d+% on /i, '');

        const isComingSoon = html.includes('game_area_comingsoon') || html.includes('Ce jeu n\'est pas encore disponible');
        const hasDemo = html.includes('demo_above_purchase') || html.includes('game_area_purchase_demo') || html.includes('Download') && html.includes('Demo');

        data = {
          [appId]: {
            success: true,
            _is_fallback: true,
            data: {
              name: title,
              header_image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
              type: 'game',
              release_date: {
                coming_soon: isComingSoon,
                date: isComingSoon ? 'Coming Soon' : ''
              },
              demos: hasDemo ? [{ appid: 1 }] : undefined
            }
          }
        };
      }
    }
  }

  if (!data) {
    return jsonResponse({ error: 'Failed to fetch metadata' }, res.status || 500);
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400', // Browser cache 24h
      ...CORS_HEADERS,
    },
  });
}

async function handleHltbSearch(url: URL, ctx: ExecutionContext): Promise<Response> {
  const query = url.searchParams.get('q');
  if (!query) {
    return jsonResponse({ error: 'Missing ?q= parameter' }, 400);
  }

  const cacheKey = new Request(`https://hltb-cache.internal/${query}`);
  const cache = caches.default;

  // 1. Check if we already have the FINAL result
  let response = await cache.match(cacheKey);

  if (!response) {
    console.log("[Worker] HLTB Cache Miss: Starting fetch chain...");

    try {
      // 1. Handshake: init session
      console.log(`[Worker] HLTB Init for: ${query}`);
      const timestamp = Date.now();
      const initRes = await fetch(`https://howlongtobeat.com/api/find/init?t=${timestamp}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://howlongtobeat.com/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!initRes.ok) throw new Error(`HLTB Init failed: ${initRes.status}`);
      const { token, hpKey, hpVal } = await initRes.json() as any;

      // 1.5 Safety delay to mimic human behavior
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. Handshake: Search with keys
      console.log(`[Worker] HLTB Search for: ${query} (key: ${hpKey})`);
      const searchRes = await fetch('https://howlongtobeat.com/api/find', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'x-hp-key': hpKey,
          'x-hp-val': hpVal,
          'Origin': 'https://howlongtobeat.com',
          'Referer': 'https://howlongtobeat.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
        body: JSON.stringify({
          searchType: "games",
          searchTerms: query.toLowerCase().split(/\s+/), // Cleaned & lowercased
          searchPage: 1,
          size: 20,
          searchOptions: {
            games: {
              userId: 0,
              platform: "",
              sortCategory: "popular",
              rangeCategory: "main",
              rangeTime: { min: null, max: null },
              gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
              rangeYear: { min: "", max: "" },
              modifier: ""
            },
            users: { sortCategory: "postcount" },
            lists: { sortCategory: "follows" },
            filter: "",
            sort: 0,
            randomizer: 0
          },
          useCache: true,
          [hpKey]: hpVal, // Dynamic security property
        }),
      });

      if (!searchRes.ok) throw new Error(`HLTB Search failed: ${searchRes.status}`);
      const searchData = await searchRes.json() as any;

      const results = (searchData.data || []).map((r: any) => ({
        id: r.game_id?.toString(),
        name: r.game_name,
        imageUrl: r.game_image ? `https://howlongtobeat.com/games/${r.game_image}` : null,
        // HLTB returns seconds, we now pass seconds to the frontend for precise rounding
        gameplayMain: r.comp_main || 0,
        gameplayMainExtra: r.comp_plus || 0,
        gameplayCompletionist: r.comp_100 || 0,
        similarity: 1,
      }));

      response = jsonResponse(results);
      response.headers.set("Cache-Control", "s-maxage=604800");
      response.headers.set("X-Cache-Status", "MISS");

      // 5. Store it for next time
      // Use waitUntil so the user doesn't wait for the cache write
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch (err: unknown) {
      console.error('[Worker] HLTB Error:', err);
      response = jsonResponse({ error: 'HLTB lookup failed' }, 500);
    }

  } else {
    console.log("[Worker] HLTB Cache Hit: Bypassing all fetches.");

    // Optional: Add a header so you can verify the hit in your browser
    response = new Response(response.body, response);
    response.headers.set("X-Cache-Status", "HIT");
  }
  return response;
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /steam/wishlist/:steamId
      const wishlistMatch = path.match(/^\/steam\/wishlist\/([^\/\?]+)/);
      if (wishlistMatch) {
        return await handleWishlist(wishlistMatch[1].trim());
      }

      // GET /steam/prices-batch?ids=1,2,3&cc=us
      if (path === '/steam/prices-batch') {
        return await handlePricesBatch(url);
      }

      // GET /steam/metadata/:appId
      const metaMatch = path.match(/^\/steam\/metadata\/(\d+)$/);
      if (metaMatch) {
        return await handleMetadata(metaMatch[1]);
      }

      // ── HLTB Search ───────────────────────────────────────
      // GET /hltb/search?q=Game+Name
      if (path === '/hltb/search') {
        return await handleHltbSearch(url, ctx);
      }

      // ── Health Check ──────────────────────────────────────
      if (path === '/' || path === '/health') {
        return jsonResponse({ status: 'ok', service: 'howlong-proxy' });
      }

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse({ error: message }, 500);
    }
  },
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
