import { html, ICON_SETTINGS } from '../template';

// ── DOM Helpers ──────────────────────────────────────────────

const $ = (s: string) => document.querySelector(s) as HTMLElement;

// ── Template ─────────────────────────────────────────────────

const TPL_LANDING = `
  <div class="landing">
    <button class="btn-ghost landing-settings" data-ref="settingsBtn" data-t-title="settings_title">
      ${ICON_SETTINGS}
    </button>
    <div class="landing-logo">
      <svg viewBox="0 0 64 64" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" stroke="url(#g1)" stroke-width="3" fill="none" />
        <path d="M32 14 A18 18 0 1 1 14 32" stroke="url(#g2)" stroke-width="3" stroke-linecap="round" fill="none" />
        <line x1="32" y1="32" x2="32" y2="20" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" />
        <line x1="32" y1="32" x2="42" y2="32" stroke="var(--accent-secondary)" stroke-width="2" stroke-linecap="round" />
        <circle cx="32" cy="32" r="2.5" fill="var(--accent)" />
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stop-color="var(--accent)" />
            <stop offset="100%" stop-color="var(--accent-secondary)" />
          </linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stop-color="var(--accent-secondary)" />
            <stop offset="100%" stop-color="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h1 class="landing-title" data-t="app_title"></h1>
    <p class="landing-subtitle" data-t="app_subtitle"></p>
    <form class="landing-form" data-ref="form">
      <div class="input-group">
        <input type="text" data-ref="input" data-t-placeholder="steam_id_placeholder" autocomplete="off" spellcheck="false" required>
        <button type="submit" class="btn-primary" data-ref="submitBtn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span data-t="fetch_wishlist"></span>
        </button>
      </div>
    </form>
    <p class="help-text" data-t="landing_help"></p>
    <p class="help-text" data-t="landing_disclaimer"></p>
  </div>`;

// ── Landing Page ─────────────────────────────────────────────

export function renderLanding(
  onSubmit: (steamId: string) => void,
  onSettings: () => void,
  initialSteamId = ''
): void {
  const app = $('#app');
  app.innerHTML = '';

  const { element, refs } = html<{
    settingsBtn: HTMLButtonElement;
    form: HTMLFormElement;
    input: HTMLInputElement;
  }>(TPL_LANDING);

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
