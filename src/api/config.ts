/**
 * Base URL for the CORS proxy (Cloudflare Worker).
 * In development, you can override this via the VITE_PROXY_BASE env var.
 * In production, point this to your deployed Cloudflare Worker URL.
 */
export const PROXY_BASE: string =
  import.meta.env.VITE_PROXY_BASE || 'https://howlong-proxy.tom-1bb.workers.dev';
