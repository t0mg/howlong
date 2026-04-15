import './style.css';
import type { AppState, GameEntry, SortField } from './api/types';
import { REGION_MAP } from './api/types';
import { fetchSteamWishlist, fetchSteamPriceBatch, fetchSteamMetadata } from './api/steam';
import { searchHLTB, formatDurationHours } from './api/hltb';
import { getCachedHLTB, setCachedHLTB, getCachedSteam, setCachedSteam, getSetting, setSetting, clearHLTBCache, clearSteamCache } from './cache';
import { renderLanding, renderLoading, renderError, renderDashboard } from './ui/render';

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
};

// ── Boot ─────────────────────────────────────────────────────

async function init() {
  // Load settings from IDB
  state.regionId = (await getSetting<string>('regionId')) || 'us';
  const lastSteamId = (await getSetting<string>('lastSteamId')) || '';

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
    state.loadingMessage = 'Stopping and preparing results...';
    renderLoading(state);
  };

  await setSetting('lastSteamId', steamId);
  renderLoading(state);

  try {
    // 1) Fetch wishlist AppIDs
    state.loadingMessage = 'Fetching wishlist AppID list...';
    renderLoading(state);

    const wishlistItems = await fetchSteamWishlist(steamId);
    if (!wishlistItems || wishlistItems.length === 0) {
      throw new Error('Wishlist is empty or private.');
    }

    state.loadingTotal = wishlistItems.length;
    state.loadingMessage = `Fetching details for ${wishlistItems.length} games...`;
    renderLoading(state);

    // 2) Fetch Prices in Batches (Very efficient, avoids rate limits)
    state.loadingMessage = 'Fetching game prices...';
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
    }

    // 3) Fetch Metadata individually (Cached at edge + Fallback scraping)
    state.loadingMessage = `Fetching game details for ${wishlistItems.length} games...`;
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

          // Try to get from local cache first
          const cached = await getCachedSteam(appIdStr);

          if (cached) {
            const priceData = priceMap[appIdStr]?.success ? priceMap[appIdStr].data?.price_overview : null;

            // Prefer cached metadata, update prices if we fetched them
            games.push({
              appId: appIdStr,
              name: cached.name,
              capsuleUrl: cached.capsuleUrl,
              releaseDate: '',
              reviewDesc: '',
              reviewPercent: 0,
              genres: cached.genres || [],
              isFree: priceData ? false : (cached.priceFinal === null && cached.priceInitial === null),
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
              priceStatus: priceData ? 'found' : (cached.priceFinal === null ? 'free' : 'stale'),
              isStale: !priceData && cached.priceFinal !== null,
              dateAdded: item.date_added,
            });

            // Re-cache with updated prices if available
            if (priceData) {
              await setCachedSteam(appIdStr, {
                name: cached.name,
                capsuleUrl: cached.capsuleUrl,
                priceInitial: priceData.initial / 100,
                priceFinal: priceData.final / 100,
                discountPercent: priceData.discount_percent,
                genres: cached.genres || [],
              });
            }
          } else {
            // If not in cache, fetch metadata from API
            const metaRes = await fetchSteamMetadata(appIdStr);
            const priceData = priceMap[appIdStr]?.success ? priceMap[appIdStr].data?.price_overview : null;

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
                isFree: data.type === 'free' || (!priceData && data.type !== 'dlc'),
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
                priceStatus: priceData ? 'found' : (data.type === 'free' ? 'free' : 'not_found'),
                dateAdded: item.date_added,
              };

              // Local cache for future sessions
              await setCachedSteam(appIdStr, {
                name: game.name,
                capsuleUrl: game.capsuleUrl,
                priceInitial: game.priceInitial,
                priceFinal: game.priceFinal,
                discountPercent: game.discountPercent,
                genres: game.genres,
              });

              games.push(game);
            }
          }

          completedCount++;
          if (completedCount % 5 === 0 || completedCount === items.length) {
            state.loadingMessage = `Fetching game details (${completedCount}/${wishlistItems.length})...`;
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
      throw new Error('Could not fetch details for any games in your wishlist.');
    }

    state.games = games;
    state.loadingProgress = 0;
    state.loadingTotal = games.length;
    state.loadingMessage = 'Enriching with HowLongToBeat data...';

    // Reset cancellation for HLTB phase - we always want to enrich whatever we found
    state.isCancelled = false;
    state.onStop = undefined;

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
    for (let i = 0; i < gamesToFetch.length; i += HLTB_BATCH_SIZE) {
      if (state.isCancelled) break;

      const batch = gamesToFetch.slice(i, i + HLTB_BATCH_SIZE);
      await Promise.all(
        batch.map(async (game) => {
          const result = await searchHLTB(game.name, () => state.isCancelled);
          if (state.isCancelled) return;
          await setCachedHLTB(game.name, result);

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

    // 4) Done — show dashboard
    state.loading = false;
    state.onStop = undefined;

    renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings);

  } catch (err: unknown) {
    state.loading = false;
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
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
  renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings);
}

function handleFilter(category: string | null) {
  state.filterCategory = category;
  renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings);
}


function handleReset() {
  state.steamId = '';
  state.games = [];
  state.error = null;
  renderLanding(handleFetchWishlist, handleSettings);
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
