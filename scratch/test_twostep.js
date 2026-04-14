const steamId = '76561198025591845';

async function testTwoStep() {
  console.log('Step 1: Fetching Steam home to get cookies...');
  const res1 = await fetch('https://store.steampowered.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const rawCookies = res1.headers.get('set-cookie');
  console.log('Cookies received:', rawCookies ? 'Yes' : 'No');
  
  // Extract sessionid if present
  const sessionIdMatch = rawCookies?.match(/sessionid=([^;]+)/);
  const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
  console.log('SessionID extracted:', sessionId);

  console.log('Step 2: Fetching wishlist with cookies...');
  const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;
  const res2 = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': rawCookies || '',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
    }
  });

  console.log(`Status: ${res2.status}`);
  const text = await res2.text();
  console.log(`Is JSON: ${text.trim().startsWith('{')}`);
  if (text.trim().startsWith('{')) {
    console.log(`SUCCESS! Found ${Object.keys(JSON.parse(text)).length} items!`);
  } else {
    console.log(`Body start: ${text.substring(0, 100)}...`);
  }
}

testTwoStep();
