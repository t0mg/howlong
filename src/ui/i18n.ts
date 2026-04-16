export type Locale = 'en';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    app_title: 'How Long to Clear',
    app_subtitle: 'Find your next wishlisted game to play based on your time and budget.',
    steam_id_placeholder: 'Enter your Steam64 ID (e.g. 76561198012345678)',
    fetch_wishlist: 'Fetch Wishlist',
    landing_help: 'Your Steam profile & wishlist must be <strong>public</strong>. Find your Steam64 ID at <a href="https://steamid.io" target="_blank" rel="noopener">steamid.io</a>. No user data is stored. <a href="https://github.com/t0mg/howlong">Project source</a>.',

    loading_games_enriched: '{count} / {total} games processed ({percent}%)',
    loading_throttled_title: 'Steam is throttling requests',
    loading_waiting: 'Waiting {time}...',
    loading_stop: 'Stop & Show Results',
    loading_stopping: 'Stopping and preparing results...',
    loading_fetching_appid: 'Fetching wishlist AppID list...',
    loading_fetching_prices: 'Fetching game prices...',
    loading_fetching_details: 'Fetching game details...',
    loading_fetching_details_count: 'Fetching details for {count} games...',
    loading_enriching: 'Enriching with HowLongToBeat data...',

    error_wishlist_private: 'Wishlist is empty or private.',
    error_no_details: 'Could not fetch details for any games in your wishlist.',
    error_unexpected: 'An unexpected error occurred.',

    error_try_again: 'Try Again',

    dashboard_change_id: '← Change Steam ID',
    dashboard_insights: 'Insights',
    dashboard_filter_label: 'Filter:',
    dashboard_filter_all: 'All Categories',
    dashboard_sort_label: 'Sort by:',
    dashboard_match_info: 'HLTB data found for {found} / {total} games',

    stats_games: 'Games',
    stats_main: 'Main Story',
    stats_main_extra: 'Main + Extras',
    stats_completionist: 'Completionist',
    stats_value: 'Wishlist Value',
    stats_savings: 'Sale Savings',

    sort_priority: 'Priority',
    sort_dateAdded: 'Date Added',
    sort_name: 'Name',
    sort_hltbMain: 'Duration (Main)',
    sort_hltbMainExtra: 'Duration (Main+)',
    sort_hltbCompletionist: 'Duration (100%)',
    sort_priceFinal: 'Price',
    sort_discountPercent: 'Discount',

    settings_title: 'Settings',
    settings_desc: 'Manage your application preferences and local data.',
    settings_region_label: 'Steam Store Region',
    settings_region_desc: 'Select region for accurate local prices.',
    settings_clear_hltb_label: 'Clear HLTB Data',
    settings_clear_hltb_desc: 'Remove stored game durations and re-fetch.',
    settings_clear_hltb_btn: 'Clear HLTB',
    settings_cleared: 'Cleared!',
    settings_clear_steam_label: 'Clear Steam Game Data',
    settings_clear_steam_desc: 'Remove cached metadata and re-fetch. Prices are fetched live.',
    settings_clear_steam_btn: 'Clear Steam',
    settings_hard_reset_label: 'App Cache (Hard Reset)',
    settings_hard_reset_desc: 'Unregister Service Worker and clear all internal databases. App will reload.',
    settings_hard_reset_btn: 'Full Reset',
    settings_hard_reset_confirm: 'Are you sure? This will wipe ALL cached data and settings.',
    settings_close: 'Close',

    insights_title: 'Wishlist Insights',
    insights_desc: 'A data-driven breakdown of your wishlist.',
    insights_avg_price_hr: 'Avg. Price/Hr',
    insights_oldest_entry: 'Oldest Entry',
    insights_top_genre: 'Top Genre',
    insights_total_story: 'Total Story',
    insights_chart_duration: 'Duration Distribution (Hrs)',
    insights_chart_price: 'Price Distribution ({currency})',
    insights_chart_genre: 'Popular Genres',
    insights_chart_year: 'Wishlist Entry Timeline',

    game_coming_soon: 'Coming Soon',
    game_demo: 'Demo',
    game_demo_avail: 'Demo Avail.',
    game_added: 'Added {date}',
    game_free: 'Free',
    game_cached: '(cached)',
    game_price_na: 'Price N/A',
    game_no_hltb: 'No HLTB data',
    game_hltb_pending: 'Looking up...',
    game_link_steam: 'Steam',
    game_link_hltb: 'HLTB',
  }
};

let currentLocale: Locale = 'en';

export function t(key: string, params: Record<string, string | number> = {}): string {
  let text = translations[currentLocale][key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
}
