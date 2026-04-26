import type { GameEntry } from '../../api/types';
import { REGION_MAP } from '../../api/types';
import { prepareStats } from '../stats';
import { t } from '../i18n';
import { formatHours, formatCurrency } from '../format';
import { html, TPL_STAT_CARD } from '../template';
import { Chart } from 'frappe-charts';
import { createGameCard } from './game-card';

// ── Templates ────────────────────────────────────────────────

const TPL_SETTINGS_MODAL = `
  <div class="modal-overlay" data-ref="overlay">
    <div class="modal-card">
      <h2 class="modal-title" data-t="settings_title"></h2>
      <p class="modal-desc" data-t="settings_desc"></p>

      <div class="settings-content">
        <div class="settings-item">
          <div class="settings-item-info">
            <span class="settings-item-label" data-t="settings_region_label"></span>
            <p class="settings-item-desc" data-t="settings_region_desc"></p>
          </div>
          <div class="settings-item-action" data-ref="regionContainer"></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-info">
            <span class="settings-item-label" data-t="settings_lang_label"></span>
            <p class="settings-item-desc" data-t="settings_lang_desc"></p>
          </div>
          <div class="settings-item-action" data-ref="langContainer"></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-info">
            <span class="settings-item-label" data-t="settings_clear_hltb_label"></span>
            <p class="settings-item-desc" data-t="settings_clear_hltb_desc"></p>
          </div>
          <div class="settings-item-action" data-ref="hltbContainer"></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-info">
            <span class="settings-item-label" data-t="settings_clear_steam_label"></span>
            <p class="settings-item-desc" data-t="settings_clear_steam_desc"></p>
          </div>
          <div class="settings-item-action" data-ref="steamContainer"></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-info">
            <span class="settings-item-label" data-t="settings_clear_hidden_label"></span>
            <p class="settings-item-desc" data-t="settings_clear_hidden_desc"></p>
          </div>
          <div class="settings-item-action" data-ref="hiddenContainer"></div>
        </div>
        <div class="settings-item">
          <div class="settings-item-info">
            <span class="settings-item-label" data-t="settings_hard_reset_label"></span>
            <p class="settings-item-desc" data-t="settings_hard_reset_desc"></p>
          </div>
          <div class="settings-item-action" data-ref="resetContainer"></div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" data-ref="closeBtn" data-t="settings_close"></button>
      </div>
    </div>
  </div>`;

const TPL_INSIGHTS_MODAL = `
  <div class="modal-overlay" data-ref="overlay">
    <div class="modal-card modal-card-wide">
      <h2 class="modal-title" data-t="insights_title"></h2>
      <p class="modal-desc" data-t="insights_desc"></p>

      <div class="insights-content">
        <div class="stats-summary-grid" data-ref="statsGrid"></div>
        <div class="charts-container">
          <div class="chart-box" id="chart-duration"></div>
          <div class="chart-box" id="chart-price"></div>
          <div class="chart-box" id="chart-year"></div>
          <div class="chart-box" id="chart-genre"></div>
          <div class="chart-box" id="chart-store"></div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" data-ref="closeBtn" data-t="settings_close"></button>
      </div>
    </div>
  </div>`;

const TPL_LUCKY_MODAL = `
  <div class="modal-overlay" data-ref="overlay">
    <div class="modal-card">
      <h2 class="modal-title" data-t="lucky_title"></h2>
      <p class="modal-desc" data-t="lucky_desc"></p>

      <div class="lucky-content" data-ref="contentContainer"></div>

      <div class="modal-footer lucky-actions" data-ref="refineActions">
        <button class="btn-primary btn-action-secondary" data-ref="btnTooLong" data-t="lucky_too_long"></button>
        <button class="btn-primary btn-action-secondary" data-ref="btnNotInMood" data-t="lucky_not_in_mood"></button>
        <button class="btn-primary btn-action-secondary" data-ref="btnTooExpensive" data-t="lucky_too_expensive"></button>
      </div>

      <div class="modal-footer modal-footer--flush">
        <button class="btn-ghost" data-ref="closeBtn" data-t="lucky_ok"></button>
      </div>
    </div>
  </div>`;

