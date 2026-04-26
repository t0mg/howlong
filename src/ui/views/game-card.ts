import type { GameEntry } from '../../api/types';
import { fetchSteamReviews } from '../../api/steam';
import { t } from '../i18n';
import { formatDate, formatHours, formatCurrency, formatCompactNumber } from '../format';
import { html, ICON_THUMB_UP, ICON_THUMB_DOWN, ICON_HIDE, ICON_SHOW } from '../template';
import { getCurrentLocale } from '../i18n';
import type { Locale } from '../i18n';

const STEAM_LANG_MAP: Record<Locale, string> = {
  en: 'english',
  fr: 'french',
  es: 'spanish',
  de: 'german',
  ja: 'japanese',
  zh: 'schinese'
};

// ── Templates ────────────────────────────────────────────────

const TPL_GAME_CARD = `
  <div class="game-card">
    <div class="game-card-img">
      <img data-ref="img" loading="lazy" width="460" height="215">
      <div class="game-card-badges" data-ref="badges"></div>
    </div>
    <div class="game-card-info">
      <h3 class="game-name" data-ref="name"></h3>
      <div>
        <span class="game-date" data-ref="date"></span>
        <span class="review-score" data-ref="review"></span>
      </div>
      <div class="genre-chips" data-ref="genres"></div>
      <div class="price-row" data-ref="priceRow"></div>
      <div class="hltb-section" data-ref="hltb"></div>
      <div class="game-links" data-ref="links"></div>
    </div>
  </div>`;

const TPL_DURATION_ROW = `
  <div class="duration-row">
    <span class="duration-label" data-ref="label"></span>
    <div class="duration-bar-container">
      <div class="duration-bar" data-ref="bar"></div>
    </div>
    <span class="duration-hours" data-ref="hours"></span>
  </div>`;

// ── Game Card ────────────────────────────────────────────────

export function createGameCard(
  game: GameEntry,
  currency: string,
  isHidden?: boolean,
  onToggleHide?: (appId: string, isHidden: boolean) => void
): HTMLElement {
  const { element, refs } = html<{
    img: HTMLImageElement;
    badges: HTMLElement;
    name: HTMLElement;
    date: HTMLElement;
    review: HTMLElement;
    genres: HTMLElement;
    priceRow: HTMLElement;
    hltb: HTMLElement;
    links: HTMLElement;
  }>(TPL_GAME_CARD);

  refs.img.src = game.capsuleUrl;
  refs.img.alt = game.name;
  refs.name.textContent = game.name;
  refs.date.textContent = t('game_added', { date: formatDate(game.dateAdded) });

  const updateReviewDOM = () => {
    if (game.reviewDesc && game.reviewCount > 0) {
      const icon = game.reviewPercent >= 40 ? ICON_THUMB_UP : ICON_THUMB_DOWN;
      refs.review.innerHTML = `${icon} ${game.reviewPercent}%`;
      refs.review.title = `${game.reviewDesc} (${formatCompactNumber(game.reviewCount)})`;
      refs.review.classList.add(getReviewClass(game.reviewPercent));
    }
  };

  if (game.reviewDesc) {
    updateReviewDOM();
  } else if (game.reviewStatus !== 'loaded' && game.reviewStatus !== 'error') {
    game.reviewStatus = 'pending';
    const steamLang = STEAM_LANG_MAP[getCurrentLocale()] || 'english';
    fetchSteamReviews(game.appId, steamLang).then(reviews => {
      if (reviews && reviews.success && reviews.desc) {
        game.reviewDesc = reviews.desc;
        game.reviewPercent = reviews.percent;
        game.reviewCount = reviews.total;
        game.reviewStatus = 'loaded';
        updateReviewDOM();
      } else {
        game.reviewStatus = 'error';
      }
    });
  }

  // Badges
  if (game.isComingSoon) {
    appendBadge(refs.badges, 'status-badge badge-coming-soon', t('game_coming_soon'));
  } else if (game.isDemo) {
    appendBadge(refs.badges, 'status-badge badge-demo', t('game_demo'));
  } else if (game.hasDemo) {
    appendBadge(refs.badges, 'status-badge badge-demo-avail', t('game_demo_avail'));
  }

  const maxDiscount = Math.max(game.discountPercent || 0, game.gogDiscountPercent || 0);
  if (maxDiscount > 0) {
    const isGogOnly = (game.gogDiscountPercent || 0) > 0 && (game.discountPercent || 0) === 0;
    appendBadge(refs.badges, 'discount-badge', `-${maxDiscount}%${isGogOnly ? ' (GOG)' : ''}`);
  }

  // Genres
  if (game.genres && game.genres.length > 0) {
    game.genres.slice(0, 5).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'genre-chip';
      chip.textContent = tag;
      refs.genres.appendChild(chip);
    });
  }

  // Price
  renderPriceRow(refs.priceRow, game, currency);

  // HLTB
  if (game.hltbStatus === 'found') {
    if (game.hltbMain) refs.hltb.appendChild(createDurationRow('Main', game.hltbMain, 'main'));
    if (game.hltbMainExtra) refs.hltb.appendChild(createDurationRow('Main+', game.hltbMainExtra, 'extra'));
    if (game.hltbCompletionist) refs.hltb.appendChild(createDurationRow('100%', game.hltbCompletionist, 'comp'));
  } else if (game.hltbStatus === 'not_found') {
    refs.hltb.innerHTML = `<div class="hltb-no-data">${t('game_no_hltb')}</div>`;
  } else {
    refs.hltb.innerHTML = `<div class="hltb-pending">${t('game_hltb_pending')}</div>`;
  }

  // Links
  renderLinks(refs.links, game, isHidden, onToggleHide);

  return element;
}

