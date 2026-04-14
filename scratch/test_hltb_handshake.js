async function testHltbHandshake() {
  console.log('Testing HLTB Handshake...');
  const query = 'Hollow Knight';
  
  try {
    // 1. Initialize session
    const timestamp = Date.now();
    const initRes = await fetch(`https://howlongtobeat.com/api/find/init?t=${timestamp}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://howlongtobeat.com/'
        }
    });

    if (!initRes.ok) throw new Error(`Init failed: ${initRes.status}`);
    const initData = await initRes.json();
    const { token, hpKey, hpVal } = initData;
    console.log(`Initialized: token=${token.slice(0, 10)}..., hpKey=${hpKey}`);

    // 2. Perform search with headers and dynamic body key
    const payload = {
      searchType: "games",
      searchTerms: query.split(' '),
      searchPage: 1,
      size: 20,
      [hpKey]: hpVal // Dynamic key injection
    };

    const searchRes = await fetch('https://howlongtobeat.com/api/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
        'x-hp-key': hpKey,
        'x-hp-val': hpVal,
        'Origin': 'https://howlongtobeat.com',
        'Referer': 'https://howlongtobeat.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(payload)
    });

    if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    console.log(`Success! Found ${searchData.data?.length || 0} games.`);
    if (searchData.data && searchData.data.length > 0) {
        console.log(`Top match: ${searchData.data[0].game_name}`);
    }
  } catch (err) {
    console.error('Handshake test failed:', err.message);
  }
}

testHltbHandshake();
