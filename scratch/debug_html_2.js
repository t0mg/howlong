const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function debugHtml2() {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log('HTML Length:', html.length);
  console.log('Snippet (middle 2000 chars):');
  console.log(html.substring(html.length / 2, html.length / 2 + 2000));
}

debugHtml2();