// ── Price Row ────────────────────────────────────────────────

function renderPriceRow(priceRow: HTMLElement, game: GameEntry, currency: string): void {
  if (game.isComingSoon) {
    priceRow.innerHTML = `<span class="price-status">${t('game_coming_soon')}</span>`;
  } else if (game.isUnavailable) {
    priceRow.innerHTML = `<span class="price-unavailable">${t('game_unavailable')}</span>`;
  } else if (game.isFree || game.isDemo) {
    priceRow.innerHTML = `<span class="price-free">${t('game_free')}</span>`;
  } else if (game.priceStatus === 'stale') {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      priceRow.innerHTML += `<span class="price-original">${formatCurrency(game.priceInitial, currency)}</span>`;
    }
    priceRow.innerHTML += `<span class="price-current stale">${formatCurrency(game.priceFinal || 0, currency)} ${t('game_cached')}</span>`;
  } else if (game.priceFinal !== null) {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      const orig = document.createElement('span');
      orig.className = 'price-original';
      orig.textContent = formatCurrency(game.priceInitial, currency);
      priceRow.appendChild(orig);
    }
    const current = document.createElement('span');
    current.className = game.discountPercent > 0 ? 'price-sale' : 'price-current';
    current.textContent = formatCurrency(game.priceFinal, currency);
    priceRow.appendChild(current);
  } else {
    priceRow.innerHTML = `<span class="price-unknown">${t('game_price_na')}</span>`;
  }

  // GOG Price
  renderGogPrice(priceRow, game, currency);
}

