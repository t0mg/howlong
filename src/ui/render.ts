import type { AppState, GameEntry, SortField } from '../api/types';
import { REGION_MAP } from '../api/types';
import { sortGames, filterGames, computeStats } from './sort';
import { prepareStats } from './stats';
import { Chart } from 'frappe-charts';

// ── DOM Helpers ──────────────────────────────────────────────

function $(selector: string): HTMLElement {
  return document.querySelector(selector)!;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

// ── Landing Page ─────────────────────────────────────────────

export function renderLanding(
  onSubmit: (steamId: string) => void,
  onSettings: () => void,
  initialSteamId = ''
): void {
  const app = $('#app');
  app.innerHTML = '';

  const template = document.getElementById('tpl-landing') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const container = clone.firstElementChild as HTMLElement;

  const settingsBtn = container.querySelector('#settings-btn') as HTMLButtonElement;
  settingsBtn.addEventListener('click', onSettings);

  const form = container.querySelector('#steam-form') as HTMLFormElement;
  const input = container.querySelector('#steam-id-input') as HTMLInputElement;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (val) onSubmit(val);
  });

  if (initialSteamId) input.value = initialSteamId;

  app.appendChild(container);
  input.focus();
}

// ── Loading State ────────────────────────────────────────────

export function renderLoading(state: AppState): void {
  const app = $('#app');
  let container = app.querySelector('.loading-container') as HTMLElement;

  if (!container) {
    app.innerHTML = '';
    const template = document.getElementById('tpl-loading') as HTMLTemplateElement;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    container = clone.firstElementChild as HTMLElement;
    app.appendChild(container);
  }

  // Update dynamic parts
  container.querySelector('.loading-message')!.textContent = state.loadingMessage;

  const progressArea = container.querySelector('.progress-area')!;
  if (state.loadingTotal > 0) {
    const pct = Math.round((state.loadingProgress / state.loadingTotal) * 100);
    let progress = progressArea.querySelector('.progress-bar') as HTMLElement;
    let label = progressArea.querySelector('.progress-label') as HTMLElement;

    if (!progress) {
      progressArea.innerHTML = `
        <div class="progress-bar"><div class="progress-fill"></div></div>
        <p class="progress-label"></p>
      `;
      progress = progressArea.querySelector('.progress-bar') as HTMLElement;
      label = progressArea.querySelector('.progress-label') as HTMLElement;
    }

    const fill = progress.querySelector('.progress-fill') as HTMLElement;
    fill.style.width = `${pct}%`;
    label.textContent = `${state.loadingProgress} / ${state.loadingTotal} games enriched (${pct}%)`;
  } else {
    progressArea.innerHTML = '';
  }

  const throttledArea = container.querySelector('.throttled-area')!;
  if (state.isThrottled && state.throttledUntil) {
    const remaining = Math.max(0, Math.ceil((state.throttledUntil - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeStr = `${mins}m ${secs.toString().padStart(2, '0')}s`;

    let alert = throttledArea.querySelector('.throttled-alert');
    if (!alert) {
      throttledArea.innerHTML = `
        <div class="throttled-alert">
          <span class="throttled-icon">⚠️</span>
          <div class="throttled-text">
            <span class="throttled-title">Steam is throttling requests</span>
            <span class="throttled-timer"></span>
          </div>
        </div>
      `;
      alert = throttledArea.querySelector('.throttled-alert');
    }
    alert!.querySelector('.throttled-timer')!.textContent = `Waiting ${timeStr}...`;
  } else {
    throttledArea.innerHTML = '';
  }

  const actionsArea = container.querySelector('.actions-area')!;
  if (state.onStop) {
    if (!actionsArea.querySelector('.btn-stop')) {
      actionsArea.innerHTML = '<button class="btn-stop">Stop & Show Results</button>';
      const stopBtn = actionsArea.querySelector('.btn-stop') as HTMLButtonElement;
      stopBtn.addEventListener('click', () => {
        if (state.onStop) state.onStop();
      });
    }
  } else {
    actionsArea.innerHTML = '';
  }
}

// ── Error State ──────────────────────────────────────────────

export function renderError(message: string, onRetry: () => void): void {
  const app = $('#app');
  app.innerHTML = '';

  const container = el('div', { class: 'error-container' });
  const icon = el('div', { class: 'error-icon' });
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--danger)" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  `;
  const msg = el('p', { class: 'error-message' }, message);
  const retryBtn = el('button', { class: 'btn-primary', id: 'retry-btn' }, 'Try Again');
  retryBtn.addEventListener('click', onRetry);

  container.append(icon, msg, retryBtn);
  app.appendChild(container);
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
  app.innerHTML = '';

  const filtered = filterGames(state.games, state.filterCategory);
  const sorted = sortGames(filtered, state.sort.field, state.sort.direction);
  const stats = computeStats(sorted);
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;
  const currency = region.currency;

  app.append(
    renderHeader(state, onReset, onSettings, onInsights),
    renderStatsBar(stats, currency),
    renderFilterAndSort(state, onSort, onFilter),
    renderMatchInfo(stats),
    renderGameGrid(sorted, currency)
  );
}


function renderHeader(
  state: AppState,
  onReset: () => void,
  onSettings: () => void,
  onInsights: () => void
): HTMLElement {
  const template = document.getElementById('tpl-header') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const header = clone.firstElementChild as HTMLElement;

  header.querySelector('.header-steam-id')!.textContent = `Steam: ${state.steamId}`;

  header.querySelector('#reset-btn')!.addEventListener('click', onReset);
  header.querySelector('#insights-btn')!.addEventListener('click', onInsights);
  header.querySelector('#settings-btn')!.addEventListener('click', onSettings);

  return header;
}

function renderStatsBar(
  stats: ReturnType<typeof computeStats>,
  currency: string
): HTMLElement {
  const template = document.getElementById('tpl-stats-bar') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const statsBar = clone.firstElementChild as HTMLElement;
  statsBar.append(
    createStatCard('🎮', 'Games', `${stats.totalGames}`),
    createStatCard('⏱️', 'Main Story', `${formatHours(stats.totalMainHours)}`),
    createStatCard('⏱️+', 'Main + Extras', `${formatHours(stats.totalMainExtraHours)}`),
    createStatCard('💎', 'Completionist', `${formatHours(stats.totalCompletionistHours)}`),
    createStatCard('💰', 'Wishlist Value', `${formatCurrency(stats.totalValue, currency)}`),
    createStatCard('🏷️', 'Sale Savings', `${formatCurrency(stats.totalSavings, currency)}`),
  );
  return statsBar;
}

function renderFilterAndSort(
  state: AppState,
  onSort: (field: SortField) => void,
  onFilter: (category: string | null) => void
): HTMLElement {
  const template = document.getElementById('tpl-controls-container') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const container = clone.firstElementChild as HTMLElement;
  container.append(
    renderFilterControls(state, onFilter),
    renderSortControls(state, onSort)
  );
  return container;
}

function renderFilterControls(
  state: AppState,
  onFilter: (category: string | null) => void
): HTMLElement {
  const template = document.getElementById('tpl-filter-controls') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const controls = clone.firstElementChild as HTMLElement;

  const genres = new Set<string>();
  state.games.forEach(g => {
    if (g.genres) {
      g.genres.forEach(genre => genres.add(genre));
    }
  });

  const sortedGenres = Array.from(genres).sort();

  const select = controls.querySelector('select') as HTMLSelectElement;
  if (state.filterCategory) select.classList.add('active');

  sortedGenres.forEach(genre => {
    const opt = el('option', { value: genre }, genre);
    if (state.filterCategory === genre) {
      opt.setAttribute('selected', '');
    }
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    onFilter(select.value || null);
  });

  return controls;
}

function renderSortControls(
  state: AppState,
  onSort: (field: SortField) => void
): HTMLElement {
  const template = document.getElementById('tpl-sort-controls') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const controls = clone.firstElementChild as HTMLElement;

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'priority', label: 'Priority' },
    { value: 'dateAdded', label: 'Date Added' },
    { value: 'name', label: 'Name' },
    { value: 'hltbMain', label: 'Duration (Main)' },
    { value: 'hltbMainExtra', label: 'Duration (Main+)' },
    { value: 'hltbCompletionist', label: 'Duration (100%)' },
    { value: 'priceFinal', label: 'Price' },
    { value: 'discountPercent', label: 'Discount' },
  ];

  for (const opt of sortOptions) {
    const isActive = state.sort.field === opt.value;
    const btn = el(
      'button',
      {
        class: `sort-btn ${isActive ? 'active' : ''}`,
        'data-sort': opt.value,
      },
      opt.label
    );
    if (isActive) {
      btn.innerHTML += state.sort.direction === 'asc'
        ? ' <span class="sort-arrow">↑</span>'
        : ' <span class="sort-arrow">↓</span>';
    }
    btn.addEventListener('click', () => onSort(opt.value));
    controls.appendChild(btn);
  }
  return controls;
}

