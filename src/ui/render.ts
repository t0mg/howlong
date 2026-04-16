import type { AppState, GameEntry, SortField } from '../api/types';
import { REGION_MAP } from '../api/types';
import { sortGames, filterGames, computeStats } from './sort';
import { prepareStats } from './stats';
import { Chart } from 'frappe-charts';
import { t } from './i18n';
import { view } from './template';

// ── DOM Helpers ──────────────────────────────────────────────

const $ = (s: string) => document.querySelector(s) as HTMLElement;

let activeGridObserver: IntersectionObserver | null = null;

// ── Landing Page ─────────────────────────────────────────────

export function renderLanding(
  onSubmit: (steamId: string) => void,
  onSettings: () => void,
  initialSteamId = ''
): void {
  const app = $('#app');
  app.innerHTML = '';

  const { element, refs } = view<{
    settingsBtn: HTMLButtonElement;
    form: HTMLFormElement;
    input: HTMLInputElement;
  }>('tpl-landing');

  refs.settingsBtn.addEventListener('click', onSettings);
  
  if (initialSteamId) refs.input.value = initialSteamId;

  refs.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = refs.input.value.trim();
    if (val) onSubmit(val);
  });

  app.appendChild(element);
  refs.input.focus();
}

// ── Loading State ────────────────────────────────────────────

