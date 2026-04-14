const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;

async function testV3() {
  console.log(`Testing with precise headers...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
      'Accept': 'application/json, text/plain, */*',
    },
    redirect: 'manual'
  });

  console.log(`Status: ${res.status}`);
  console.log(`Location: ${res.headers.get('location')}`);
  const text = await res.text();
  console.log(`Body start: ${text.substring(0, 100)}`);
}

testV3();
