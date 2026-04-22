import { getCurrentLocale } from './i18n';

// ── Formatting Utilities ─────────────────────────────────────
// Pure functions shared across all view modules.

export function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat(getCurrentLocale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(timestamp * 1000));
}

export function formatHours(hours: number): string {
  if (hours === 0) return '—';
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;
  let wholeHours = Math.floor(hours);
  let minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 60) { wholeHours++; minutes = 0; }
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h${minutes}m`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  if (amount === 0) return '—';
  try {
    return new Intl.NumberFormat(getCurrentLocale(), { style: 'currency', currency: currency }).format(amount);
  } catch {
    const symbol = currency === 'EUR' ? '€' : '$';
    return `${symbol}${amount.toFixed(2)}`;
  }
}
