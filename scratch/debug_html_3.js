const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function debugHtml3() {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log('Search for 205690:', html.includes('205690'));
  console.log('Search for 1000 Amps:', html.includes('1000 Amps'));
  
  if (!html.includes('205690')) {
      console.log('AppID not found. Search for "profiles":', html.includes(steamId));
      console.log('First 500 chars of body:', html.substring(html.indexOf('<body'), html.indexOf('<body') + 500));
  }
}

debugHtml3();