function renderMatchInfo(stats: ReturnType<typeof computeStats>): HTMLElement {
  const template = document.getElementById('tpl-match-info') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const matchInfo = clone.firstElementChild as HTMLElement;
  matchInfo.textContent = `HLTB data found for ${stats.gamesWithHltb} / ${stats.totalGames} games`;
  return matchInfo;
}

function renderGameGrid(sortedGames: GameEntry[], currency: string): HTMLElement {
  const grid = el('div', { class: 'game-grid' });
  for (const game of sortedGames) {
    grid.appendChild(createGameCard(game, currency));
  }
  return grid;
}

export function renderSettingsModal(
  onClearHLTB: () => void,
  onClearSteam: () => void,
  onHardReset: () => void,
  onRegionChange: (regionId: string) => void,
  onClose: () => void,
  currentRegionId: string
): void {
  const template = document.getElementById('tpl-settings-modal') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const overlay = clone.firstElementChild as HTMLElement;

  const close = () => {
    onClose();
    overlay.remove();
  };

  const select = overlay.querySelector('select') as HTMLSelectElement;
  Object.values(REGION_MAP).forEach(r => {
    select.append(el('option', { value: r.id, ...(currentRegionId === r.id ? { selected: '' } : {}) }, r.name));
  });
  select.addEventListener('change', () => onRegionChange(select.value));

  const hltbBtn = overlay.querySelector('.btn-clear-hltb') as HTMLButtonElement;
  hltbBtn.addEventListener('click', () => {
    onClearHLTB();
    hltbBtn.textContent = 'Cleared!';
    hltbBtn.style.opacity = '0.7';
    hltbBtn.disabled = true;
  });

  const steamBtn = overlay.querySelector('.btn-clear-steam') as HTMLButtonElement;
  steamBtn.addEventListener('click', () => {
    onClearSteam();
    steamBtn.textContent = 'Cleared!';
    steamBtn.style.opacity = '0.7';
    steamBtn.disabled = true;
  });

  const appBtn = overlay.querySelector('.btn-hard-reset') as HTMLButtonElement;
  appBtn.addEventListener('click', () => {
    if (confirm('Are you sure? This will wipe ALL cached data and settings.')) {
      onHardReset();
      overlay.remove();
    }
  });

  const closeBtn = overlay.querySelector('.btn-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', close);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
}

