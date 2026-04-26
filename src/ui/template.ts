import { t } from './i18n';

export interface ViewResult<T = Record<string, HTMLElement>> {
  element: HTMLElement;
  refs: T;
}

// ── Shared SVG Icons ─────────────────────────────────────────

export const ICON_SETTINGS = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

export const ICON_INSIGHTS = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"/></svg>`;

export const ICON_LUCKY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/></svg>`;

export const ICON_HIDE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

export const ICON_SHOW = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

// ── Shared Template Fragments ────────────────────────────────

export const TPL_STAT_CARD = `
  <div class="stat-card">
    <span class="stat-icon" data-ref="icon"></span>
    <span class="stat-value" data-ref="value"></span>
    <span class="stat-label" data-ref="label"></span>
  </div>`;

/**
 * Creates a view from an HTML template string.
 * Processes data-t (translations), data-t-placeholder, data-t-title
 * attributes, and collects data-ref references.
 */
export function html<T = Record<string, HTMLElement>>(templateStr: string): ViewResult<T> {
  const tpl = document.createElement('template');
  tpl.innerHTML = templateStr.trim();
  const fragment = tpl.content.cloneNode(true) as DocumentFragment;

  const refs = {} as any;
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);

  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement;

    // Translation of content
    const tKey = el.getAttribute('data-t');
    if (tKey) {
      el.innerHTML = t(tKey);
    }

    // Translation of attributes
    if (el.hasAttribute('data-t-placeholder')) {
      el.setAttribute('placeholder', t(el.getAttribute('data-t-placeholder')!));
    }
    if (el.hasAttribute('data-t-title')) {
      el.setAttribute('title', t(el.getAttribute('data-t-title')!));
    }

    // Collect references
    const refKey = el.getAttribute('data-ref');
    if (refKey) {
      refs[refKey] = el;
    }
  }

  const element = fragment.firstElementChild as HTMLElement;
  return { element, refs };
}
