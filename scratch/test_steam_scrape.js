const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testScrape() {
  console.log(`Fetching HTML from ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  console.log(`Status: ${res.status}`);
  const html = await res.text();
  console.log(`HTML Length: ${html.length}`);
  
  // Look for g_rgWishlistData
  const match = html.match(/g_rgWishlistData\s*=\s*(.+?);\s*var/);
  if (match) {
    console.log('SUCCESS: Found g_rgWishlistData in HTML!');
    try {
      const data = JSON.parse(match[1]);
      console.log(`Found ${data.length} games in wishlist data!`);
      console.log('Sample game:', data[0].name);
    } catch (e) {
      console.log('Error parsing JSON from HTML:', e.message);
    }
  } else {
    console.log('FAILURE: Could not find g_rgWishlistData in HTML.');
    // Check if maybe it's g_rgAppInfo
    const match2 = html.match(/g_rgAppInfo\s*=\s*(.+?);\s*var/);
    if (match2) {
       console.log('Found g_rgAppInfo instead.');
    }
  }
}

testScrape();
