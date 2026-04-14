const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`;

async function testMobile() {
  console.log(`Testing with Mobile User-Agent...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://store.steampowered.com/wishlist/profiles/${steamId}/`,
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Is JSON: ${text.trim().startsWith('{') || text.trim().startsWith('[')}`);
  if (!text.trim().startsWith('{')) {
       console.log(`Body start: ${text.substring(0, 50)}...`);
  }
}

testMobile();
