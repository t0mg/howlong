import type { AppState, GameEntry, SortField } from '../../api/types';
import { REGION_MAP } from '../../api/types';
import { sortGames, filterGames, computeStats } from '../sort';
import { t } from '../i18n';
import { formatHours, formatCurrency } from '../format';
import { html, TPL_STAT_CARD, ICON_SETTINGS, ICON_INSIGHTS, ICON_LUCKY } from '../template';
import { createGameCard } from './game-card';

// ── DOM Helpers ──────────────────────────────────────────────

const $ = (s: string) => document.querySelector(s) as HTMLElement;

let activeGridObserver: IntersectionObserver | null = null;

// ── Templates ────────────────────────────────────────────────

const TPL_DASHBOARD_SHELL = `
  <div class="dashboard-shell">
    <div data-ref="headerRegion"></div>
    <div data-ref="statsRegion"></div>
    <div data-ref="controlsRegion"></div>
    <div data-ref="infoRegion"></div>
    <div data-ref="gridRegion"></div>
  </div>`;

const TPL_HEADER = `
  <header class="dashboard-header">
    <div class="header-left">
      <h1 class="header-title" data-t="app_title"></h1>
      <span class="header-steam-id" data-ref="steamId"></span>
    </div>
    <div class="header-actions">
      <button class="btn-ghost" data-ref="resetBtn" data-t="dashboard_change_id"></button>
      <button class="btn-ghost btn-lucky" data-ref="luckyBtn" data-t-title="dashboard_lucky">
        ${ICON_LUCKY}
        <span data-t="dashboard_lucky"></span>
      </button>
      <button class="btn-ghost btn-insights" data-ref="insightsBtn" data-t-title="dashboard_insights">
        ${ICON_INSIGHTS}
        <span data-t="dashboard_insights"></span>
      </button>
      <button class="btn-ghost" data-ref="settingsBtn" data-t-title="settings_title">
        ${ICON_SETTINGS}
      </button>
    </div>
  </header>`;

const TPL_STATS_BAR = `<div class="stats-bar" data-ref="container"></div>`;

const TPL_CONTROLS = `
  <div class="controls-container">
    <div class="filter-controls">
      <span class="sort-label" data-t="dashboard_filter_label"></span>
      <select class="filter-select" data-ref="filterSelect"></select>
    </div>
    <div class="sort-controls" data-ref="sortContainer">
      <span class="sort-label" data-t="dashboard_sort_label"></span>
    </div>
  </div>`;

const TPL_GRID = `<div class="game-grid" data-ref="container"></div>`;

// ── Results Dashboard ────────────────────────────────────────

export function renderDashboard(
  state: AppState,
  onSort: (field: SortField) => void,
  onFilter: (category: string | null) => void,
  onReset: () => void,
  onSettings: () => void,
  onInsights: () => void,
  onLucky: () => void,
  onToggleHide: (appId: string, isHidden: boolean) => void
): void {
  const app = $('#app');
  let shell = app.querySelector('.dashboard-shell') as HTMLElement;

  if (!shell) {
    app.innerHTML = '';
    const { element, refs: shellRefs } = html<{
      headerRegion: HTMLElement;
      statsRegion: HTMLElement;
      controlsRegion: HTMLElement;
      infoRegion: HTMLElement;
      gridRegion: HTMLElement;
    }>(TPL_DASHBOARD_SHELL);

    shell = element;
    app.appendChild(shell);

    // Initial static renders
    shellRefs.headerRegion.appendChild(renderHeader(state, onReset, onSettings, onInsights, onLucky));
  }

  const getRegion = (ref: string) => shell.querySelector(`[data-ref="${ref}"]`) as HTMLElement;

  const filtered = filterGames(state.games, state.filterCategory, state.hiddenGames);
  const sorted = sortGames(filtered, state.sort.field, state.sort.direction);
  const stats = computeStats(sorted);
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;
  const currency = region.currency;

  // Stats
  const statsRegion = getRegion('statsRegion');
  statsRegion.innerHTML = '';
  statsRegion.appendChild(renderStatsBar(stats, currency));

  // Controls
  const controlsRegion = getRegion('controlsRegion');
  const prevSortControls = controlsRegion.querySelector('.sort-controls');
  const scrollLeft = prevSortControls ? prevSortControls.scrollLeft : 0;

  controlsRegion.innerHTML = '';
  controlsRegion.appendChild(renderFilterAndSort(state, onSort, onFilter));

  if (scrollLeft > 0) {
    const nextSortControls = controlsRegion.querySelector('.sort-controls');
    if (nextSortControls) nextSortControls.scrollLeft = scrollLeft;
  }

  // Info
  const infoRegion = getRegion('infoRegion');
  infoRegion.innerHTML = '';
  infoRegion.appendChild(renderMatchInfo(state, stats));

  // Grid
  const gridRegion = getRegion('gridRegion');
  gridRegion.innerHTML = '';
  gridRegion.appendChild(renderGameGrid(sorted, currency, state.hiddenGames, onToggleHide));
}

