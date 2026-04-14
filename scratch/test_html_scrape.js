const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testHtmlScrape() {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log(`HTML Length: ${html.length}`);

  // Regex to find game info in SSR nodes
  // Looking for links to /app/APPID/NAME
  const gameRegex = /href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/([^?\/"]+)[^"]*">(.+?)<\/a>/g;
  
  const games = [];
  let match;
  while ((match = gameRegex.exec(html)) !== null) {
    const appId = match[1];
    const slug = match[2];
    const name = match[3].replace(/&amp;/g, '&').trim();
    
    // De-duplicate (links appear multiple times)
    if (!games.find(g => g.appId === appId)) {
      games.push({ appId, name, slug });
    }
  }

  console.log(`Found ${games.length} games via HTML regex!`);
  if (games.length > 0) {
    console.log('Sample games:', games.slice(0, 5).map(g => `${g.name} (${g.appId})`));
  } else {
    // Try fallback: data-ds-appid
    console.log('Trying fallback regex...');
    const appidRegex = /data-ds-appid="(\d+)"/g;
    const ids = Array.from(new Set([...html.matchAll(appidRegex)].map(m => m[1])));
    console.log(`Found ${ids.length} AppIDs via data-ds-appid!`);
  }
}

testHtmlScrape();