export function renderStatsModal(
  games: GameEntry[],
  currency: string,
  onClose: () => void
): void {
  const template = document.getElementById('tpl-stats-modal') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const overlay = clone.firstElementChild as HTMLElement;

  const close = () => {
    onClose();
    overlay.remove();
  };

  const data = prepareStats(games);

  const statsGrid = overlay.querySelector('.stats-summary-grid') as HTMLElement;
  statsGrid.append(
    createStatCard('⏳', 'Avg. Price/Hr', formatCurrency(data.insights.avgPricePerHour, currency)),
    createStatCard('📅', 'Oldest Entry', String(data.insights.oldestItemYear)),
    createStatCard('🏷️', 'Top Genre', data.insights.mostCommonGenre),
    createStatCard('⚡', 'Total Story', formatHours(data.insights.totalPotentialHours))
  );

  const durationChartEl = overlay.querySelector('#chart-duration') as HTMLElement;
  const priceChartEl = overlay.querySelector('#chart-price') as HTMLElement;
  const genreChartEl = overlay.querySelector('#chart-genre') as HTMLElement;
  const yearChartEl = overlay.querySelector('#chart-year') as HTMLElement;

  const closeBtn = overlay.querySelector('.btn-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', close);

  document.body.appendChild(overlay);

  // Initialize charts after appending to DOM
  setTimeout(() => {
    new Chart(durationChartEl, {
      title: 'Duration Distribution (Hrs)',
      data: data.durationDist,
      type: 'bar',
      height: 250,
      colors: ['#6366f1'],
      barOptions: { spaceRatio: 0.2 },
    });

    new Chart(priceChartEl, {
      title: `Price Distribution (${currency})`,
      data: data.priceDist,
      type: 'bar',
      height: 250,
      colors: ['#a78bfa'],
      barOptions: { spaceRatio: 0.2 },
    });

    new Chart(genreChartEl, {
      title: 'Popular Genres',
      data: data.genreDist,
      type: 'pie',
      height: 250,
      colors: ['#6366f1', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#fbbf24', '#ec4899', '#06b6d4'],
      truncateLegends: true,
    });

    new Chart(yearChartEl, {
      title: 'Wishlist Entry Timeline',
      data: data.yearDist,
      type: 'line',
      height: 250,
      colors: ['#34d399'],
      lineOptions: { hideDots: 0, regionFill: 1 },
    });
  }, 50);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// ── Components ───────────────────────────────────────────────

function createStatCard(icon: string, label: string, value: string): HTMLElement {
  const template = document.getElementById('tpl-stat-card') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const root = clone.firstElementChild as HTMLElement;
  root.querySelector('.stat-icon')!.textContent = icon;
  root.querySelector('.stat-value')!.textContent = value;
  root.querySelector('.stat-label')!.textContent = label;
  return root;
}

function createGameCard(game: GameEntry, currency: string): HTMLElement {
  const template = document.getElementById('tpl-game-card') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const card = clone.firstElementChild as HTMLElement;

  // Cover image
  const imgContainer = card.querySelector('.game-card-img') as HTMLElement;
  const img = imgContainer.querySelector('img') as HTMLImageElement;
  img.src = game.capsuleUrl;
  img.alt = game.name;

  // Discount badge
  if (game.discountPercent > 0) {
    const badge = el('div', { class: 'discount-badge' }, `-${game.discountPercent}%`);
    imgContainer.appendChild(badge);
  }

  // Info section
  const info = card.querySelector('.game-card-info') as HTMLElement;
  info.querySelector('.game-name')!.textContent = game.name;

  const dateStr = formatDate(game.dateAdded);
  info.querySelector('.game-date')!.textContent = `Added ${dateStr}`;

  // Genres
  const chips = info.querySelector('.genre-chips') as HTMLElement;
  if (game.genres && game.genres.length > 0) {
    game.genres.slice(0, 5).forEach(tag => {
      chips.appendChild(el('span', { class: 'genre-chip' }, tag));
    });
  } else {
    chips.remove();
  }

  // Price
  const priceRow = info.querySelector('.price-row') as HTMLElement;
  if (game.isFree) {
    priceRow.appendChild(el('span', { class: 'price-free' }, 'Free'));
  } else if (game.priceStatus === 'stale') {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      priceRow.appendChild(el('span', { class: 'price-original' }, formatCurrency(game.priceInitial, currency)));
    }
    priceRow.appendChild(el('span', { class: 'price-current stale' },
      `${formatCurrency(game.priceFinal || 0, currency)} (cached)`
    ));
  } else if (game.priceFinal !== null) {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      priceRow.appendChild(el('span', { class: 'price-original' }, formatCurrency(game.priceInitial, currency)));
    }
    priceRow.appendChild(el('span', {
      class: game.discountPercent > 0 ? 'price-sale' : 'price-current'
    }, formatCurrency(game.priceFinal, currency)));
  } else {
    priceRow.appendChild(el('span', { class: 'price-unknown' }, 'Price N/A'));
  }

  // HLTB bars
  const hltbContainer = info.querySelector('.hltb-container') as HTMLElement;
  if (game.hltbStatus === 'found') {
    const hltb = el('div', { class: 'hltb-section' });

    if (game.hltbMain !== null && game.hltbMain > 0) {
      hltb.appendChild(createDurationBar('Main', game.hltbMain, game, 'main'));
    }
    if (game.hltbMainExtra !== null && game.hltbMainExtra > 0) {
      hltb.appendChild(createDurationBar('Main+', game.hltbMainExtra, game, 'extra'));
    }
    if (game.hltbCompletionist !== null && game.hltbCompletionist > 0) {
      hltb.appendChild(createDurationBar('100%', game.hltbCompletionist, game, 'comp'));
    }

    hltbContainer.replaceWith(hltb);
  } else if (game.hltbStatus === 'not_found') {
    const noData = el('div', { class: 'hltb-no-data' }, 'No HLTB data');
    hltbContainer.replaceWith(noData);
  } else {
    const pending = el('div', { class: 'hltb-pending' }, 'Looking up...');
    hltbContainer.replaceWith(pending);
  }

  // Links
  const links = info.querySelector('.game-links') as HTMLElement;
  const steamLink = links.querySelector('.steam-link') as HTMLAnchorElement;
  steamLink.href = `https://store.steampowered.com/app/${game.appId}`;

  if (game.hltbId) {
    const hltbLink = el('a', {
      href: `https://howlongtobeat.com/game/${game.hltbId}`,
      target: '_blank',
      rel: 'noopener',
      class: 'game-link hltb-link',
    }, 'HLTB');
    links.appendChild(hltbLink);
  }

  return card;
}

