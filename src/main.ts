import './style.css';
import type { AppState, GameEntry, SortField, SortState } from './api/types';
import { REGION_MAP } from './api/types';
import { fetchSteamWishlist, fetchSteamPriceBatch, fetchSteamMetadata } from './api/steam';
import { searchHLTB, formatDurationHours } from './api/hltb';
import { getCachedHLTB, setCachedHLTB, getCachedSteam, setCachedSteam, getSetting, setSetting, clearHLTBCache, clearSteamCache } from './cache';
import { renderLanding, renderLoading, renderError, renderDashboard, renderStatsModal } from './ui/render';
import { t } from './ui/i18n';

// ── App State ────────────────────────────────────────────────

const state: AppState = {
  steamId: '',
  games: [],
  sort: { field: 'hltbMain', direction: 'asc' },
  filterCategory: null,
  loading: false,

  loadingMessage: '',
  loadingProgress: 0,
  loadingTotal: 0,
  error: null,
  isCancelled: false,
  isThrottled: false,
  throttledUntil: null,
  regionId: 'us',
  hltbErrorCount: 0,
};

// ── Boot ─────────────────────────────────────────────────────

async function init() {
  // Load settings from IDB
  state.regionId = (await getSetting<string>('regionId')) || 'us';
  const lastSteamId = (await getSetting<string>('lastSteamId')) || '';

  // Restore last sort and filter
  const lastSort = await getSetting<SortState>('lastSort');
  if (lastSort) state.sort = lastSort;

  const lastFilter = await getSetting<string | null>('lastFilter');
  if (lastFilter !== undefined) state.filterCategory = lastFilter;

  if (lastSteamId) {
    handleFetchWishlist(lastSteamId);
  } else {
    renderLanding(handleFetchWishlist, handleSettings, lastSteamId);
  }
}

// ── Handlers ─────────────────────────────────────────────────

async function handleFetchWishlist(steamId: string) {
  state.steamId = steamId;
  state.loadingTotal = 0;
  state.isCancelled = false;
  state.isThrottled = false;
  state.throttledUntil = null;
  // region mapping is used from state during individual fetches
  state.onStop = () => {
    state.isCancelled = true;
    state.loadingMessage = t('loading_stopping');
    renderLoading(state);
  };

  await setSetting('lastSteamId', steamId);
  renderLoading(state);

  try {
    // 1) Fetch wishlist AppIDs
    state.loadingMessage = t('loading_fetching_appid');
    renderLoading(state);

    const wishlistItems = await fetchSteamWishlist(steamId);
    if (!wishlistItems || wishlistItems.length === 0) {
      throw new Error(t('error_wishlist_private'));
    }

    state.loadingTotal = wishlistItems.length;
    state.loadingMessage = t('loading_fetching_details_count', { count: wishlistItems.length });
    renderLoading(state);

    // 2) Fetch Prices in Batches (Very efficient, avoids rate limits)
    state.loadingTotal = wishlistItems.length;
    state.loadingProgress = 0;
    state.loadingMessage = t('loading_fetching_prices');
    renderLoading(state);

    const region = REGION_MAP[state.regionId] || REGION_MAP.us;
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

    // 3) Fetch Metadata individually (Cached at edge + Fallback scraping)
    state.loadingMessage = t('loading_fetching_details_count', { count: wishlistItems.length });
    renderLoading(state);

    const games: GameEntry[] = [];
    const CONCURRENCY = 10; // Can be higher now since metadata is cached at edge
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

          // Metadata is stale if:
          // 1. Not in cache
          // 2. Missing migration fields (isComingSoon, hasDemo)
          // 3. Status change: we have a live price now, but cache says it was Coming Soon or Unavailable
          let isMetadataStale = !cached ||
            cached.isComingSoon === undefined ||
            cached.hasDemo === undefined;

          if (cached && !isMetadataStale) {
            // Check for status change launch (Going from Coming Soon/Unavailable -> Having a real Price)
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
              hltbStatus: 'pending',
              priceStatus: priceData ? 'found' : (cached.isFree ? 'free' : (!priceData && !cached.isComingSoon ? 'unavailable' : 'stale')),
              isStale: !priceData && cached.priceFinal !== null && !cached.isFree,
              dateAdded: item.date_added,
            };

            games.push(game);

            // Update only prices/availability in cache if they changed, keep metadata persistent
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
                hltbStatus: 'pending',
                priceStatus: priceData ? 'found' : ((data.is_free || data.type === 'free' || data.type === 'demo') ? 'free' : (!priceData && !data.release_date?.coming_soon ? 'unavailable' : 'not_found')),
                dateAdded: item.date_added,
              };

              // Local cache for future sessions - ONLY if it was official data (not fallback)
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

    state.games = games;
    state.loadingProgress = 0;
    state.loadingTotal = games.length;
    state.loadingMessage = t('loading_enriching');
    state.hltbErrorCount = 0;

    // Keep skip/onStop for HLTB phase - we always want to enrich whatever we found
    // and allowing users to skip if it hangs
    state.isCancelled = false;
    state.onStop = () => {
      state.isCancelled = true;
      state.loadingMessage = t('loading_stopping');
      renderLoading(state);
    };

    renderLoading(state);

    // 3) Enrich with HLTB data

    // First pass: Resolve from local cache concurrently and instantly
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

    // Second pass: Fetch missing ones from API with batching/delay to be gentle
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
            // Don't cache 500s so we can retry next time
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

    // 4) Done — show dashboard
    state.loading = false;
    state.onStop = undefined;

    renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights);

  } catch (err: unknown) {
    state.loading = false;
    const message = err instanceof Error ? err.message : t('error_unexpected');
    state.error = message;
    renderError(message, () => renderLanding(handleFetchWishlist, handleSettings));
  }
}

async function handleSettings() {
  const { renderSettingsModal } = await import('./ui/render');

  let isDirty = false;

  renderSettingsModal(
    async () => {
      await clearHLTBCache();
      isDirty = true;
    },
    async () => {
      await clearSteamCache();
      isDirty = true;
    },
    () => handleClearAppCache(),
    async (regionId) => {
      state.regionId = regionId;
      await setSetting('regionId', regionId);
      isDirty = true;
    },
    () => {
      if (isDirty) {
        window.location.reload();
      }
    },
    state.regionId
  );
}

async function handleClearAppCache() {
  console.log('Clearing app cache...');
  // Clear Databases
  const { clearCache } = await import('./cache');
  await clearCache();

  console.log('Clearing service worker...');
  // Clear Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }

  console.log('Clearing cache storage...');
  // Clear Cache Storage
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    await caches.delete(name);
  }

  console.log('Reloading...');
  // Force reload
  window.location.reload();
}

function handleSort(field: SortField) {
  if (state.sort.field === field) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    if (field === 'name' || field === 'priority') {
      state.sort.direction = 'asc';
    } else {
      state.sort.direction = 'desc';
    }
  }
  setSetting('lastSort', state.sort);
  renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights);
}

function handleFilter(category: string | null) {
  state.filterCategory = category;
  setSetting('lastFilter', category);
  renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights);
}


function handleReset() {
  state.steamId = '';
  state.games = [];
  state.error = null;
  renderLanding(handleFetchWishlist, handleSettings);
}

function handleInsights() {
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;
  renderStatsModal(state.games, region.currency, () => {
    // Optionally refresh dashboard here if needed, but not necessary here
  });
}


function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Register Service Worker ──────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(
      import.meta.env.BASE_URL + 'sw.js'
    ).catch(() => {
      // SW registration failed — app works fine without it
    });
  });
}

// ── Start ────────────────────────────────────────────────────

init();
