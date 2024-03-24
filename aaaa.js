fetch("https://www.economilha.com/api/flights", {
  headers: {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9,pt;q=0.8",
    "content-type": "application/json",
    "sec-ch-ua":
      '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    cookie:
      "__Host-next-auth.csrf-token=509678f99a9c254b12a3299a8a9ab79d6656da102249a6d8947daa4538b525ea%7C3c0de8ef0a7bef6754d0da073fc7971b48e5b99dd3cf6b53255d5beafec8e8a0; _ga=GA1.1.1004190291.1710867179; __Secure-next-auth.callback-url=https%3A%2F%2Fwww.economilha.com%2Fsearch; _ga_9HL4J5EWQK=GS1.1.1710867179.1.1.1710867884.0.0.0; __Secure-next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..jX3G-WcBTmml6vr8.zBc1Q7R60_PDXpIJM_F6zQvqRxa4X0-vMfLTVLPJqGhrPMYwkcIEmDwScJII3pyrWWKwQxh40flON3i0ZJE_tgOSYqKDfvRYCCMAU0N67rwNarRIXXNAjtkZW7LTpC186wA_jPR3TuNvK_hgO_M8E21RZTrKkOlXcDl7nKYxWZ8ICgc5EccFE8G6qx03QrSNNWZNB2TUAVPU65t_IjxcctYMmy5J0mI8nLEiQ2re__tnewz40SzS-TXXeykAD0-T5jWTVRl4G6zIfSa-aePFccC3Y2IDL6dlLCtMY2X7_Cg6X7nlgu_Jn_N4VYDweQymqGY6rUZz6twmtcBr92Dbut-JGkB0g-RL0D3xYEgxgWcJ5xOAeU9xBmz495fET_pKKyWD-y51hg6g-FoCtlMuakreg8wpl08C7LEiEioSTS8OWAs04YSg4Hy8NCpFNp_spW4geO4j_nCRPg_zv831BII4iWXN2lP6Ewp7kWb2C0rNLa9XhuwVgBLaq_brHfiItbl3l-0BOreJsx87Qi8jTxvts7aTyAI.Zgu7H4bTttzTO3G1c9z79Q",
    Referer: "https://www.economilha.com/search",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  },
  body: '{"milesCompany":["AZUL"],"origin":"VCP","destination":"ORY","departures":["2024-05-07","2024-05-08","2024-05-09","2024-05-10","2024-05-11","2024-05-12","2024-05-13","2024-05-14"],"arrivals":["2024-05-23"],"tripType":"RETURN_TRIP","cabinType":"ECONOMY","passenger":1}',
  method: "POST",
}).then(async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunks = "";
  for await (const chunk of readChunks(reader)) {
    chunks += decoder.decode(chunk, { stream: true });
  }

  const data = JSON.parse(`[${chunks.replaceAll("}{", "},{")}]`);
  console.log(data);
});

function readChunks(reader) {
  return {
    async *[Symbol.asyncIterator]() {
      let readResult = await reader.read();
      while (!readResult.done) {
        yield readResult.value;
        readResult = await reader.read();
      }
    },
  };
}
