const steamId = '76561198059845690';
const variations = [
  `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`,
  `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?v=1`,
  `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?instances=1`,
  `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/`
];

async function test() {
  for (const url of variations) {
    console.log(`\nTesting ${url}...`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
          'Accept': 'application/json, text/plain, */*',
        },
        redirect: 'manual'
      });

      console.log(`Status: ${res.status}`);
      console.log(`Location Header: ${res.headers.get('location')}`);
      console.log(`Content-Type: ${res.headers.get('content-type')}`);
      
      const text = await res.text();
      const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
      console.log(`Is JSON: ${isJson}`);
      if (!isJson) {
          console.log(`Body start: ${text.substring(0, 50)}...`);
      } else {
          console.log(`Data count: ${Object.keys(JSON.parse(text)).length}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

test();
