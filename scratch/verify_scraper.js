const steamId = '76561198059845690';
const steamUrl = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testWorkerLogic() {
  console.log(`Fetching ${steamUrl}...`);
  const res = await fetch(steamUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await res.text();
  
  // Scraper logic from Worker
  const ssrMatch = html.match(/window\.SSR\s*=\s*({.+?});\s*<\/script>/s);
  if (!ssrMatch) {
    console.log('FAILURE: Could not find window.SSR block');
    return;
  }

  try {
    const ssr = JSON.parse(ssrMatch[1]);
    const loaderData = ssr.loaderData || [];
    
    let wishlistItems = [];
    for (const item of loaderData) {
      try {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        if (Array.isArray(parsed)) {
          wishlistItems = parsed;
          break;
        } else if (parsed && parsed.wishlist && Array.isArray(parsed.wishlist)) {
          wishlistItems = parsed.wishlist;
          break;
        }
      } catch { continue; }
    }

    if (wishlistItems.length === 0) {
      console.log('FAILURE: Wishlist items empty');
      return;
    }

    console.log(`SUCCESS: Found ${wishlistItems.length} items!`);
    
    // Test mapping
    const item = wishlistItems[0];
    const appId = item.appid || item.id;
    console.log('First Item Raw:', item.name, appId);
    
    const mapped = {
        name: item.name,
        capsule: item.capsule || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
        subs: item.subs || (item.best_purchase_option ? [{
            discount_pct: item.best_purchase_option.discount_pct || 0,
            price: item.best_purchase_option.formatted_final_price || null
        }] : [])
    };
    
    console.log('First Item Mapped:', JSON.stringify(mapped, null, 2));

  } catch (err) {
    console.log('FAILURE: Parse error', err.message);
  }
}

testWorkerLogic();