const TPL_CONFIRM_MODAL = `
  <div class="modal-overlay" data-ref="overlay">
    <div class="modal-card modal-card-small">
      <h2 class="modal-title" data-ref="title"></h2>
      <p class="modal-desc" data-ref="desc"></p>

      <div class="modal-footer modal-footer--split">
        <button class="btn-ghost" data-ref="cancelBtn"></button>
        <button class="btn-primary btn-action-danger" data-ref="confirmBtn"></button>
      </div>
    </div>
  </div>`;

// ── Confirm Modal ────────────────────────────────────────────

export function renderConfirmModal(
  title: string,
  desc: string,
  confirmText: string,
  cancelText: string,
  onConfirm: () => void
): void {
  const { element, refs } = html<{
    overlay: HTMLElement;
    title: HTMLElement;
    desc: HTMLElement;
    cancelBtn: HTMLButtonElement;
    confirmBtn: HTMLButtonElement;
  }>(TPL_CONFIRM_MODAL);

  refs.title.textContent = title;
  refs.desc.textContent = desc;
  refs.cancelBtn.textContent = cancelText;
  refs.confirmBtn.textContent = confirmText;

  const close = () => {
    element.remove();
  };

  refs.cancelBtn.addEventListener('click', close);
  refs.overlay.addEventListener('click', (e) => { if (e.target === refs.overlay) close(); });

  refs.confirmBtn.addEventListener('click', () => {
    onConfirm();
    close();
  });

  document.body.appendChild(element);
}

// ── Settings Modal ───────────────────────────────────────────

export function renderSettingsModal(
  onClearHLTB: () => void,
  onClearSteam: () => void,
  onClearHidden: () => void,
  onHardReset: () => void,
  onRegionChange: (regionId: string) => void,
  onLocaleChange: (localeId: string) => void,
  onClose: () => void,
  currentRegionId: string,
  currentLocaleId: string
): void {
  const { element, refs } = html<{
    overlay: HTMLElement;
    closeBtn: HTMLButtonElement;
    regionContainer: HTMLElement;
    langContainer: HTMLElement;
    hltbContainer: HTMLElement;
    steamContainer: HTMLElement;
    hiddenContainer: HTMLElement;
    resetContainer: HTMLElement;
  }>(TPL_SETTINGS_MODAL);

  const close = () => {
    onClose();
    element.remove();
  };

  refs.closeBtn.addEventListener('click', close);
  refs.overlay.addEventListener('click', (e) => { if (e.target === refs.overlay) close(); });

  // Region Selection
  const select = document.createElement('select');
  select.className = 'btn-ghost settings-select';
  Object.values(REGION_MAP).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    if (currentRegionId === r.id) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onRegionChange(select.value));
  refs.regionContainer.appendChild(select);

  // Language Selection
  import('../i18n').then(({ LOCALE_NAMES }) => {
    const langSelect = document.createElement('select');
    langSelect.className = 'btn-ghost settings-select';
    Object.entries(LOCALE_NAMES).forEach(([id, name]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name as string;
      if (currentLocaleId === id) opt.selected = true;
      langSelect.appendChild(opt);
    });
    langSelect.addEventListener('change', () => onLocaleChange(langSelect.value));
    refs.langContainer.appendChild(langSelect);
  });

  // Action Buttons
  const hltbBtn = createActionBtn(t('settings_clear_hltb_btn'), 'btn-action-secondary', () => {
    onClearHLTB();
    hltbBtn.textContent = t('settings_cleared');
    hltbBtn.disabled = true;
    hltbBtn.classList.add('btn-action-disabled');
  });
  refs.hltbContainer.appendChild(hltbBtn);

  const steamBtn = createActionBtn(t('settings_clear_steam_btn'), 'btn-action-secondary', () => {
    onClearSteam();
    steamBtn.textContent = t('settings_cleared');
    steamBtn.disabled = true;
    steamBtn.classList.add('btn-action-disabled');
  });
  refs.steamContainer.appendChild(steamBtn);

  const hiddenBtn = createActionBtn(t('settings_clear_hidden_btn'), 'btn-action-secondary', () => {
    onClearHidden();
    hiddenBtn.textContent = t('settings_cleared');
    hiddenBtn.disabled = true;
    hiddenBtn.classList.add('btn-action-disabled');
  });
  refs.hiddenContainer.appendChild(hiddenBtn);

  const resetBtn = createActionBtn(t('settings_hard_reset_btn'), 'btn-action-danger', () => {
    if (confirm(t('settings_hard_reset_confirm'))) {
      onHardReset();
      element.remove();
    }
  });
  refs.resetContainer.appendChild(resetBtn);

  document.body.appendChild(element);
}

