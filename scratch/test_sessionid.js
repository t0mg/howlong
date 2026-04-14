const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;

async function testSessionId() {
  console.log(`Testing with dummy sessionid cookie...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': 'sessionid=1234567890abcdef12345678;',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
  console.log(`Is JSON: ${isJson}`);
  if (isJson) {
      console.log(`Found ${Object.keys(JSON.parse(text)).length} items!`);
  } else {
      console.log(`Body start: ${text.substring(0, 100)}...`);
  }
}

testSessionId();
