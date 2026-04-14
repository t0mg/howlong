const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;

async function testBrowserId() {
  const browserId = Math.floor(Math.random() * 10000000000000000);
  console.log(`Testing with browserid=${browserId}...`);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': `browserid=${browserId};`,
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Is JSON: ${text.trim().startsWith('{') || text.trim().startsWith('[')}`);
  if (text.trim().startsWith('{')) {
      console.log(`Found ${Object.keys(JSON.parse(text)).length} items!`);
  } else {
      console.log(`Body start: ${text.substring(0, 100)}...`);
  }
}

testBrowserId();