function createDurationBar(
  label: string,
  hours: number,
  _game: GameEntry,
  type: 'main' | 'extra' | 'comp'
): HTMLElement {
  const template = document.getElementById('tpl-duration-bar') as HTMLTemplateElement;
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const root = clone.firstElementChild as HTMLElement;

  root.querySelector('.duration-label')!.textContent = label;

  const bar = root.querySelector('.duration-bar') as HTMLElement;
  bar.classList.add(`duration-bar-${type}`);
  // Max bar width based on 200 hours
  const pct = Math.min((hours / 200) * 100, 100);
  bar.style.width = `${pct}%`;

  const hoursEl = root.querySelector('.duration-hours') as HTMLElement;
  hoursEl.setAttribute('data-value', hours.toString());
  hoursEl.textContent = formatHours(hours);

  return root;
}

// ── Formatting ───────────────────────────────────────────────

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  // Steam timestamps are in seconds
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(timestamp * 1000));
}

function formatHours(hours: number): string {
  if (hours === 0) return '—';
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;

  let wholeHours = Math.floor(hours);
  let minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 60) {
    wholeHours++;
    minutes = 0;
  }

  if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h${minutes}m`;
  }
}

function formatCurrency(amount: number, currency = 'USD'): string {
  if (amount === 0) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch {
    const symbol = currency === 'EUR' ? '€' : '$';
    return `${symbol}${amount.toFixed(2)}`;
  }
}
