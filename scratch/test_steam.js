const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?v=1`;

async function test() {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
      'Accept': 'application/json, text/plain, */*',
    }
  });

  console.log(`Status: ${res.status}`);
  console.log(`Content-Type: ${res.headers.get('content-type')}`);
  const text = await res.text();
  console.log(`Body start: ${text.substring(0, 100)}`);
  
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    console.log('SUCCESS: Received JSON');
  } else {
    console.log('FAILURE: Received something else (likely HTML)');
  }
}

test();
