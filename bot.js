const { jsonFileToObj, BitexApi } = require('./utils');

const config = jsonFileToObj('./config.json');
const bitexApi = new BitexApi(config.apiKey, config.apiVersion, config.useDevServer);

(async () => {
  let btcCount = await bitexApi.loadFromBalance();
  console.log('Available balance in BTC: ', btcCount);

  const asks = await bitexApi.getFromToCoinsAsk();
  console.log('Lowest sell order price (BTC/XXX):');
  console.log(asks.map(item => `${item.id}: ${item.ask}`).join('\n'), '\n');

  const openOrders = await bitexApi.getFromToCoinOpenOrders();

  for (let ticker of config.tickers) {
    console.log('Ticker', ticker.id);

    const lowestAsk = asks.find(item => item.id === ticker.id);
    if (lowestAsk) {

      const openOrdersAboveLowestPrice = openOrders
        .filter(order => order.attributes.orderbook_code === ticker.id &&
          order.attributes.price !== lowestAsk - 0.01);

      // cancel BTC orders above lowest price
      if (openOrdersAboveLowestPrice.length > 0) {
        console.log('Lowest ask', lowestAsk.ask);
        console.log('Cancel open BTC/XXX orders:', openOrdersAboveLowestPrice.map(order => order.id).join(','));
        for (let order of openOrdersAboveLowestPrice) {
          await bitexApi.cancelOrder(order.id);
        }

        btcCount = await bitexApi.loadFromBalance();
        console.log('New available balance in BTC: ', btcCount);
      }

      if (btcCount > 0) {
        // create orders for selling of BTC
        const sellBtcAmount = Math.min(btcCount, ticker.btcOrderAmount);
        const lowestAsk = asks.find(item => item.id === ticker.id);

        if (lowestAsk) {
          console.log('Creating order for BTC amount: ', sellBtcAmount, ' ticker: ', ticker.id);

          const placeResult = await bitexApi.placeSellFromToCoinOrder(ticker.id,
            sellBtcAmount, lowestAsk.ask - 0.01);

          console.log('Place order result: ', placeResult);
        }
      }
    }
  }
})();
