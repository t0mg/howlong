const steamId = '76561198059845690';
const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${steamId}`;

async function testOfficialApi() {
  console.log(`Testing Official API: ${url}...`);
  const res = await fetch(url);
  console.log(`Status: ${res.status}`);
  const data = await res.json();
  
  if (data.response && data.response.items) {
      console.log(`SUCCESS! Found ${data.response.items.length} items.`);
      console.log('Sample item:', JSON.stringify(data.response.items[0], null, 2));
  } else {
      console.log('FAILED: Response body:', JSON.stringify(data, null, 2));
  }
}

testOfficialApi();
