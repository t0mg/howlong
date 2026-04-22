import type { AppState, GameEntry } from './api/types';
import { REGION_MAP } from './api/types';
import { fetchSteamWishlist, fetchSteamPriceBatch, fetchSteamMetadata } from './api/steam';
import { searchHLTB, formatDurationHours } from './api/hltb';
import { getCachedHLTB, setCachedHLTB, getCachedSteam, setCachedSteam, getCachedGOG, setCachedGOG } from './cache';
import { renderLoading } from './ui/render';
import { searchGOGBatch } from './api/gog';
import { t } from './ui/i18n';

// ── Fetching Pipeline ────────────────────────────────────────
// Orchestrates the multi-step data fetch:
//   1. Steam wishlist AppIDs
//   2. Steam prices (batch)
//   3. Steam metadata (cached at edge)
//   4. HLTB enrichment
//   5. GOG enrichment

export async function fetchWishlistPipeline(state: AppState): Promise<GameEntry[]> {
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;

  // ── 1) Fetch wishlist AppIDs ───────────────────────────────
  state.loadingMessage = t('loading_fetching_appid');
  renderLoading(state);

  const wishlistItems = await fetchSteamWishlist(state.steamId);
  if (!wishlistItems || wishlistItems.length === 0) {
    throw new Error(t('error_wishlist_private'));
  }

  state.loadingTotal = wishlistItems.length;
  state.loadingMessage = t('loading_fetching_details_count', { count: wishlistItems.length });
  renderLoading(state);

  // ── 2) Fetch Prices in Batches ─────────────────────────────
  state.loadingTotal = wishlistItems.length;
  state.loadingProgress = 0;
  state.loadingMessage = t('loading_fetching_prices');
  renderLoading(state);

  const priceMap: Record<string, any> = {};
  const PRICE_BATCH_SIZE = 100;

  for (let i = 0; i < wishlistItems.length; i += PRICE_BATCH_SIZE) {
    if (state.isCancelled) break;
    const batchIds = wishlistItems.slice(i, i + PRICE_BATCH_SIZE).map(item => item.appid.toString());
    const batchResults = await fetchSteamPriceBatch(batchIds, region.cc);
    if (batchResults) {
      Object.assign(priceMap, batchResults);
    }
    state.loadingProgress = Math.min(i + PRICE_BATCH_SIZE, wishlistItems.length);
    renderLoading(state);
  }

  // ── 3) Fetch Metadata individually ─────────────────────────
  state.loadingMessage = t('loading_fetching_details_count', { count: wishlistItems.length });
  renderLoading(state);

  const games: GameEntry[] = [];
  const CONCURRENCY = 10;
  let completedCount = 0;

  const fetchWithLimit = async (items: any[]) => {
    const activePromises: Promise<void>[] = [];

    for (const item of items) {
      if (activePromises.length >= CONCURRENCY) {
        await Promise.race(activePromises);
      }

      if (state.isCancelled) break;

      const promise = (async () => {
        const appIdStr = item.appid.toString();
        const cached = await getCachedSteam(appIdStr);
        const priceData = priceMap[appIdStr]?.success ? priceMap[appIdStr].data?.price_overview : null;
        const apiSuccess = priceMap[appIdStr]?.success;

        let isMetadataStale = !cached ||
          cached.isComingSoon === undefined ||
          cached.hasDemo === undefined;

        if (cached && !isMetadataStale) {
          if (priceData && (cached.isComingSoon || cached.isUnavailable)) {
            isMetadataStale = true;
          }
        }

        if (cached && !isMetadataStale) {
          // --- CACHE HIT ---
          const game: GameEntry = {
            appId: appIdStr,
            name: cached.name,
            capsuleUrl: cached.capsuleUrl,
            releaseDate: '',
            reviewDesc: '',
            reviewPercent: 0,
            genres: cached.genres || [],
            isComingSoon: !!cached.isComingSoon,
            isDemo: !!cached.isDemo,
            hasDemo: !!cached.hasDemo,
            isFree: cached.isFree ?? (priceData ? false : (cached.priceFinal === null && cached.priceInitial === null && !cached.isComingSoon)),
            isUnavailable: !cached.isFree && !priceData && !cached.isComingSoon,
            priority: item.priority || 999,
            priceCurrency: priceData?.currency || null,
            priceInitial: priceData ? priceData.initial / 100 : cached.priceInitial,
            priceFinal: priceData ? priceData.final / 100 : cached.priceFinal,
            discountPercent: priceData ? priceData.discount_percent : cached.discountPercent,
            hltbId: null,
            hltbMain: null,
            hltbMainExtra: null,
            hltbCompletionist: null,
            gogUrl: null,
            gogPriceCurrency: null,
            gogPriceInitial: null,
            gogPriceFinal: null,
            gogDiscountPercent: 0,
            hltbStatus: 'pending',
            gogStatus: 'pending',
            priceStatus: priceData ? 'found' : (cached.isFree ? 'free' : (!priceData && !cached.isComingSoon ? 'unavailable' : 'stale')),
            isStale: !priceData && cached.priceFinal !== null && !cached.isFree,
            dateAdded: item.date_added,
          };

          games.push(game);

          if (apiSuccess) {
            await setCachedSteam(appIdStr, {
              name: cached.name,
              capsuleUrl: cached.capsuleUrl,
              priceInitial: game.priceInitial,
              priceFinal: game.priceFinal,
              discountPercent: game.discountPercent,
              genres: cached.genres || [],
              isFree: game.isFree,
              isComingSoon: game.isComingSoon,
              isUnavailable: game.isUnavailable,
              isDemo: game.isDemo,
              hasDemo: game.hasDemo,
            });
          }
        } else {
          // --- API FETCH (MISS OR STALE) ---
          const metaRes = await fetchSteamMetadata(appIdStr);

          if (metaRes && metaRes[appIdStr]?.success) {
            const data = metaRes[appIdStr].data!;
            const discountPercent = priceData?.discount_percent || 0;

            const game: GameEntry = {
              appId: appIdStr,
              name: data.name,
              capsuleUrl: data.header_image,
              releaseDate: '',
              reviewDesc: '',
              reviewPercent: 0,
              genres: data.genres?.map(g => g.description) || [],
              isComingSoon: !!data.release_date?.coming_soon,
              isDemo: data.type === 'demo',
              hasDemo: !!(data.demos && data.demos.length > 0),
              isFree: !!(data.is_free || data.type === 'free' || data.type === 'demo'),
              isUnavailable: !(data.is_free || data.type === 'free' || data.type === 'demo') && !priceData && !data.release_date?.coming_soon,
              priority: item.priority || 999,
              priceCurrency: priceData?.currency || null,
              priceInitial: priceData ? priceData.initial / 100 : null,
              priceFinal: priceData ? priceData.final / 100 : null,
              discountPercent,
              hltbId: null,
              hltbMain: null,
              hltbMainExtra: null,
              hltbCompletionist: null,
              gogUrl: null,
              gogPriceCurrency: null,
              gogPriceInitial: null,
              gogPriceFinal: null,
              gogDiscountPercent: 0,
              hltbStatus: 'pending',
              gogStatus: 'pending',
              priceStatus: priceData ? 'found' : ((data.is_free || data.type === 'free' || data.type === 'demo') ? 'free' : (!priceData && !data.release_date?.coming_soon ? 'unavailable' : 'not_found')),
              dateAdded: item.date_added,
            };

            const isFallback = !!metaRes[appIdStr]._is_fallback;
            if (!isFallback) {
              await setCachedSteam(appIdStr, {
                name: game.name,
                capsuleUrl: game.capsuleUrl,
                priceInitial: game.priceInitial,
                priceFinal: game.priceFinal,
                discountPercent: game.discountPercent,
                genres: game.genres,
                isFree: game.isFree,
                isComingSoon: game.isComingSoon,
                isUnavailable: game.isUnavailable,
                isDemo: game.isDemo,
                hasDemo: game.hasDemo,
              });
            }

            games.push(game);
          }
        }

        completedCount++;
        if (completedCount % 5 === 0 || completedCount === items.length) {
          state.loadingMessage = t('loading_fetching_details');
          state.loadingProgress = completedCount;
          renderLoading(state);
        }
      })().finally(() => {
        activePromises.splice(activePromises.indexOf(promise), 1);
      });

      activePromises.push(promise);
    }

    await Promise.all(activePromises);
  };

  await fetchWithLimit(wishlistItems);

  if (games.length === 0) {
    throw new Error(t('error_no_details'));
  }

  // ── 4) Enrich with HLTB data ──────────────────────────────

  state.loadingProgress = 0;
  state.loadingTotal = games.length;
  state.loadingMessage = t('loading_enriching');
  state.hltbErrorCount = 0;

  // Reset cancellation for HLTB phase
  state.isCancelled = false;
  state.onStop = () => {
    state.isCancelled = true;
    state.loadingMessage = t('loading_stopping');
    renderLoading(state);
  };

  renderLoading(state);

  // First pass: Resolve from local cache concurrently
  const gamesToFetch: GameEntry[] = [];
  await Promise.all(games.map(async (game) => {
    const cached = await getCachedHLTB(game.name);
    if (cached !== undefined) {
      if (cached) {
        game.hltbId = cached.id;
        game.hltbMain = cached.gameplayMain ? formatDurationHours(cached.gameplayMain) : null;
        game.hltbMainExtra = cached.gameplayMainExtra ? formatDurationHours(cached.gameplayMainExtra) : null;
        game.hltbCompletionist = cached.gameplayCompletionist ? formatDurationHours(cached.gameplayCompletionist) : null;
        game.hltbStatus = 'found';
      } else {
        game.hltbStatus = 'not_found';
      }
    } else {
      gamesToFetch.push(game);
    }
  }));

  state.loadingProgress = games.length - gamesToFetch.length;
  renderLoading(state);

  // Second pass: Fetch missing ones from API
  const HLTB_BATCH_SIZE = 10;
  let hltbHits = 0;
  let hltbMisses = 0;

  for (let i = 0; i < gamesToFetch.length; i += HLTB_BATCH_SIZE) {
    if (state.isCancelled) break;

    const batch = gamesToFetch.slice(i, i + HLTB_BATCH_SIZE);
    await Promise.all(
      batch.map(async (game) => {
        const { result, errorStatus, cacheStatus } = await searchHLTB(game.name, () => state.isCancelled);
        if (state.isCancelled) return;

        if (cacheStatus === 'HIT') hltbHits++;
        else if (cacheStatus === 'MISS') hltbMisses++;

        if (errorStatus && errorStatus >= 500) {
          state.hltbErrorCount++;
        } else {
          await setCachedHLTB(game.name, result);
        }

        if (result) {
          game.hltbId = result.id;
          game.hltbMain = result.gameplayMain ? formatDurationHours(result.gameplayMain) : null;
          game.hltbMainExtra = result.gameplayMainExtra ? formatDurationHours(result.gameplayMainExtra) : null;
          game.hltbCompletionist = result.gameplayCompletionist ? formatDurationHours(result.gameplayCompletionist) : null;
          game.hltbStatus = 'found';
        } else {
          game.hltbStatus = 'not_found';
        }
      })
    );

    state.loadingProgress += batch.length;
    renderLoading(state);

    if (!state.isCancelled && i + HLTB_BATCH_SIZE < gamesToFetch.length) {
      await sleep(300);
    }
  }

  if (gamesToFetch.length > 0) {
    console.log(`[HLTB Proxy Cache] Stats: HIT=${hltbHits}, MISS=${hltbMisses}`);
  }

  // ── 5) Enrich with GOG data ───────────────────────────────

  const gamesToFetchGog: GameEntry[] = [];
  await Promise.all(games.map(async (game) => {
    const cached = await getCachedGOG(game.name);
    if (cached !== undefined) {
      if (cached && cached.found) {
        game.gogUrl = cached.storeLink || null;
        game.gogStatus = 'found';
        
        if (cached.price) {
           game.gogPriceFinal = cached.price.amount;
           game.gogPriceInitial = cached.price.baseAmount;
           game.gogPriceCurrency = cached.price.currency;
           game.gogDiscountPercent = cached.price.discount;
        }
        gamesToFetchGog.push(game);
      } else {
        game.gogStatus = 'not_found';
      }
    } else {
      gamesToFetchGog.push(game);
    }
  }));

  if (gamesToFetchGog.length > 0) {
    state.loadingMessage = t('loading_enriching_gog');
    state.loadingProgress = games.length - gamesToFetchGog.length;
    renderLoading(state);

    const GOG_BATCH_SIZE = 50;
    for (let i = 0; i < gamesToFetchGog.length; i += GOG_BATCH_SIZE) {
      if (state.isCancelled) break;

      const batch = gamesToFetchGog.slice(i, i + GOG_BATCH_SIZE);
      const batchNames = batch.map(g => g.name);

      const { results, errorStatus } = await searchGOGBatch(batchNames, region.cc, region.currency);
      if (state.isCancelled) return games;

      if (!errorStatus && results) {
        const resultMap = new Map(results.map(r => [r.name, r]));

        await Promise.all(batch.map(async (game) => {
          const result = resultMap.get(game.name);
          if (result && !result.error) {
             const cachedData = {
                found: result.found,
                storeLink: result.storeLink,
                price: result.price
             };
             await setCachedGOG(game.name, cachedData);

             if (result.found) {
               game.gogUrl = result.storeLink || null;
               game.gogStatus = 'found';
               if (result.price) {
                  game.gogPriceFinal = result.price.amount;
                  game.gogPriceInitial = result.price.baseAmount;
                  game.gogPriceCurrency = result.price.currency;
                  game.gogDiscountPercent = result.price.discount;
               } else {
                  game.gogPriceFinal = null;
                  game.gogPriceInitial = null;
                  game.gogPriceCurrency = null;
                  game.gogDiscountPercent = 0;
               }
             } else {
               game.gogStatus = 'not_found';
             }
          }
        }));
      }

      state.loadingProgress += batch.length;
      renderLoading(state);

      if (!state.isCancelled && i + GOG_BATCH_SIZE < gamesToFetchGog.length) {
        await sleep(100);
      }
    }
  }

  return games;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