// ── Header ───────────────────────────────────────────────────

function renderHeader(
  state: AppState,
  onReset: () => void,
  onSettings: () => void,
  onInsights: () => void,
  onLucky: () => void
): HTMLElement {
  const { element, refs } = html<{
    steamId: HTMLElement;
    resetBtn: HTMLButtonElement;
    luckyBtn: HTMLButtonElement;
    insightsBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
  }>(TPL_HEADER);

  refs.steamId.textContent = `Steam: ${state.steamId}`;
  refs.resetBtn.addEventListener('click', onReset);
  refs.luckyBtn.addEventListener('click', onLucky);
  refs.insightsBtn.addEventListener('click', onInsights);
  refs.settingsBtn.addEventListener('click', onSettings);

  return element;
}

// ── Stats Bar ────────────────────────────────────────────────

function renderStatsBar(
  stats: ReturnType<typeof computeStats>,
  currency: string
): HTMLElement {
  const { element, refs } = html<{ container: HTMLElement }>(TPL_STATS_BAR);

  const data = [
    { icon: '🎮', labelKey: 'stats_games', value: stats.totalGames.toString() },
    { icon: '⏱️', labelKey: 'stats_main', value: formatHours(stats.totalMainHours) },
    { icon: '⏱️+', labelKey: 'stats_main_extra', value: formatHours(stats.totalMainExtraHours) },
    { icon: '💎', labelKey: 'stats_completionist', value: formatHours(stats.totalCompletionistHours) },
    { icon: '💰', labelKey: 'stats_value', value: formatCurrency(stats.totalValue, currency) },
    { icon: '🏷️', labelKey: 'stats_savings', value: formatCurrency(stats.totalSavings, currency) },
  ];

  data.forEach(item => {
    const { element: card, refs: cRefs } = html<{ icon: HTMLElement; value: HTMLElement; label: HTMLElement }>(TPL_STAT_CARD);
    cRefs.icon.textContent = item.icon;
    cRefs.value.textContent = item.value;
    cRefs.label.textContent = t(item.labelKey);
    refs.container.appendChild(card);
  });

  return element;
}

// ── Filter & Sort ────────────────────────────────────────────