function createActionBtn(text: string, className: string, onClick: () => void) {
  const btn = document.createElement('button');
  btn.className = `btn-primary ${className}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

// ── Insights Modal ───────────────────────────────────────────

export function renderStatsModal(
  games: GameEntry[],
  currency: string,
  onClose: () => void
): void {
  const { element, refs } = html<{
    overlay: HTMLElement;
    closeBtn: HTMLButtonElement;
    statsGrid: HTMLElement;
  }>(TPL_INSIGHTS_MODAL);

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
    const { element: card, refs: cr } = html<{ icon: HTMLElement; value: HTMLElement; label: HTMLElement }>(TPL_STAT_CARD);
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

    if (data.storeCompare.datasets[0].values.some(v => v > 0)) {
      new Chart('#chart-store', { title: t('insights_chart_store'), data: data.storeCompare, type: 'pie', height: 250, colors: ['#1a9fff', '#86328a', '#929292'], truncateLegends: true });
    }
  }, 50);
}

// ── Lucky Modal ──────────────────────────────────────────────

export function renderLuckyModal(
  games: GameEntry[],
  currency: string,
  onClose: () => void
): void {
  const { element, refs } = html<{
    overlay: HTMLElement;
    closeBtn: HTMLButtonElement;
    contentContainer: HTMLElement;
    refineActions: HTMLElement;
    btnTooLong: HTMLButtonElement;
    btnNotInMood: HTMLButtonElement;
    btnTooExpensive: HTMLButtonElement;
  }>(TPL_LUCKY_MODAL);

  let pool = games.filter(g => !g.isComingSoon && !g.isUnavailable);
  let currentGame: GameEntry | null = null;

  const close = () => {
    onClose();
    element.remove();
  };

  refs.closeBtn.addEventListener('click', close);
  refs.overlay.addEventListener('click', (e) => { if (e.target === refs.overlay) close(); });

  const getDuration = (game: GameEntry) => game.hltbMain ?? game.hltbMainExtra ?? game.hltbCompletionist;
  
  const getPrice = (game: GameEntry) => {
    const steamPrice = game.isFree ? 0 : game.priceFinal;
    const gogPrice = game.gogPriceFinal;
    if (steamPrice !== null && gogPrice !== null) return Math.min(steamPrice, gogPrice);
    if (steamPrice !== null) return steamPrice;
    if (gogPrice !== null) return gogPrice;
    return null;
  };

  const draw = () => {
    refs.contentContainer.innerHTML = '';
    
    if (pool.length === 0) {
      refs.contentContainer.innerHTML = `<div class="lucky-empty-state">${t('lucky_empty')}</div>`;
      refs.refineActions.style.display = 'none';
      return;
    }

    const idx = Math.floor(Math.random() * pool.length);
    currentGame = pool.splice(idx, 1)[0];

    const card = createGameCard(currentGame, currency);
    card.classList.add('lucky-card');
    
    refs.contentContainer.appendChild(card);

    if (card.animate) {
      card.animate([
        { opacity: 0, transform: 'scale(0.95)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 300, easing: 'ease-out' });
    }
  };

  refs.btnTooLong.addEventListener('click', () => {
    if (!currentGame) return;
    const curDuration = getDuration(currentGame);
    if (curDuration === null) return;
    pool = pool.filter(g => {
      const gDuration = getDuration(g);
      return gDuration !== null && gDuration < curDuration;
    });
    draw();
  });

  refs.btnTooExpensive.addEventListener('click', () => {
    if (!currentGame) return;
    const curPrice = getPrice(currentGame);
    if (curPrice === null) return;
    pool = pool.filter(g => {
      const gPrice = getPrice(g);
      return gPrice !== null && gPrice < curPrice;
    });
    draw();
  });

  refs.btnNotInMood.addEventListener('click', () => {
    if (!currentGame) return;
    const currentGenres = (currentGame.genres || []).join(',');
    pool = pool.filter(g => (g.genres || []).join(',') !== currentGenres);
    draw();
  });

  document.body.appendChild(element);
  draw();
}
