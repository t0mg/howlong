async function testHltbFinal() {
  console.log('Final HLTB Handshake Test...');
  const query = 'Hollow Knight';
  
  try {
    const timestamp = Date.now();
    const initRes = await fetch(`https://howlongtobeat.com/api/find/init?t=${timestamp}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://howlongtobeat.com/'
      }
    });

    const initData = await initRes.json();
    const { token, hpKey, hpVal } = initData;

    const payload = {
      searchType: "games",
      searchTerms: query.split(' '),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          sortCategory: "popular"
        }
      },
      useCache: true,
      [hpKey]: hpVal // Dynamic property mirroring
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
    
    if (searchData.data && searchData.data.length > 0) {
      const top = searchData.data[0];
      const hours = Math.round(top.comp_main / 3600);
      console.log(`Success! Game: ${top.game_name}, Duration: ${hours} hours`);
    } else {
      console.log('No results found.');
    }
  } catch (err) {
    console.error('Final test failed:', err.message);
  }
}

testHltbFinal();
