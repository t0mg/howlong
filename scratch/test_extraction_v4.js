const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testExtractionV4() {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  const match = html.match(/window\.SSR\.loaderData\s*=\s*(\[.+?\]);/s);
  if (match) {
    const data = JSON.parse(match[1]);
    console.log(`Array length: ${data.length}`);
    for (const [i, item] of data.entries()) {
      console.log(`Item ${i} type: ${typeof item}`);
      if (typeof item === 'string') {
        const parsed = JSON.parse(item);
        const keys = Object.keys(parsed);
        console.log(`Item ${i} parsed keys:`, keys);
        // Find where 'name' or 'appid' exists deeply
        if (JSON.stringify(parsed).includes('1000 Amps')) {
            console.log(`Found "1000 Amps" in Item ${i}!`);
            // Explore the structure
            if (parsed.wishlist) console.log(`Parsed.wishlist items: ${parsed.wishlist.length}`);
            if (parsed.results) console.log(`Parsed.results items: ${parsed.results.length}`);
        }
      }
    }
  }
}

testExtractionV4();