export function renderLoading(state: AppState): void {
  const app = $('#app');
  let container = app.querySelector('.loading-container') as HTMLElement;

  if (!container) {
    app.innerHTML = '';
    const { element } = view('tpl-loading');
    container = element;
    app.appendChild(container);
  }

  const message = container.querySelector('[data-ref="message"]')!;
  message.textContent = state.loadingMessage;

  const progressArea = container.querySelector('[data-ref="progressArea"]') as HTMLElement;
  if (state.loadingTotal > 0) {
    progressArea.style.display = 'flex';
    const pct = Math.round((state.loadingProgress / state.loadingTotal) * 100);
    
    const fill = container.querySelector('[data-ref="progressFill"]') as HTMLElement;
    const label = container.querySelector('[data-ref="progressLabel"]')!;
    
    fill.style.width = `${pct}%`;
    label.textContent = t('loading_games_enriched', {
      count: state.loadingProgress,
      total: state.loadingTotal,
      percent: pct
    });
  } else {
    progressArea.style.display = 'none';
  }

  const throttledArea = container.querySelector('[data-ref="throttledArea"]')!;
  if (state.isThrottled && state.throttledUntil) {
    const remaining = Math.max(0, Math.ceil((state.throttledUntil - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeStr = `${mins}m ${secs.toString().padStart(2, '0')}s`;

    let alert = throttledArea.querySelector('.throttled-alert');
    if (!alert) {
      const { element, refs } = view<{ timer: HTMLElement }>('tpl-throttled-alert');
      alert = element;
      refs.timer.textContent = t('loading_waiting', { time: timeStr });
      throttledArea.innerHTML = '';
      throttledArea.appendChild(alert);
    } else {
      alert.querySelector('.throttled-timer')!.textContent = t('loading_waiting', { time: timeStr });
    }
  } else {
    throttledArea.innerHTML = '';
  }

  const actionsArea = container.querySelector('[data-ref="actionsArea"]')!;
  if (state.onStop) {
    if (!actionsArea.querySelector('.btn-stop')) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'btn-stop';
      stopBtn.textContent = t('loading_stop');
      stopBtn.addEventListener('click', () => {
        if (state.onStop) state.onStop();
      });
      actionsArea.innerHTML = '';
      actionsArea.appendChild(stopBtn);
    }
  } else {
    actionsArea.innerHTML = '';
  }
}

// ── Error State ──────────────────────────────────────────────

export function renderError(message: string, onRetry: () => void): void {
  const app = $('#app');
  app.innerHTML = '';

  const { element, refs } = view<{ message: HTMLElement; retryBtn: HTMLButtonElement }>('tpl-error');
  refs.message.textContent = message;
  refs.retryBtn.addEventListener('click', onRetry);

  app.appendChild(element);
}

// ── Results Dashboard ────────────────────────────────────────

export function renderDashboard(
  state: AppState,
  onSort: (field: SortField) => void,
  onFilter: (category: string | null) => void,
  onReset: () => void,
  onSettings: () => void,
  onInsights: () => void
): void {
  const app = $('#app');
  let shell = app.querySelector('.dashboard-shell') as HTMLElement;

  if (!shell) {
    app.innerHTML = '';
    const { element, refs: shellRefs } = view<{
      headerRegion: HTMLElement;
      statsRegion: HTMLElement;
      controlsRegion: HTMLElement;
      infoRegion: HTMLElement;
      gridRegion: HTMLElement;
    }>('tpl-dashboard-shell');

    shell = element;
    app.appendChild(shell);

    // Initial static renders
    shellRefs.headerRegion.appendChild(renderHeader(state, onReset, onSettings, onInsights));
  }

  const getRegion = (ref: string) => shell.querySelector(`[data-ref="${ref}"]`) as HTMLElement;

  const filtered = filterGames(state.games, state.filterCategory);
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
  controlsRegion.innerHTML = '';
  controlsRegion.appendChild(renderFilterAndSort(state, onSort, onFilter));

  // Info
  const infoRegion = getRegion('infoRegion');
  infoRegion.innerHTML = '';
  infoRegion.appendChild(renderMatchInfo(stats));

  // Grid
  const gridRegion = getRegion('gridRegion');
  gridRegion.innerHTML = '';
  gridRegion.appendChild(renderGameGrid(sorted, currency));
}

function renderHeader(
  state: AppState,
  onReset: () => void,
  onSettings: () => void,
  onInsights: () => void
): HTMLElement {
  const { element, refs } = view<{
    steamId: HTMLElement;
    resetBtn: HTMLButtonElement;
    insightsBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
  }>('tpl-header');

  refs.steamId.textContent = `Steam: ${state.steamId}`;
  refs.resetBtn.addEventListener('click', onReset);
  refs.insightsBtn.addEventListener('click', onInsights);
  refs.settingsBtn.addEventListener('click', onSettings);

  return element;
}

function renderStatsBar(
  stats: ReturnType<typeof computeStats>,
  currency: string
): HTMLElement {
  const { element, refs } = view<{ container: HTMLElement }>('tpl-stats-bar');
  
  const data = [
    { icon: '🎮', labelKey: 'stats_games', value: stats.totalGames.toString() },
    { icon: '⏱️', labelKey: 'stats_main', value: formatHours(stats.totalMainHours) },
    { icon: '⏱️+', labelKey: 'stats_main_extra', value: formatHours(stats.totalMainExtraHours) },
    { icon: '💎', labelKey: 'stats_completionist', value: formatHours(stats.totalCompletionistHours) },
    { icon: '💰', labelKey: 'stats_value', value: formatCurrency(stats.totalValue, currency) },
    { icon: '🏷️', labelKey: 'stats_savings', value: formatCurrency(stats.totalSavings, currency) },
  ];

  data.forEach(item => {
    const { element: card, refs: cRefs } = view<{ icon: HTMLElement; value: HTMLElement; label: HTMLElement }>('tpl-stat-card');
    cRefs.icon.textContent = item.icon;
    cRefs.value.textContent = item.value;
    cRefs.label.textContent = t(item.labelKey);
    refs.container.appendChild(card);
  });

  return element;
}

function renderFilterAndSort(
  state: AppState,
  onSort: (field: SortField) => void,
  onFilter: (category: string | null) => void
): HTMLElement {
  const { element, refs } = view<{ filterSelect: HTMLSelectElement; sortContainer: HTMLElement }>('tpl-controls');

  // Filter
  const genres = new Set<string>();
  state.games.forEach(g => g.genres?.forEach(genre => genres.add(genre)));
  const sortedGenres = Array.from(genres).sort();

  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = t('dashboard_filter_all');
  refs.filterSelect.appendChild(allOpt);

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

function renderMatchInfo(stats: ReturnType<typeof computeStats>): HTMLElement {
  const el = document.createElement('div');
  el.className = 'match-info';
  el.textContent = t('dashboard_match_info', { found: stats.gamesWithHltb, total: stats.totalGames });
  return el;
}

function renderGameGrid(sortedGames: GameEntry[], currency: string): HTMLElement {
  if (activeGridObserver) activeGridObserver.disconnect();

  const { element, refs } = view<{ container: HTMLElement }>('tpl-grid');
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
      fragment.appendChild(createGameCard(sortedGames[cursor], currency));
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

function createGameCard(game: GameEntry, currency: string): HTMLElement {
  const { element, refs } = view<{
    img: HTMLImageElement;
    badges: HTMLElement;
    name: HTMLElement;
    date: HTMLElement;
    genres: HTMLElement;
    priceRow: HTMLElement;
    hltb: HTMLElement;
    links: HTMLElement;
  }>('tpl-game-card');

  refs.img.src = game.capsuleUrl;
  refs.img.alt = game.name;
  refs.name.textContent = game.name;
  refs.date.textContent = t('game_added', { date: formatDate(game.dateAdded) });

  // Badges
  if (game.isComingSoon) {
    appendBadge(refs.badges, 'status-badge badge-coming-soon', t('game_coming_soon'));
  } else if (game.isDemo) {
    appendBadge(refs.badges, 'status-badge badge-demo', t('game_demo'));
  } else if (game.hasDemo) {
    appendBadge(refs.badges, 'status-badge badge-demo-avail', t('game_demo_avail'));
  }

  if (game.discountPercent > 0) {
    appendBadge(refs.badges, 'discount-badge', `-${game.discountPercent}%`);
  }

  // Genres
  if (game.genres && game.genres.length > 0) {
    game.genres.slice(0, 5).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'genre-chip';
      chip.textContent = tag;
      refs.genres.appendChild(chip);
    });
  }

  // Price
  if (game.isComingSoon) {
    refs.priceRow.innerHTML = `<span class="price-status">${t('game_coming_soon')}</span>`;
  } else if (game.isFree || game.isDemo) {
    refs.priceRow.innerHTML = `<span class="price-free">${t('game_free')}</span>`;
  } else if (game.priceStatus === 'stale') {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      refs.priceRow.innerHTML += `<span class="price-original">${formatCurrency(game.priceInitial, currency)}</span>`;
    }
    refs.priceRow.innerHTML += `<span class="price-current stale">${formatCurrency(game.priceFinal || 0, currency)} ${t('game_cached')}</span>`;
  } else if (game.priceFinal !== null) {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      const orig = document.createElement('span');
      orig.className = 'price-original';
      orig.textContent = formatCurrency(game.priceInitial, currency);
      refs.priceRow.appendChild(orig);
    }
    const current = document.createElement('span');
    current.className = game.discountPercent > 0 ? 'price-sale' : 'price-current';
    current.textContent = formatCurrency(game.priceFinal, currency);
    refs.priceRow.appendChild(current);
  } else {
    refs.priceRow.innerHTML = `<span class="price-unknown">${t('game_price_na')}</span>`;
  }

  // HLTB
  if (game.hltbStatus === 'found') {
    if (game.hltbMain) refs.hltb.appendChild(createDurationRow('Main', game.hltbMain, 'main'));
    if (game.hltbMainExtra) refs.hltb.appendChild(createDurationRow('Main+', game.hltbMainExtra, 'extra'));
    if (game.hltbCompletionist) refs.hltb.appendChild(createDurationRow('100%', game.hltbCompletionist, 'comp'));
  } else if (game.hltbStatus === 'not_found') {
    refs.hltb.innerHTML = `<div class="hltb-no-data">${t('game_no_hltb')}</div>`;
  } else {
    refs.hltb.innerHTML = `<div class="hltb-pending">${t('game_hltb_pending')}</div>`;
  }

  // Links
  const steamLnk = document.createElement('a');
  steamLnk.href = `https://store.steampowered.com/app/${game.appId}`;
  steamLnk.target = '_blank';
  steamLnk.rel = 'noopener';
  steamLnk.className = 'game-link steam-link';
  steamLnk.textContent = t('game_link_steam');
  refs.links.appendChild(steamLnk);

  if (game.hltbId) {
    const hltbLnk = document.createElement('a');
    hltbLnk.href = `https://howlongtobeat.com/game/${game.hltbId}`;
    hltbLnk.target = '_blank';
    hltbLnk.rel = 'noopener';
    hltbLnk.className = 'game-link hltb-link';
    hltbLnk.textContent = t('game_link_hltb');
    refs.links.appendChild(hltbLnk);
  }

  return element;
}

