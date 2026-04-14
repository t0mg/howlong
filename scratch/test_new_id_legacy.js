const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;

async function testLegacyNewId() {
  console.log(`Testing legacy URL for new ID: ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
    },
    redirect: 'manual'
  });

  console.log(`Status: ${res.status}`);
  console.log(`Location: ${res.headers.get('location')}`);
}

testLegacyNewId();
