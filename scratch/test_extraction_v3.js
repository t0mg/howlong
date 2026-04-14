const steamId = '76561198025591845';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testExtractionV3() {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log(`HTML Length: ${html.length}`);

  // New logic from implementation plan
  const patterns = [
    /window\.SSR\.loaderData\s*=\s*(\[.+?\]);/s,
    /window\.SSR\s*=\s*({.+?});/s,
    /var\s+g_rgWishlistData\s*=\s*(.+?);/
  ];

  let matchFound = false;
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      console.log(`Found match for pattern: ${pattern}`);
      matchFound = true;
      try {
        const raw = match[1];
        let data = JSON.parse(raw);
        console.log(`Parsed successfully. Type: ${Array.isArray(data) ? 'Array' : 'Object'}`);

        if (Array.isArray(data)) {
           console.log(`Array length: ${data.length}`);
           // If it's loaderData, find the wishlist items
           for (const item of data) {
             try {
               const parsed = typeof item === 'string' ? JSON.parse(item) : item;
               if (parsed && (Array.isArray(parsed) || (parsed.wishlist && Array.isArray(parsed.wishlist)))) {
                  const list = Array.isArray(parsed) ? parsed : parsed.wishlist;
                  console.log(`Found wishlist with ${list.length} items inside array item!`);
                  console.log(`Sample game: ${list[0].name || list[0].id}`);
                  break;
               }
             } catch (e) {}
           }
        }
      } catch (e) {
        console.log(`Error parsing: ${e.message}`);
      }
      break;
    }
  }

  if (!matchFound) {
    console.log('FAILURE: No match found.');
  }
}

testExtractionV3();
