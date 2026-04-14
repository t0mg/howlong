async function manualHltbSearch() {
  console.log('Attempting manual HLTB search...');
  const query = 'Hollow Knight';
  
  try {
    // 1. Get the landing page to find the build ID / search key
    const homeRes = await fetch('https://howlongtobeat.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const html = await homeRes.text();
    
    // Find the script that contains the search key
    // HLTB uses Next.js, search key is usually in a client-side chunk
    const scriptMatch = html.match(/_next\/static\/chunks\/pages\/_app-([^.]+)\.js/);
    if (!scriptMatch) throw new Error('Could not find _app JS chunk');
    
    const scriptUrl = `https://howlongtobeat.com/_next/static/chunks/pages/_app-${scriptMatch[1]}.js`;
    console.log(`Fetching script: ${scriptUrl}`);
    
    const scriptRes = await fetch(scriptUrl);
    const scriptJs = await scriptRes.text();
    
    // Find the fetch() call with the key - it looks like .concat("...").
    // As of late 2024, it's often a string in a fetch call or a variable.
    // Let's try to find a 32-64 char hex string associated with "api/search".
    const keyMatch = scriptJs.match(/fetch\("https:\/\/howlongtobeat\.com\/api\/search\/([^"]+)"/);
    if (!keyMatch) {
       // Alternative: search for the concat pattern
       const altMatch = scriptJs.match(/\.concat\("([a-f0-9]{16,})"\)/);
       if (!altMatch) throw new Error('Could not find HLTB search key in JS');
       console.log(`Found alternative key: ${altMatch[1]}`);
       var searchKey = altMatch[1];
    } else {
       console.log(`Found direct key: ${keyMatch[1]}`);
       var searchKey = keyMatch[1];
    }

    // 2. Perform the search
    console.log(`Searching with key: ${searchKey}`);
    const searchUrl = `https://howlongtobeat.com/api/search/${searchKey}`;
    const payload = {
      searchType: "games",
      searchTerms: query.split(' '),
      searchPage: 1,
      size: 10,
      useCache: true
    };

    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://howlongtobeat.com',
        'Referer': 'https://howlongtobeat.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Search status: ${res.status}`);
    const results = await res.json();
    console.log(`Found ${results.data?.length || 0} results.`);
    if (results.data && results.data.length > 0) {
      console.log('Top match:', results.data[0].game_name, results.data[0].comp_main);
    }
  } catch (err) {
    console.error('Manual search failed:', err.message);
  }
}

manualHltbSearch();
