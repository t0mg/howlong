import type { AppState } from '../../api/types';
import { t } from '../i18n';
import { html } from '../template';

// ── DOM Helpers ──────────────────────────────────────────────

const $ = (s: string) => document.querySelector(s) as HTMLElement;

// ── Templates ────────────────────────────────────────────────

const TPL_LOADING = `
  <div class="loading-container">
    <div class="spinner"></div>
    <p class="loading-message" data-ref="message"></p>
    <div class="progress-area" data-ref="progressArea">
      <div class="progress-bar">
        <div class="progress-fill" data-ref="progressFill"></div>
      </div>
      <p class="progress-label" data-ref="progressLabel"></p>
    </div>
    <div class="throttled-area" data-ref="throttledArea"></div>
    <div class="actions-area" data-ref="actionsArea"></div>
  </div>`;

const TPL_THROTTLED = `
  <div class="throttled-alert">
    <span class="throttled-icon">⚠️</span>
    <div class="throttled-text">
      <span class="throttled-title" data-t="loading_throttled_title"></span>
      <span class="throttled-timer" data-ref="timer"></span>
    </div>
  </div>`;

// ── Loading State ────────────────────────────────────────────

export function renderLoading(state: AppState): void {
  const app = $('#app');
  let container = app.querySelector('.loading-container') as HTMLElement;

  if (!container) {
    app.innerHTML = '';
    const { element } = html(TPL_LOADING);
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
      const { element, refs } = html<{ timer: HTMLElement }>(TPL_THROTTLED);
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
