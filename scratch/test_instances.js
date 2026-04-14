const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?instances=0`;

async function testInstances() {
  console.log(`Testing ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Is JSON: ${text.trim().startsWith('{')}`);
  if (text.trim().startsWith('{')) {
      console.log(`Found ${Object.keys(JSON.parse(text)).length} items!`);
  } else {
      console.log(`Body start: ${text.substring(0, 100)}...`);
  }
}

testInstances();
