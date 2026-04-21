import type { GameEntry } from '../api/types';
import { REGION_MAP } from '../api/types';

export interface ChartData {
  labels: string[];
  datasets: {
    name?: string;
    type?: string;
    values: number[];
  }[];
}

export interface StatsBreakdown {
  durationDist: ChartData;
  priceDist: ChartData;
  genreDist: ChartData;
  yearDist: ChartData;
  storeCompare: ChartData;
  insights: {
    avgPricePerHour: number;
    totalPotentialHours: number;
    mostCommonGenre: string;
    oldestItemYear: number;
  };
}

export function prepareStats(games: GameEntry[], currencyCode = 'USD'): StatsBreakdown {
  // Try to find the symbol for the given currency code
  const region = Object.values(REGION_MAP).find(r => r.currency === currencyCode);
  const symbol = region ? region.symbol : '$';

  // 1. Duration Distribution (Main Story)
  const durationBuckets = [
    { label: '< 2h', min: 0, max: 2, count: 0 },
    { label: '2-5h', min: 2, max: 5, count: 0 },
    { label: '5-10h', min: 5, max: 10, count: 0 },
    { label: '10-25h', min: 10, max: 25, count: 0 },
    { label: '25-50h', min: 25, max: 50, count: 0 },
    { label: '50-100h', min: 50, max: 100, count: 0 },
    { label: '100h+', min: 100, max: Infinity, count: 0 },
  ];

  // 2. Price Distribution
  const priceBuckets = [
    { label: 'Free', min: 0, max: 0, count: 0, isFree: true },
    { label: `< ${symbol}5`, min: 0.01, max: 5, count: 0 },
    { label: `${symbol}5-15`, min: 5, max: 15, count: 0 },
    { label: `${symbol}15-30`, min: 15, max: 30, count: 0 },
    { label: `${symbol}30-60`, min: 30, max: 60, count: 0 },
    { label: `${symbol}60+`, min: 60, max: Infinity, count: 0 },
  ];

  // 3. Genres
  const genreCounts: Record<string, number> = {};

  // 4. Years
  const yearCounts: Record<number, number> = {};

  let totalHours = 0;
  let totalCost = 0;
  let gamesWithDuration = 0;
  let minYear = new Date().getUTCFullYear();
  let comingSoonCount = 0;
  let demoCount = 0;
  let hasDemoCount = 0;

  let steamCheaper = 0;
  let gogCheaper = 0;
  let equalPrice = 0;

  games.forEach(g => {
    if (g.isComingSoon) comingSoonCount++;
    if (g.isDemo) demoCount++;
    if (g.hasDemo) hasDemoCount++;

    // Duration
    if (g.hltbMain !== null && g.hltbMain > 0) {
      const h = g.hltbMain;
      totalHours += h;
      gamesWithDuration++;
      const bucket = durationBuckets.find(b => h >= b.min && h < b.max);
      if (bucket) bucket.count++;
    }

    // Price
    if (g.isComingSoon) {
      // Don't count in price buckets
    } else if (g.isFree || g.isDemo) {
      priceBuckets[0].count++;
    } else if (g.priceFinal !== null) {
      const p = g.priceFinal;
      totalCost += p;
      const bucket = priceBuckets.find(b => !b.isFree && p >= b.min && p < b.max);
      if (bucket) bucket.count++;
    }

    // Store Compare
    const steamP = g.isFree ? 0 : g.priceFinal;
    const gogP = g.gogPriceFinal;
    if (steamP !== null && gogP !== null && gogP !== undefined) {
      if (steamP < gogP) steamCheaper++;
      else if (gogP < steamP) gogCheaper++;
      else equalPrice++;
    }

    // Genres
    if (g.genres) {
      g.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }

    // Years
    if (g.dateAdded) {
      const year = new Date(g.dateAdded * 1000).getUTCFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
      if (year < minYear) minYear = year;
    }
  });

  // Process Genres for Pie
  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const othersGenreCount = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(5)
    .reduce((sum, curr) => sum + curr[1], 0);

  if (othersGenreCount > 0) {
    sortedGenres.push(['Other', othersGenreCount]);
  }

  // Process Years for Bar
  const years = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
  const yearLabels = years.map(String);
  const yearValues = years.map(y => yearCounts[y]);

  // If there are many coming soon games, maybe mention it
  const topGenre = sortedGenres[0]?.[0] || 'N/A';

  return {
    durationDist: {
      labels: durationBuckets.map(b => b.label),
      datasets: [{ values: durationBuckets.map(b => b.count) }]
    },
    priceDist: {
      labels: priceBuckets.map(b => b.label),
      datasets: [{ values: priceBuckets.map(b => b.count) }]
    },
    genreDist: {
      labels: sortedGenres.map(g => g[0]),
      datasets: [{ values: sortedGenres.map(g => g[1]) }]
    },
    yearDist: {
      labels: yearLabels,
      datasets: [{ values: yearValues }]
    },
    storeCompare: {
      labels: ['Steam Cheaper', 'GOG Cheaper', 'Same Price'],
      datasets: [{ values: [steamCheaper, gogCheaper, equalPrice] }]
    },
    insights: {
      avgPricePerHour: totalHours > 0 ? totalCost / totalHours : 0,
      totalPotentialHours: totalHours,
      mostCommonGenre: topGenre,
      oldestItemYear: minYear,
    }
  };
}
