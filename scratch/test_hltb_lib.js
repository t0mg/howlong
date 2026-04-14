const { HowLongToBeatService } = require('howlongtobeat');

async function testHltb() {
  console.log('Searching HLTB for "Hollow Knight"...');
  try {
    const service = new HowLongToBeatService();
    const results = await service.search('Hollow Knight');
    console.log(`Found ${results.length} results.`);
    if (results.length > 0) {
      console.log('First result:', JSON.stringify(results[0], null, 2));
    }
  } catch (err) {
    console.error('HLTB Search Failed:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

testHltb();
