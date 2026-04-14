const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata`; // NO TRAILING SLASH

async function testFinal() {
  console.log(`Testing ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow'
  });

  console.log(`Status: ${res.status}`);
  console.log(`Final URL: ${res.url}`);
  const text = await res.text();
  const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
  console.log(`Is JSON: ${isJson}`);
  if (!isJson) {
      console.log(`Body start: ${text.substring(0, 100)}...`);
  }
}

testFinal();
