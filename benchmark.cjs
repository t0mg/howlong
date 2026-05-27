const { JSDOM } = require("jsdom");

const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
global.document = dom.window.document;
global.window = dom.window;

// Mock t and formatCurrency since they're used in the function
global.t = (key) => key;
global.formatCurrency = (num, curr) => num + curr;

// The current unoptimized code
function renderPriceRowUnoptimized(priceRow, game, currency) {
  if (game.isComingSoon) {
    priceRow.innerHTML = `<span class="price-status">coming_soon</span>`;
  } else if (game.isUnavailable) {
    priceRow.innerHTML = `<span class="price-unavailable">unavailable</span>`;
  } else if (game.isFree || game.isDemo) {
    priceRow.innerHTML = `<span class="price-free">free</span>`;
  } else if (game.priceStatus === 'stale') {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      priceRow.innerHTML += `<span class="price-original">${formatCurrency(game.priceInitial, currency)}</span>`;
    }
    priceRow.innerHTML += `<span class="price-current stale">${formatCurrency(game.priceFinal || 0, currency)} cached</span>`;
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
    priceRow.innerHTML = `<span class="price-unknown">na</span>`;
  }
}

// The optimized code using insertAdjacentHTML
function renderPriceRowOptimized(priceRow, game, currency) {
  if (game.isComingSoon) {
    priceRow.innerHTML = `<span class="price-status">coming_soon</span>`;
  } else if (game.isUnavailable) {
    priceRow.innerHTML = `<span class="price-unavailable">unavailable</span>`;
  } else if (game.isFree || game.isDemo) {
    priceRow.innerHTML = `<span class="price-free">free</span>`;
  } else if (game.priceStatus === 'stale') {
    if (game.discountPercent > 0 && game.priceInitial !== null) {
      priceRow.insertAdjacentHTML('beforeend', `<span class="price-original">${formatCurrency(game.priceInitial, currency)}</span>`);
    }
    priceRow.insertAdjacentHTML('beforeend', `<span class="price-current stale">${formatCurrency(game.priceFinal || 0, currency)} cached</span>`);
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
    priceRow.innerHTML = `<span class="price-unknown">na</span>`;
  }
}

const game = {
  priceStatus: 'stale',
  discountPercent: 10,
  priceInitial: 100,
  priceFinal: 90
};

const currency = "USD";
const ITERATIONS = 10000;

function runBenchmark() {
  const container = document.createElement('div');

  const startUnoptimized = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const el = document.createElement('div');
    // Pre-populate with something so innerHTML += actually parses existing content
    el.innerHTML = '<div class="existing">Existing Content</div>';
    renderPriceRowUnoptimized(el, game, currency);
  }
  const endUnoptimized = performance.now();
  const unoptimizedTime = endUnoptimized - startUnoptimized;

  const startOptimized = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const el = document.createElement('div');
    el.innerHTML = '<div class="existing">Existing Content</div>';
    renderPriceRowOptimized(el, game, currency);
  }
  const endOptimized = performance.now();
  const optimizedTime = endOptimized - startOptimized;

  console.log(`Unoptimized Time: ${unoptimizedTime.toFixed(2)}ms`);
  console.log(`Optimized Time: ${optimizedTime.toFixed(2)}ms`);
  console.log(`Improvement: ${((unoptimizedTime - optimizedTime) / unoptimizedTime * 100).toFixed(2)}% faster`);
}

runBenchmark();
