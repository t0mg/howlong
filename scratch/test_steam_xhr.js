const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;

async function testXHR() {
  console.log(`Testing with X-Requested-With...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
  console.log(`Is JSON: ${isJson}`);
}

testXHR();