function appendBadge(container: HTMLElement, className: string, text: string) {
  const b = document.createElement('div');
  b.className = className;
  b.textContent = text;
  container.appendChild(b);
}

function createDurationRow(label: string, hours: number, type: string): HTMLElement {
  const { element, refs } = view<{ label: HTMLElement; bar: HTMLElement; hours: HTMLElement }>('tpl-duration-row');
  refs.label.textContent = label;
  refs.hours.textContent = formatHours(hours);
  refs.bar.className = `duration-bar duration-bar-${type}`;
  refs.bar.style.width = `${Math.min((hours / 200) * 100, 100)}%`;
  return element;
}

// ── Modals ───────────────────────────────────────────────────

export function renderSettingsModal(
  onClearHLTB: () => void,
  onClearSteam: () => void,
  onHardReset: () => void,
  onRegionChange: (regionId: string) => void,
  onClose: () => void,
  currentRegionId: string
): void {
  const { element, refs } = view<{
    overlay: HTMLElement;
    closeBtn: HTMLButtonElement;
    regionContainer: HTMLElement;
    hltbContainer: HTMLElement;
    steamContainer: HTMLElement;
    resetContainer: HTMLElement;
  }>('tpl-settings-modal');

  const close = () => {
    onClose();
    element.remove();
  };

  refs.closeBtn.addEventListener('click', close);
  refs.overlay.addEventListener('click', (e) => { if (e.target === refs.overlay) close(); });

  // Region Selection
  const select = document.createElement('select');
  select.className = 'btn-ghost';
  select.style.padding = '0.5rem';
  Object.values(REGION_MAP).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    if (currentRegionId === r.id) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onRegionChange(select.value));
  refs.regionContainer.appendChild(select);

  // Action Buttons
  const hltbBtn = createActionBtn(t('settings_clear_hltb_btn'), 'var(--accent-secondary)', () => {
    onClearHLTB();
    hltbBtn.textContent = t('settings_cleared');
    hltbBtn.disabled = true;
    hltbBtn.style.opacity = '0.7';
  });
  refs.hltbContainer.appendChild(hltbBtn);

  const steamBtn = createActionBtn(t('settings_clear_steam_btn'), 'var(--accent-secondary)', () => {
    onClearSteam();
    steamBtn.textContent = t('settings_cleared');
    steamBtn.disabled = true;
    steamBtn.style.opacity = '0.7';
  });
  refs.steamContainer.appendChild(steamBtn);

  const resetBtn = createActionBtn(t('settings_hard_reset_btn'), 'var(--danger)', () => {
    if (confirm(t('settings_hard_reset_confirm'))) {
      onHardReset();
      element.remove();
    }
  });
  refs.resetContainer.appendChild(resetBtn);

  document.body.appendChild(element);
}

