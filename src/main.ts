import './style.css';
import type { AppState, GameEntry, SortField } from './api/types';
import { REGION_MAP } from './api/types';
import { fetchSteamWishlist, fetchSteamAppDetails } from './api/steam';
import { searchHLTB } from './api/hltb';
import { getCachedHLTB, setCachedHLTB } from './cache';
import { renderLanding, renderLoading, renderError, renderDashboard } from './ui/render';

// ── App State ────────────────────────────────────────────────

const state: AppState = {
  steamId: '',
  games: [],
  sort: { field: 'hltbMain', direction: 'asc' },
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

function init() {
  // Load region choice
  state.regionId = localStorage.getItem('howlong_region') || 'us';
  
  renderLanding(handleFetchWishlist, handleSettings);
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

  localStorage.setItem('howlong_last_steam_id', steamId);
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

    // 2) Fetch metadata individually with concurrency control
    // Steam appdetails is sensitive to batch size, so we fetch one by one
    // but with multiple concurrent requests to maintain speed.
    const games: GameEntry[] = [];
    const CONCURRENCY = 5;
    let completedCount = 0;
    let throttleTimer: any = null;

    const onThrottle = (until: number | null) => {
      state.isThrottled = until !== null;
      state.throttledUntil = until;
      
      // Clear existing timer
      if (throttleTimer) clearInterval(throttleTimer);
      
      if (until) {
        // Update UI every second during throttle
        throttleTimer = setInterval(() => {
          if (Date.now() >= until) {
            clearInterval(throttleTimer);
          } else {
            renderLoading(state);
          }
        }, 1000);
      }
      renderLoading(state);
    };

    // Use a simple queue for concurrency
    const fetchWithLimit = async (items: any[]) => {
      const activePromises: Promise<void>[] = [];
      
      for (const item of items) {
        // Wait if we reached concurrency limit
        if (activePromises.length >= CONCURRENCY) {
          await Promise.race(activePromises);
        }

        if (state.isCancelled) break;

        const promise = (async () => {
          const appIdStr = item.appid.toString();
          const region = REGION_MAP[state.regionId] || REGION_MAP.us;
          const details = await fetchSteamAppDetails(
            appIdStr, 
            0, 
            () => state.isCancelled, 
            onThrottle,
            region.cc
          );
          
          if (details && details[appIdStr]?.success) {
            const data = details[appIdStr].data!;
            const discountPercent = data.price_overview?.discount_percent || 0;

            games.push({
              appId: appIdStr,
              name: data.name,
              capsuleUrl: data.header_image,
              releaseDate: data.release_date?.date || '',
              reviewDesc: '',
              reviewPercent: 0,
              tags: [],
              isFree: data.type === 'free' || (!data.price_overview && data.type !== 'dlc'),
              priority: item.priority || 999,
              priceCurrency: data.price_overview?.currency || null,
              priceInitial: data.price_overview ? data.price_overview.initial / 100 : null,
              priceFinal: data.price_overview ? data.price_overview.final / 100 : null,
              discountPercent,
              hltbId: null,
              hltbMain: null,
              hltbMainExtra: null,
              hltbCompletionist: null,
              hltbStatus: 'pending',
              priceStatus: data.price_overview ? 'found' : (data.type === 'free' ? 'free' : 'not_found'),
            });
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

    // 3) Enrich with HLTB data (with batching to be gentle on the API)
    const HLTB_BATCH_SIZE = 10;
    for (let i = 0; i < games.length; i += HLTB_BATCH_SIZE) {
      const batch = games.slice(i, i + HLTB_BATCH_SIZE);

      await Promise.all(
        batch.map(async (game) => {
          // Check cache first
          const cached = getCachedHLTB(game.name);
          if (cached !== undefined) {
            if (cached) {
              game.hltbId = cached.id;
              game.hltbMain = cached.gameplayMain || null;
              game.hltbMainExtra = cached.gameplayMainExtra || null;
              game.hltbCompletionist = cached.gameplayCompletionist || null;
              game.hltbStatus = 'found';
            } else {
              game.hltbStatus = 'not_found';
            }
            return;
          }

          // Fetch from API
          const result = await searchHLTB(game.name, () => state.isCancelled);
          if (state.isCancelled) return;
          setCachedHLTB(game.name, result);

          if (result) {
            game.hltbId = result.id;
            game.hltbMain = result.gameplayMain || null;
            game.hltbMainExtra = result.gameplayMainExtra || null;
            game.hltbCompletionist = result.gameplayCompletionist || null;
            game.hltbStatus = 'found';
          } else {
            game.hltbStatus = 'not_found';
          }
        })
      );

      state.loadingProgress = Math.min(i + HLTB_BATCH_SIZE, games.length);
      renderLoading(state);

      if (state.isCancelled) break;
      if (i + HLTB_BATCH_SIZE < games.length) {
        await sleep(300);
      }
    }

    // 4) Done — show dashboard
    state.loading = false;
    state.onStop = undefined;
    if (throttleTimer) clearInterval(throttleTimer);
    
    renderDashboard(state, handleSort, handleReset, handleSettings);
  } catch (err: unknown) {
    state.loading = false;
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    state.error = message;
    renderError(message, () => renderLanding(handleFetchWishlist, handleSettings));
  }
}

async function handleSettings() {
  const { renderSettingsModal } = await import('./ui/render');
  const { clearCache } = await import('./cache');
  
  renderSettingsModal(
    () => clearCache(),
    () => handleClearAppCache(),
    (regionId) => {
      state.regionId = regionId;
      localStorage.setItem('howlong_region', regionId);
    },
    state.regionId
  );
}

async function handleClearAppCache() {
  // Clear Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }

  // Clear Cache Storage
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    await caches.delete(name);
  }

  // Force reload
  window.location.reload();
}

function handleSort(field: SortField) {
  if (state.sort.field === field) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    state.sort.direction = field === 'name' ? 'asc' : 'desc';
  }
  renderDashboard(state, handleSort, handleReset, handleSettings);
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
