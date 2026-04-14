const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function debugHtml() {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log('Searching for "rgWishlist" or "WishlistData"...');
  
  const lines = html.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('rgWishlist') || lines[i].includes('WishlistData') || lines[i].includes('g_rg')) {
       console.log(`Line ${i}: ${lines[i].substring(0, 200)}`);
       if (i > 1000) break; // Don't log too many
    }
  }
}

debugHtml();
