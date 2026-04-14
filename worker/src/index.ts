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

export default {
  async fetch(request: Request): Promise<Response> {
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
        const steamId = wishlistMatch[1].trim();
        const apiUrl = `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${steamId}`;
        console.log(`[Worker] Calling Official API: ${apiUrl}`);

        const res = await fetch(apiUrl);
        if (!res.ok) {
          return jsonResponse({ error: `Steam API error: ${res.status}` }, res.status);
        }

        const data = await res.json();
        return jsonResponse(data);
      }

      // GET /steam/price/:appId?cc=us
      const priceMatch = path.match(/^\/steam\/price\/(\d+)$/);
      if (priceMatch) {
        const appId = priceMatch[1];
        const cc = url.searchParams.get('cc') || 'us';
        const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=price_overview,basic&cc=${cc}`;
        
        console.log(`[Worker] Fetching AppDetails: ${appId} (CC: ${cc})`);

        // We use the cf: { cacheEverything } option to store the result on Cloudflare's edge
        const res = await fetch(steamUrl, {
          cf: {
            cacheEverything: true,
            cacheTtl: 86400, // Cache for 24 hours
            cacheKey: `steam-appdetails-${appId}-${cc}`,
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        // Forward status codes (especially 429/403) so the client can handle backoff
        if (res.status === 429 || res.status === 403) {
          return jsonResponse({ error: 'Steam rate limited', status: res.status }, res.status);
        }

        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400', // Browser-side cache too
            ...CORS_HEADERS,
          },
        });
      }

      // ── HLTB Search ───────────────────────────────────────
      // GET /hltb/search?q=Game+Name
      if (path === '/hltb/search') {
        const query = url.searchParams.get('q');
        if (!query) {
          return jsonResponse({ error: 'Missing ?q= parameter' }, 400);
        }


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
          await new Promise(resolve => setTimeout(resolve, 250));

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
            // HLTB returns seconds, we want hours
            gameplayMain: r.comp_main ? Math.round(r.comp_main / 3600) : 0,
            gameplayMainExtra: r.comp_plus ? Math.round(r.comp_plus / 3600) : 0,
            gameplayCompletionist: r.comp_100 ? Math.round(r.comp_100 / 3600) : 0,
            similarity: 1,
          }));

          return jsonResponse(results);
        } catch (err: unknown) {
          console.error('[Worker] HLTB Error:', err);
          return jsonResponse({ error: 'HLTB lookup failed' }, 500);
        }
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
