const steamId = '76561198059845690';
const inputJson = JSON.stringify({ steamid: steamId });
const url = `https://api.steampowered.com/IWishlistService/GetWishlistSortedFiltered/v1?input_json=${encodeURIComponent(inputJson)}`;

async function testWebApi() {
  console.log(`Testing Web API: ${url}...`);
  const res = await fetch(url);
  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Is JSON: ${text.trim().startsWith('{')}`);
  console.log(`Body start: ${text.substring(0, 200)}`);
}

testWebApi();
