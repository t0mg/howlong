import type { AppState, GameEntry, SortField } from '../api/types';
import { REGION_MAP } from '../api/types';
import { sortGames, computeStats } from './sort';

const SETTINGS_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`;

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
  onSettings: () => void
): void {
  const app = $('#app');
  app.innerHTML = '';

  const container = el('div', { class: 'landing' });

  // Settings Gear
  const settingsBtn = el('button', { class: 'btn-ghost landing-settings', id: 'settings-btn', title: 'Settings' });
  settingsBtn.innerHTML = SETTINGS_ICON;
  settingsBtn.addEventListener('click', onSettings);
  container.appendChild(settingsBtn);

  const logo = el('div', { class: 'landing-logo' });
  logo.innerHTML = `
    <svg viewBox="0 0 64 64" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="url(#g1)" stroke-width="3" fill="none"/>
      <path d="M32 14 A18 18 0 1 1 14 32" stroke="url(#g2)" stroke-width="3" stroke-linecap="round" fill="none"/>
      <line x1="32" y1="32" x2="32" y2="20" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="32" y1="32" x2="42" y2="32" stroke="var(--accent-secondary)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="2.5" fill="var(--accent)"/>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stop-color="var(--accent)"/>
          <stop offset="100%" stop-color="var(--accent-secondary)"/>
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stop-color="var(--accent-secondary)"/>
          <stop offset="100%" stop-color="var(--accent)"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  const title = el('h1', { class: 'landing-title' }, 'How Long to Clear');
  const subtitle = el('p', { class: 'landing-subtitle' },
    'Cross-reference your Steam wishlist with HowLongToBeat — see how many hours (and dollars) stand between you and gaming bliss.'
  );

  const form = el('form', { class: 'landing-form', id: 'steam-form' });
  const inputGroup = el('div', { class: 'input-group' });

  const input = el('input', {
    type: 'text',
    id: 'steam-id-input',
    placeholder: 'Enter your Steam64 ID (e.g. 76561198012345678)',
    autocomplete: 'off',
    spellcheck: 'false',
    required: '',
  });

  const btn = el('button', { type: 'submit', id: 'fetch-btn', class: 'btn-primary' });
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <span>Fetch Wishlist</span>
  `;

  inputGroup.append(input, btn);
  form.appendChild(inputGroup);

  const helpText = el('p', { class: 'help-text' });
  helpText.innerHTML = `Your Steam profile & wishlist must be <strong>public</strong>. Find your Steam64 ID at <a href="https://steamid.io" target="_blank" rel="noopener">steamid.io</a>.`;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (input as HTMLInputElement).value.trim();
    if (val) onSubmit(val);
  });

  // Restore last used Steam ID
  const lastId = localStorage.getItem('howlong_last_steam_id');
  if (lastId) (input as HTMLInputElement).value = lastId;

  container.append(logo, title, subtitle, form, helpText);
  app.appendChild(container);
  (input as HTMLInputElement).focus();
}

// ── Loading State ────────────────────────────────────────────

export function renderLoading(state: AppState): void {
  const app = $('#app');
  let container = app.querySelector('.loading-container') as HTMLElement;

  if (!container) {
    app.innerHTML = '';
    container = el('div', { class: 'loading-container' });
    container.append(
      el('div', { class: 'spinner' }),
      el('p', { class: 'loading-message' }),
      el('div', { class: 'progress-area', style: 'width: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;' }),
      el('div', { class: 'throttled-area' }),
      el('div', { class: 'actions-area' })
    );
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
      progressArea.innerHTML = '';
      progress = el('div', { class: 'progress-bar' });
      progress.appendChild(el('div', { class: 'progress-fill' }));
      label = el('p', { class: 'progress-label' });
      progressArea.append(progress, label);
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
      throttledArea.innerHTML = '';
      alert = el('div', { class: 'throttled-alert' });
      alert.append(
        el('span', { class: 'throttled-icon' }, '⚠️'),
        el('div', { class: 'throttled-text' },
          el('span', { class: 'throttled-title' }, 'Steam is throttling requests'),
          el('span', { class: 'throttled-timer' })
        )
      );
      throttledArea.appendChild(alert);
    }
    alert.querySelector('.throttled-timer')!.textContent = `Waiting ${timeStr}...`;
  } else {
    throttledArea.innerHTML = '';
  }

  const actionsArea = container.querySelector('.actions-area')!;
  if (state.onStop) {
    if (!actionsArea.querySelector('.btn-stop')) {
      actionsArea.innerHTML = '';
      const stopBtn = el('button', { class: 'btn-stop' }, 'Stop & Show Results');
      stopBtn.addEventListener('click', () => {
        if (state.onStop) state.onStop();
      });
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
  onReset: () => void,
  onSettings: () => void
): void {
  const app = $('#app');
  app.innerHTML = '';

  const sorted = sortGames(state.games, state.sort.field, state.sort.direction);
  const stats = computeStats(sorted);
  const region = REGION_MAP[state.regionId] || REGION_MAP.us;
  const currency = region.currency;

  // ─ Header
  const header = el('header', { class: 'dashboard-header' });
  const headerLeft = el('div', { class: 'header-left' });
  const headerTitle = el('h1', { class: 'header-title' }, 'How Long to Clear');
  const headerSteamId = el('span', { class: 'header-steam-id' }, `Steam: ${state.steamId}`);
  headerLeft.append(headerTitle, headerSteamId);

  const resetBtn = el('button', { class: 'btn-ghost', id: 'reset-btn' }, '← New Lookup');
  resetBtn.addEventListener('click', onReset);

  const settingsBtn = el('button', { class: 'btn-ghost', id: 'settings-btn', title: 'Settings' });
  settingsBtn.innerHTML = SETTINGS_ICON;

  settingsBtn.addEventListener('click', onSettings);

  const actions = el('div', { class: 'header-actions' }, resetBtn, settingsBtn);
  header.append(headerLeft, actions);

  // ─ Stats Bar
  const statsBar = el('div', { class: 'stats-bar' });
  statsBar.append(
    createStatCard('🎮', 'Games', `${stats.totalGames}`),
    createStatCard('⏱️', 'Main Story', `${formatHours(stats.totalMainHours)}`),
    createStatCard('⏱️+', 'Main + Extras', `${formatHours(stats.totalMainExtraHours)}`),
    createStatCard('💎', 'Completionist', `${formatHours(stats.totalCompletionistHours)}`),
    createStatCard('💰', 'Wishlist Value', `${formatCurrency(stats.totalValue, currency)}`),
    createStatCard('🏷️', 'Sale Savings', `${formatCurrency(stats.totalSavings, currency)}`),
  );

  // ─ Sort Controls
  const controls = el('div', { class: 'sort-controls' });
  const sortLabel = el('span', { class: 'sort-label' }, 'Sort by:');
  controls.appendChild(sortLabel);

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'priority', label: 'Priority' },
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

  // ─ HLTB match counter
  const matchInfo = el('div', { class: 'match-info' });
  matchInfo.textContent = `HLTB data found for ${stats.gamesWithHltb} / ${stats.totalGames} games`;

  // ─ Game Grid
  const grid = el('div', { class: 'game-grid' });
  for (const game of sorted) {
    grid.appendChild(createGameCard(game, currency));
  }

  app.append(header, statsBar, controls, matchInfo, grid);
}

export function renderSettingsModal(
  onClearCache: () => void,
  onClearAppCache: () => void,
  onRegionChange: (regionId: string) => void,
  currentRegionId: string
): void {
  const overlay = el('div', { class: 'modal-overlay' });
  const card = el('div', { class: 'modal-card' });

  const title = el('h2', { class: 'modal-title' }, 'Settings');
  const desc = el('p', { class: 'modal-desc' }, 'Manage your application preferences and local data.');

  // Region Selection
  const regionSection = el('div', { class: 'settings-item' });
  const regionInfo = el('div', { class: 'settings-item-info' });
  const regionLabel = el('span', { class: 'settings-item-label' }, 'Steam Store Region');
  const regionDesc = el('p', { class: 'settings-item-desc' }, 'Select region for accurate local prices. Requires new lookup.');
  regionInfo.append(regionLabel, regionDesc);

  const select = el('select', { class: 'btn-ghost', style: 'padding: 0.5rem;' }) as HTMLSelectElement;
  Object.values(REGION_MAP).forEach(r => {
    select.append(el('option', { value: r.id, ...(currentRegionId === r.id ? { selected: '' } : {}) }, r.name));
  });

  select.addEventListener('change', () => onRegionChange(select.value));

  regionSection.append(regionInfo, select);

  // HLTB Cache
  const hltbSection = el('div', { class: 'settings-item' });
  const hltbInfo = el('div', { class: 'settings-item-info' });
  const hltbLabel = el('span', { class: 'settings-item-label' }, 'Clear HLTB Cache');
  const hltbDesc = el('p', { class: 'settings-item-desc' }, 'Remove stored game durations. Results will be re-fetched next time.');
  hltbInfo.append(hltbLabel, hltbDesc);

  const hltbBtn = el('button', { class: 'btn-primary', style: 'background: var(--danger)' }, 'Clear Data');
  hltbBtn.addEventListener('click', () => {
    onClearCache();
    overlay.remove();
  });
  hltbSection.append(hltbInfo, hltbBtn);

  // App Cache (Service Worker)
  const appSection = el('div', { class: 'settings-item' });
  const appInfo = el('div', { class: 'settings-item-info' });
  const appLabel = el('span', { class: 'settings-item-label' }, 'App Cache (Hard Reset)');
  const appDesc = el('p', { class: 'settings-item-desc' }, 'Unregister Service Worker and clear all internal caches. Page will reload.');
  appInfo.append(appLabel, appDesc);

  const appBtn = el('button', { class: 'btn-primary', style: 'background: var(--accent)' }, 'Hard Reset');
  appBtn.addEventListener('click', () => {
    onClearAppCache();
    overlay.remove();
  });
  appSection.append(appInfo, appBtn);

  const footer = el('div', { class: 'modal-footer' });
  const closeBtn = el('button', { class: 'btn-ghost' }, 'Close');
  closeBtn.addEventListener('click', () => overlay.remove());
  footer.append(closeBtn);

  card.append(title, desc, regionSection, hltbSection, appSection, footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ── Components ───────────────────────────────────────────────

function createStatCard(icon: string, label: string, value: string): HTMLElement {
  const card = el('div', { class: 'stat-card' });
  const iconEl = el('span', { class: 'stat-icon' }, icon);
  const valEl = el('span', { class: 'stat-value' }, value);
  const labelEl = el('span', { class: 'stat-label' }, label);
  card.append(iconEl, valEl, labelEl);
  return card;
}

function createGameCard(game: GameEntry, currency: string): HTMLElement {
  const card = el('div', { class: 'game-card' });

  // Cover image
  const imgContainer = el('div', { class: 'game-card-img' });
  const img = el('img', {
    src: game.capsuleUrl,
    alt: game.name,
    loading: 'lazy',
    width: '460',
    height: '215',
  });
  imgContainer.appendChild(img);

  // Discount badge
  if (game.discountPercent > 0) {
    const badge = el('div', { class: 'discount-badge' }, `-${game.discountPercent}%`);
    imgContainer.appendChild(badge);
  }

  card.appendChild(imgContainer);

  // Info section
  const info = el('div', { class: 'game-card-info' });

  const name = el('h3', { class: 'game-name' }, game.name);
  info.appendChild(name);

  // Price
  const priceRow = el('div', { class: 'price-row' });
  if (game.isFree) {
    priceRow.appendChild(el('span', { class: 'price-free' }, 'Free to Play'));
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
  info.appendChild(priceRow);

  // HLTB bars
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

    info.appendChild(hltb);
  } else if (game.hltbStatus === 'not_found') {
    const noData = el('div', { class: 'hltb-no-data' }, 'No HLTB data');
    info.appendChild(noData);
  } else {
    const pending = el('div', { class: 'hltb-pending' }, 'Looking up...');
    info.appendChild(pending);
  }

  // Links
  const links = el('div', { class: 'game-links' });

  const steamLink = el('a', {
    href: `https://store.steampowered.com/app/${game.appId}`,
    target: '_blank',
    rel: 'noopener',
    class: 'game-link steam-link',
  }, 'Steam');

  links.appendChild(steamLink);

  if (game.hltbId) {
    const hltbLink = el('a', {
      href: `https://howlongtobeat.com/game/${game.hltbId}`,
      target: '_blank',
      rel: 'noopener',
      class: 'game-link hltb-link',
    }, 'HLTB');
    links.appendChild(hltbLink);
  }

  info.appendChild(links);
  card.appendChild(info);

  return card;
}

function createDurationBar(
  label: string,
  hours: number,
  _game: GameEntry,
  type: 'main' | 'extra' | 'comp'
): HTMLElement {
  const row = el('div', { class: 'duration-row' });
  const labelEl = el('span', { class: 'duration-label' }, label);
  const barContainer = el('div', { class: 'duration-bar-container' });
  const bar = el('div', { class: `duration-bar duration-bar-${type}` });

  // Max bar width based on 200 hours
  const pct = Math.min((hours / 200) * 100, 100);
  bar.style.width = `${pct}%`;

  barContainer.appendChild(bar);

  const hoursEl = el('span', { class: 'duration-hours' }, `${hours}h`);
  row.append(labelEl, barContainer, hoursEl);
  return row;
}

// ── Formatting ───────────────────────────────────────────────

function formatHours(hours: number): string {
  if (hours === 0) return '—';
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;
  return `${hours} hrs`;
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