function createActionBtn(text: string, bg: string, onClick: () => void) {
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.style.background = bg;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

export function renderStatsModal(
  games: GameEntry[],
  currency: string,
  onClose: () => void
): void {
  const { element, refs } = view<{
    overlay: HTMLElement;
    closeBtn: HTMLButtonElement;
    statsGrid: HTMLElement;
  }>('tpl-insights-modal');

  const close = () => {
    onClose();
    element.remove();
  };

  refs.closeBtn.addEventListener('click', close);
  refs.overlay.addEventListener('click', (e) => { if (e.target === refs.overlay) close(); });

  const data = prepareStats(games, currency);
  
  const stats = [
    { icon: '⏳', label: t('insights_avg_price_hr'), value: formatCurrency(data.insights.avgPricePerHour, currency) },
    { icon: '📅', label: t('insights_oldest_entry'), value: String(data.insights.oldestItemYear) },
    { icon: '🏷️', label: t('insights_top_genre'), value: data.insights.mostCommonGenre },
    { icon: '⚡', label: t('insights_total_story'), value: formatHours(data.insights.totalPotentialHours) }
  ];

  stats.forEach(s => {
    const { element: card, refs: cr } = view<{ icon: HTMLElement; value: HTMLElement; label: HTMLElement }>('tpl-stat-card');
    cr.icon.textContent = s.icon;
    cr.value.textContent = s.value;
    cr.label.textContent = s.label;
    refs.statsGrid.appendChild(card);
  });

  document.body.appendChild(element);

  // Initialize charts
  setTimeout(() => {
    new Chart('#chart-duration', { title: t('insights_chart_duration'), data: data.durationDist, type: 'bar', height: 250, colors: ['#6366f1'], barOptions: { spaceRatio: 0.2 } });
    new Chart('#chart-price', { title: t('insights_chart_price', { currency }), data: data.priceDist, type: 'bar', height: 250, colors: ['#a78bfa'], barOptions: { spaceRatio: 0.2 } });
    new Chart('#chart-genre', { title: t('insights_chart_genre'), data: data.genreDist, type: 'pie', height: 250, colors: ['#6366f1', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#fbbf24', '#ec4899', '#06b6d4'], truncateLegends: true });
    new Chart('#chart-year', { title: t('insights_chart_year'), data: data.yearDist, type: 'line', height: 250, colors: ['#34d399'], lineOptions: { hideDots: 0, regionFill: 1 } });
  }, 50);
}

// ── Formatting ───────────────────────────────────────────────

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(timestamp * 1000));
}

function formatHours(hours: number): string {
  if (hours === 0) return '—';
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;
  let wholeHours = Math.floor(hours);
  let minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 60) { wholeHours++; minutes = 0; }
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h${minutes}m`;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  if (amount === 0) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  } catch {
    const symbol = currency === 'EUR' ? '€' : '$';
    return `${symbol}${amount.toFixed(2)}`;
  }
}
