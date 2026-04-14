const ids = ['76561198059845690', '76561198025591845'];

async function testFinal() {
  for (const steamId of ids) {
    console.log(`\n--- Testing ID: ${steamId} ---`);
    const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const html = await res.text();
    const linkRegex = /href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/([^?\/"]+)[^"]*"[^>]*>(.+?)<\/a>/g;
    
    const games = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const appId = match[1];
      const name = match[3].replace(/&amp;/g, '&').replace(/<[^>]*>?/gm, '').trim();
      if (!games.find(g => g.appId === appId)) {
        games.push({ appId, name });
      }
    }

    console.log(`Scraper found ${games.length} games.`);
    if (games.length > 0) {
      console.log('Sample:', games.slice(0, 3));
    }
  }
}

testFinal();
