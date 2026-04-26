import './style.css';
import type { AppState, SortField, SortState } from './api/types';
import { REGION_MAP } from './api/types';
import { getSetting, setSetting, clearHLTBCache, clearSteamCache, clearGOGCache } from './cache';
import { renderLanding, renderLoading, renderError, renderDashboard, renderStatsModal } from './ui/render';
import { t, getBrowserLocale, setLocale } from './ui/i18n';
import type { Locale } from './ui/i18n';
import { fetchWishlistPipeline } from './pipeline';

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
  hiddenGames: new Set(),
};

// ── Boot ─────────────────────────────────────────────────────

async function init() {
  // Load settings from IDB
  const savedLocale = await getSetting<string>('localeId');
  const locale = savedLocale || getBrowserLocale();
  setLocale(locale as Locale);

  state.regionId = (await getSetting<string>('regionId')) || 'us';
  const lastSteamId = (await getSetting<string>('lastSteamId')) || '';

  // Restore hidden games
  const savedHidden = await getSetting<string[]>('hiddenGames');
  if (savedHidden && Array.isArray(savedHidden)) {
    state.hiddenGames = new Set(savedHidden);
  }

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
  state.onStop = () => {
    state.isCancelled = true;
    state.loadingMessage = t('loading_stopping');
    renderLoading(state);
  };

  await setSetting('lastSteamId', steamId);
  renderLoading(state);

  try {
    const games = await fetchWishlistPipeline(state);

    state.games = games;
    state.loading = false;
    state.onStop = undefined;

    renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights, handleLucky, handleToggleHide);

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
    async () => {
      await clearGOGCache();
      isDirty = true;
    },
    async () => {
      state.hiddenGames.clear();
      await setSetting('hiddenGames', []);
      isDirty = true;
    },
    () => handleClearAppCache(),
    async (regionId) => {
      state.regionId = regionId;
      await setSetting('regionId', regionId);
      isDirty = true;
    },
    async (localeId) => {
      setLocale(localeId as Locale);
      await setSetting('localeId', localeId);
      isDirty = true;
    },
    () => {
      if (isDirty) {
        window.location.reload();
      }
    },
    state.regionId,
    (await getSetting<string>('localeId')) || getBrowserLocale()
  );
}

async function handleClearAppCache() {
  console.log('Clearing app cache...');
  const { clearCache } = await import('./cache');
  await clearCache();

  console.log('Clearing service worker...');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  console.log('Clearing cache storage...');
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));

  console.log('Reloading...');
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
  renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights, handleLucky, handleToggleHide);
}

function handleFilter(category: string | null) {
  state.filterCategory = category;
  setSetting('lastFilter', category);
  renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights, handleLucky, handleToggleHide);
}

async function handleToggleHide(appId: string, isCurrentlyHidden: boolean) {
  if (!isCurrentlyHidden) {
    const { renderConfirmModal } = await import('./ui/views/modals');
    renderConfirmModal(
      t('hide_confirm_title'),
      t('hide_confirm_desc'),
      t('hide_confirm_btn'),
      t('hide_cancel_btn'),
      async () => {
        state.hiddenGames.add(appId);
        await setSetting('hiddenGames', Array.from(state.hiddenGames));
        renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights, handleLucky, handleToggleHide);
      }
    );
  } else {
    state.hiddenGames.delete(appId);
    await setSetting('hiddenGames', Array.from(state.hiddenGames));
    renderDashboard(state, handleSort, handleFilter, handleReset, handleSettings, handleInsights, handleLucky, handleToggleHide);
  }
}

function handleReset() {
  state.steamId = '';
  state.games = [];
  state.error = null;
  renderLanding(handleFetchWishlist, handleSettings);
}

function handleInsights() {
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;
  renderStatsModal(state.games, region.currency, () => {});
}

function handleLucky() {
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;
  import('./ui/render').then(({ renderLuckyModal }) => {
    const visibleGames = state.games.filter(g => !state.hiddenGames.has(g.appId));
    renderLuckyModal(visibleGames, region.currency, () => {});
  });
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
