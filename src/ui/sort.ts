import type { GameEntry, SortField, SortDirection } from '../api/types';

/**
 * Sort an array of games by a given field and direction.
 * Null values are always pushed to the end.
 */
export function sortGames(
  games: GameEntry[],
  field: SortField,
  direction: SortDirection,
  filterGenre: string | null = null
): GameEntry[] {
  let filtered = filterGenre ? games.filter(g => g.genres?.includes(filterGenre)) : games;
  const sorted = [...filtered].sort((a, b) => {
    const aVal = getFieldValue(a, field);
    const bVal = getFieldValue(b, field);

    // Nulls go to the end regardless of direction
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    }

    const diff = (aVal as number) - (bVal as number);
    return direction === 'asc' ? diff : -diff;
  });

  return sorted;
}

function getFieldValue(game: GameEntry, field: SortField): string | number | null {
  switch (field) {
    case 'name':
      return game.name;
    case 'hltbMain':
      return game.hltbMain;
    case 'hltbMainExtra':
      return game.hltbMainExtra;
    case 'hltbCompletionist':
      return game.hltbCompletionist;
    case 'priceFinal':
      return game.isFree ? 0 : game.priceFinal;
    case 'discountPercent':
      return game.discountPercent;
    case 'priority':
      return game.priority;
    default:
      return null;
  }
}

/**
 * Compute aggregate statistics for the game list.
 */
export function computeStats(games: GameEntry[], filterGenre: string | null = null) {
  const filtered = filterGenre ? games.filter(g => g.genres?.includes(filterGenre)) : games;
  let totalGames = filtered.length;
  let gamesWithHltb = 0;
  let totalMainHours = 0;
  let totalMainExtraHours = 0;
  let totalCompletionistHours = 0;
  let totalValue = 0;
  let totalSavings = 0;
  let gamesOnSale = 0;

  for (const g of games) {
    if (g.hltbMain !== null) {
      gamesWithHltb++;
      totalMainHours += g.hltbMain;
    }
    if (g.hltbMainExtra !== null) {
      totalMainExtraHours += g.hltbMainExtra;
    }
    if (g.hltbCompletionist !== null) {
      totalCompletionistHours += g.hltbCompletionist;
    }
    if (g.priceFinal !== null) {
      totalValue += g.priceFinal;
    }
    if (g.priceInitial !== null && g.priceFinal !== null && g.discountPercent > 0) {
      totalSavings += g.priceInitial - g.priceFinal;
      gamesOnSale++;
    }
  }

  return {
    totalGames,
    gamesWithHltb,
    totalMainHours: Math.round(totalMainHours * 100) / 100,
    totalMainExtraHours: Math.round(totalMainExtraHours * 100) / 100,
    totalCompletionistHours: Math.round(totalCompletionistHours * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
    totalSavings: Math.round(totalSavings * 100) / 100,
    gamesOnSale,
  };
}
