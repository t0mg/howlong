export interface SteamWishlistResponse {
  response: {
    items?: SteamWishlistItem[];
  };
}

export interface SteamWishlistItem {
  appid: number;
  priority: number;
  date_added: number;
}

export interface SteamAppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      name: string;
      header_image: string;
      price_overview?: SteamPriceOverview;
      release_date?: {
        date: string;
      };
      type: string;
    };
  };
}

export interface SteamPriceOverview {
  currency: string;
  initial: number;      // in cents
  final: number;        // in cents
  discount_percent: number;
  initial_formatted: string;
  final_formatted: string;
}

// ── HLTB Types ───────────────────────────────────────────────

export interface HLTBResult {
  id: string;
  name: string;
  imageUrl: string;
  gameplayMain: number;        // hours
  gameplayMainExtra: number;   // hours
  gameplayCompletionist: number; // hours
  similarity: number;
}

// ── App Domain Types ─────────────────────────────────────────

export interface GameEntry {
  appId: string;
  name: string;
  capsuleUrl: string;
  releaseDate: string;
  reviewDesc: string;
  reviewPercent: number;
  tags: string[];
  isFree: boolean;
  priority: number;

  // Price (may be null if free or not fetched)
  priceCurrency: string | null;
  priceInitial: number | null;   // dollars/euros
  priceFinal: number | null;     // dollars/euros
  discountPercent: number;

  // HLTB (may be null if not found)
  hltbId: string | null;
  hltbMain: number | null;       // hours
  hltbMainExtra: number | null;  // hours
  hltbCompletionist: number | null; // hours

  // Status
  hltbStatus: 'pending' | 'found' | 'not_found';
  priceStatus: 'pending' | 'found' | 'not_found' | 'free' | 'stale';
  isStale?: boolean;
}

export interface CachedSteamData {
  name: string;
  capsuleUrl: string;
  priceFinal: number | null;
  priceInitial: number | null;
  discountPercent: number;
}

export interface SteamCacheEntry {
  data: CachedSteamData;
  timestamp: number;
}

export type SortField =
  | 'name'
  | 'hltbMain'
  | 'hltbMainExtra'
  | 'hltbCompletionist'
  | 'priceFinal'
  | 'discountPercent'
  | 'priority';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface AppState {
  steamId: string;
  games: GameEntry[];
  sort: SortState;
  loading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  loadingTotal: number;
  error: string | null;
  isCancelled: boolean;
  onStop?: () => void;
  isThrottled: boolean;
  throttledUntil: number | null; // Timestamp
  regionId: string;
}

export interface SteamRegion {
  id: string;
  name: string;
  cc: string;
  currency: string;
}

export const REGION_MAP: Record<string, SteamRegion> = {
  'us': { id: 'us', name: 'United States ($)', cc: 'us', currency: 'USD' },
  'eu': { id: 'eu', name: 'European Union (€)', cc: 'be', currency: 'EUR' },
  'gb': { id: 'gb', name: 'United Kingdom (£)', cc: 'gb', currency: 'GBP' },
  'ca': { id: 'ca', name: 'Canada ($)', cc: 'ca', currency: 'CAD' },
  'au': { id: 'au', name: 'Australia ($)', cc: 'au', currency: 'AUD' },
  'jp': { id: 'jp', name: 'Japan (¥)', cc: 'jp', currency: 'JPY' },
};
