const steamId = '76561198059845690';
const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/`;

async function testExtract() {
  console.log(`Fetching HTML from ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log(`HTML Length: ${html.length}`);
  
  // Look for window.SSR or similar initialization
  const ssrMatch = html.match(/window\.SSR\s*=\s*(.+?);\s*<\/script>/s);
  if (ssrMatch) {
    console.log('Found window.SSR block!');
    const ssrContent = ssrMatch[1];
    // Need to find the wishlist data inside it
    // The subagent said it's in loaderData
    if (ssrContent.includes('loaderData')) {
        console.log('Found loaderData string!');
        // Let's try to extract it more precisely
        const loaderMatch = ssrContent.match(/"loaderData":\s*(.+?),\s*"renderContext"/);
        if (loaderMatch) {
            console.log('Extracted loaderData value (snippet):');
            console.log(loaderMatch[1].substring(0, 500));
        }
    }
  } else {
    console.log('Could not find window.SSR block.');
    // Check for application_config
    const configMatch = html.match(/id="application_config"\s+data-context="(.+?)"/);
    if (configMatch) {
        console.log('Found application_config data-context!');
    }
  }
}

testExtract();
