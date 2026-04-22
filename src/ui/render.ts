// ── UI Render Barrel ─────────────────────────────────────────
// Re-exports all public view functions so existing imports
// from main.ts continue to work unchanged.

export { renderLanding } from './views/landing';
export { renderLoading } from './views/loading';
export { renderError } from './views/error';
export { renderDashboard } from './views/dashboard';
export { renderSettingsModal, renderStatsModal, renderLuckyModal } from './views/modals';