function renderGogPrice(priceRow: HTMLElement, game: GameEntry, currency: string): void {
  const isGogPriceSame = game.priceFinal !== null &&
    game.gogPriceFinal === game.priceFinal &&
    (game.gogPriceCurrency || currency) === currency;

  if (game.gogPriceFinal !== null && game.gogPriceFinal !== undefined && !isGogPriceSame) {
    const sep = document.createElement('span');
    sep.className = 'price-gog-sep';
    sep.textContent = '|';
    priceRow.appendChild(sep);

    const gogLabel = document.createElement('span');
    gogLabel.className = 'price-gog-label';
    gogLabel.textContent = 'GOG';
    priceRow.appendChild(gogLabel);

    if (game.gogDiscountPercent > 0 && game.gogPriceInitial !== null) {
      const orig = document.createElement('span');
      orig.className = 'price-original';
      orig.textContent = formatCurrency(game.gogPriceInitial, game.gogPriceCurrency || currency);
      priceRow.appendChild(orig);
    }
    const current = document.createElement('span');
    current.className = game.gogDiscountPercent > 0 ? 'price-sale' : 'price-current';
    current.textContent = formatCurrency(game.gogPriceFinal, game.gogPriceCurrency || currency);
    if (game.gogPriceCurrency !== currency && game.gogPriceCurrency) {
      current.title = `Currency: ${game.gogPriceCurrency}`;
    }
    priceRow.appendChild(current);
  }
}

// ── Links ────────────────────────────────────────────────────

function renderLinks(
  linksEl: HTMLElement,
  game: GameEntry,
  isHidden?: boolean,
  onToggleHide?: (appId: string, isHidden: boolean) => void
): void {
  const steamLnk = document.createElement('a');
  steamLnk.href = `https://store.steampowered.com/app/${game.appId}`;
  steamLnk.target = '_blank';
  steamLnk.rel = 'noopener';
  steamLnk.className = 'game-link steam-link';
  steamLnk.textContent = t('game_link_steam');
  linksEl.appendChild(steamLnk);

  if (game.gogStatus === 'found' && game.gogUrl) {
    const gogLnk = document.createElement('a');
    gogLnk.href = game.gogUrl;
    gogLnk.target = '_blank';
    gogLnk.rel = 'noopener';
    gogLnk.className = 'game-link gog-link';
    gogLnk.textContent = t('game_link_gog');
    linksEl.appendChild(gogLnk);
  }

  if (game.hltbId) {
    const hltbLnk = document.createElement('a');
    hltbLnk.href = `https://howlongtobeat.com/game/${game.hltbId}`;
    hltbLnk.target = '_blank';
    hltbLnk.rel = 'noopener';
    hltbLnk.className = 'game-link hltb-link';
    hltbLnk.textContent = t('game_link_hltb');
    linksEl.appendChild(hltbLnk);
  }

  if (onToggleHide) {
    const hideLnk = document.createElement('button');
    hideLnk.className = 'game-link hide-link';
    hideLnk.style.background = 'transparent';
    hideLnk.style.marginLeft = 'auto';
    hideLnk.innerHTML = isHidden ? ICON_SHOW : ICON_HIDE;
    const label = isHidden ? t('game_link_unhide') : t('game_link_hide');
    hideLnk.title = label;
    hideLnk.setAttribute('aria-label', label);
    hideLnk.addEventListener('click', () => onToggleHide(game.appId, !!isHidden));
    linksEl.appendChild(hideLnk);
  }
}

// ── Helpers ──────────────────────────────────────────────────

function appendBadge(container: HTMLElement, className: string, text: string) {
  const b = document.createElement('div');
  b.className = className;
  b.textContent = text;
  container.appendChild(b);
}

function createDurationRow(label: string, hours: number, type: string): HTMLElement {
  const { element, refs } = html<{ label: HTMLElement; bar: HTMLElement; hours: HTMLElement }>(TPL_DURATION_ROW);
  refs.label.textContent = label;
  refs.hours.textContent = formatHours(hours);
  refs.bar.className = `duration-bar duration-bar-${type}`;
  refs.bar.style.width = `${Math.min((hours / 200) * 100, 100)}%`;
  return element;
}

function getReviewClass(percent: number): string {
  if (percent >= 80) return 'review-positive';
  if (percent >= 40) return 'review-mixed';
  return 'review-negative';
}