function renderFilterAndSort(
  state: AppState,
  onSort: (field: SortField) => void,
  onFilter: (category: string | null) => void
): HTMLElement {
  const { element, refs } = html<{ filterSelect: HTMLSelectElement; sortContainer: HTMLElement }>(TPL_CONTROLS);

  // Filter
  const genres = new Set<string>();
  state.games.forEach(g => g.genres?.forEach(genre => genres.add(genre)));
  const sortedGenres = Array.from(genres).sort();

  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = t('dashboard_filter_all');
  refs.filterSelect.appendChild(allOpt);

  const hiddenOpt = document.createElement('option');
  hiddenOpt.value = 'hidden';
  hiddenOpt.textContent = t('dashboard_filter_hidden');
  if (state.filterCategory === 'hidden') hiddenOpt.selected = true;
  refs.filterSelect.appendChild(hiddenOpt);

  sortedGenres.forEach(genre => {
    const opt = document.createElement('option');
    opt.value = genre;
    opt.textContent = genre;
    if (state.filterCategory === genre) opt.selected = true;
    refs.filterSelect.appendChild(opt);
  });

  if (state.filterCategory) refs.filterSelect.classList.add('active');
  refs.filterSelect.addEventListener('change', () => onFilter(refs.filterSelect.value || null));

  // Sort
  const sortDefs: { value: SortField; labelKey: string }[] = [
    { value: 'priority', labelKey: 'sort_priority' },
    { value: 'dateAdded', labelKey: 'sort_dateAdded' },
    { value: 'name', labelKey: 'sort_name' },
    { value: 'hltbMain', labelKey: 'sort_hltbMain' },
    { value: 'hltbMainExtra', labelKey: 'sort_hltbMainExtra' },
    { value: 'hltbCompletionist', labelKey: 'sort_hltbCompletionist' },
    { value: 'priceFinal', labelKey: 'sort_priceFinal' },
    { value: 'discountPercent', labelKey: 'sort_discountPercent' },
  ];

  sortDefs.forEach(opt => {
    const isActive = state.sort.field === opt.value;
    const btn = document.createElement('button');
    btn.className = `sort-btn ${isActive ? 'active' : ''}`;
    btn.textContent = t(opt.labelKey);

    if (isActive) {
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = state.sort.direction === 'asc' ? ' ↑' : ' ↓';
      btn.appendChild(arrow);
    }

    btn.addEventListener('click', () => onSort(opt.value));
    refs.sortContainer.appendChild(btn);
  });

  return element;
}

// ── Match Info ───────────────────────────────────────────────

function renderMatchInfo(state: AppState, stats: ReturnType<typeof computeStats>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'match-info-container';

  const el = document.createElement('div');
  el.className = 'match-info';
  el.textContent = t('dashboard_match_info', { found: stats.gamesWithHltb, total: stats.totalGames });
  container.appendChild(el);

  const errorPct = state.games.length > 0 ? (state.hltbErrorCount / state.games.length) : 0;
  if (errorPct >= 0.1) {
    const warning = document.createElement('div');
    warning.className = 'match-warning';
    warning.textContent = t('dashboard_hltb_warning');
    container.appendChild(warning);
  }

  return container;
}

// ── Game Grid ────────────────────────────────────────────────

function renderGameGrid(
  sortedGames: GameEntry[],
  currency: string,
  hiddenGames: Set<string>,
  onToggleHide: (appId: string, isHidden: boolean) => void
): HTMLElement {
  if (activeGridObserver) activeGridObserver.disconnect();

  const { element, refs } = html<{ container: HTMLElement }>(TPL_GRID);
  const container = refs.container;

  const BATCH_SIZE = 60;
  let cursor = 0;

  const sentinel = document.createElement('div');
  sentinel.className = 'grid-sentinel';
  sentinel.innerHTML = '<div class="spinner spinner-small"></div>';
  container.appendChild(sentinel);

  const renderNextBatch = () => {
    const end = Math.min(cursor + BATCH_SIZE, sortedGames.length);
    const fragment = document.createDocumentFragment();

    for (; cursor < end; cursor++) {
      const game = sortedGames[cursor];
      const isHidden = hiddenGames.has(game.appId);
      fragment.appendChild(createGameCard(game, currency, isHidden, onToggleHide));
    }

    container.insertBefore(fragment, sentinel);

    if (cursor >= sortedGames.length) {
      sentinel.remove();
      if (activeGridObserver) activeGridObserver.disconnect();
    }
  };

  // Initial render
  renderNextBatch();

  if (cursor < sortedGames.length) {
    activeGridObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderNextBatch();
      }
    }, { rootMargin: '400px' });
    activeGridObserver.observe(sentinel);
  }

  return element;
}
