const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testConfigScrape() {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log('HTML Length:', html.length);
  
  // Look for application_config data-context (common in Steam Store)
  const configMatch = html.match(/id="application_config"\s+data-context="(.+?)"/);
  if (configMatch) {
    console.log('Found application_config!');
    const raw = configMatch[1].replace(/&quot;/g, '"');
    try {
      const config = JSON.parse(raw);
      console.log('Config keys:', Object.keys(config));
    } catch (e) {
      console.log('Error parsing config:', e.message);
    }
  } else {
    console.log('application_config not found.');
  }

  // Look for window.SSR again, but more carefully
  const ssrMatch = html.match(/window\.SSR\s*=\s*({.+?});/);
  if (ssrMatch) {
      console.log('Found window.SSR (Object style)');
  }
  const ssrInitMatch = html.match(/window\.SSR\s*=\s*\{\};/);
  if (ssrInitMatch) {
      console.log('Found window.SSR = {};');
      const loaderMatch = html.match(/window\.SSR\.loaderData\s*=\s*(\[.+?\]);/s);
      if (loaderMatch) {
          console.log('Found window.SSR.loaderData!');
          const data = JSON.parse(loaderMatch[1]);
          console.log(`loaderData has ${data.length} items.`);
          for (let i = 0; i < data.length; i++) {
              if (typeof data[i] === 'string') {
                  const p = JSON.parse(data[i]);
                  if (p.wishlist || p.results || Array.isArray(p)) {
                      console.log(`Item ${i} contains potential data! Keys:`, Object.keys(p));
                      if (p.wishlist) console.log(`Found ${p.wishlist.length} items in p.wishlist`);
                  }
              }
          }
      }
  }
}

testConfigScrape();
