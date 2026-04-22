import { html } from '../template';

// ── DOM Helpers ──────────────────────────────────────────────

const $ = (s: string) => document.querySelector(s) as HTMLElement;

// ── Template ─────────────────────────────────────────────────

const TPL_ERROR = `
  <div class="error-container">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--danger)" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </div>
    <p class="error-message" data-ref="message"></p>
    <button class="btn-primary" data-ref="retryBtn" data-t="error_try_again"></button>
  </div>`;

// ── Error State ──────────────────────────────────────────────

export function renderError(message: string, onRetry: () => void): void {
  const app = $('#app');
  app.innerHTML = '';

  const { element, refs } = html<{ message: HTMLElement; retryBtn: HTMLButtonElement }>(TPL_ERROR);
  refs.message.textContent = message;
  refs.retryBtn.addEventListener('click', onRetry);

  app.appendChild(element);
}
