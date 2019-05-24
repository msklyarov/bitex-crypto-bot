const https = require('https');

class BitexApi {
  constructor(apiKey, apiVersion, useDevServer) {
    this.apiKey = apiKey;
    this.apiVersion = apiVersion;
    this.useDevServer = useDevServer;
  }

  getHostName() {
    return this.useDevServer ? 'sandbox.bitex.la' : 'bitex.la';
  }

  loadFromBalance() {
    const options = {
      'method': 'GET',
      'hostname': this.getHostName(),
      'path': '/api/coin_wallets',
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
        'Version': this.apiVersion
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const response = JSON.parse(Buffer.concat(chunks).toString());
          resolve(Number(response.data
            .find(item => item.attributes.currency === 'btc')
            .attributes.available));
        });

        res.on("error", (error) => {
          reject(error);
        });
      });

      req.end();
    });
  }

  getFromToCoinsAsk() {
    const options = {
      'method': 'GET',
      'hostname': this.getHostName(),
      'path': '/api/tickers',
      'headers': {
        'Content-Type': 'application/json',
        'Version': this.apiVersion
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const response = JSON.parse(Buffer.concat(chunks).toString());
          resolve(response.data
            .filter(item => item.id.startsWith('btc_') && item.attributes.ask !== 0)
            .map(item => ({
              id: item.id,
              ask: item.attributes.ask
            }))
          );
        });

        res.on("error", (error) => {
          reject(error);
        });
      });

      req.end();
    });
  }

  getFromToCoinOpenOrders() {
    const options = {
      'method': 'GET',
      'hostname': this.getHostName(),
      'path': '/api/asks',
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
        'Version': this.apiVersion
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, function (res) {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const response = JSON.parse(Buffer.concat(chunks).toString());
          resolve(response.data);
        });

        res.on("error", (error) => {
          reject(error);
        });
      });

      req.end();
    });
  }

  cancelOrder(id) {
    const options = {
      'method': 'POST',
      'hostname': this.getHostName(),
      'path': `/api/asks/${id}/cancel`,
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const response = Buffer.concat(chunks).toString();
          resolve(response);
        });

        res.on("error", (error) => {
          reject(error);
        });
      });

      req.end();
    });
  }

  placeSellFromToCoinOrder(coinTicker, amount, price) {
    const options = {
      'method': 'POST',
      'hostname': this.getHostName(),
      'path': '/api/asks',
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
        'Version': this.apiVersion
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, function (res) {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const response = JSON.parse(Buffer.concat(chunks).toString());
          resolve(response.data);
        });

        res.on("error", (error) => {
          reject(error);
        });
      });

      const data = {
        type: "asks",
        attributes: {
          amount,
          price,
          orderbook_code: coinTicker
        }
      };

      req.write(JSON.stringify({ data }));
      req.end();
    });
  }
}

const tick = async (api_key, api_version, use_dev_server, order_amount, minimum_price, currency_from, currency_to, allow_take) => {

  const parameters = { api_key, api_version, use_dev_server, order_amount, minimum_price, currency_from, currency_to, allow_take };

  const bitexApi = new BitexApi(api_key, api_version, use_dev_server);

  let fromCount;
  try {
    fromCount = await bitexApi.loadFromBalance();
  } catch (error) {
    return {
      status: 'error',
      raw_requests: parameters,
      description: "Can't get balance",
      error
    };
  }

  console.log('Available balance in currency_from: ', fromCount);

  const tickerId = `${currency_from}_${currency_to}`;

  let asks;
  try {
    asks = await bitexApi.getFromToCoinsAsk();
  } catch (error) {
    return {
      status: 'error',
      raw_requests: parameters,
      description: "Can't get asks",
      error
    };
  }

  const lowestAsk = asks.find(item => item.id == tickerId);

  if (!lowestAsk) {
    return {
      status: 'error',
      raw_requests: parameters,
      description: `No lowest ask for ${tickerId}`
    };
  } else {
    console.log(`Lowest sell order price for ticker (${tickerId}): `, lowestAsk.ask);

    // Cancel all active orders for current ticker pair
    let openOrders;
    try {
      openOrders = await bitexApi.getFromToCoinOpenOrders();
    } catch (error) {
      return {
        status: 'error',
        raw_requests: parameters,
        description: "Can't get orders",
        error
      };
    }

    const openOrdersForTicker = openOrders
      .filter(order => order.attributes.orderbook_code === tickerId);

    if (openOrdersForTicker.length > 0) {
      console.log(`Cancel open ${tickerId} orders:`,
        openOrdersForTicker.map(order => order.id).join(','));

      for (let order of openOrdersForTicker) {
        try {
          await bitexApi.cancelOrder(order.id);
        } catch (error) {
          return {
            status: 'error',
            raw_requests: parameters,
            description: `Can't get cancel order: ${order.id}`,
            error
          };
        }
      }

      try {
        fromCount = await bitexApi.loadFromBalance();
      } catch (error) {
        return {
          status: 'error',
          raw_requests: parameters,
          description: "Can't get balance",
          error
        };
      }
      console.log('New available balance in currency_from: ', fromCount);
    }

    if (fromCount > 0) {
      // create orders for selling of currency_from
      const sellFromAmount = Math.min(fromCount, order_amount);
      const lowestAsk = asks.find(item => item.id === tickerId);

      if (lowestAsk) {
        console.log('Creating order for currency_from amount: ', sellFromAmount, ' ticker: ', tickerId);

        const price = allow_take ?
          Math.max(lowestAsk.ask, minimum_price) :
          Math.max(lowestAsk.ask - 0.01, minimum_price);

        let placeResult;
        try {
          placeResult = await bitexApi.placeSellFromToCoinOrder(tickerId,
            sellFromAmount, price);
        } catch (error) {
          return {
            status: 'error',
            raw_requests: parameters,
            description: "Can't place sell order",
            error
          };
        }

        return {
          status: 'success',
          raw_requests: parameters,
          raw_responses: placeResult,
          record_id: placeResult.id
        };
      }
    } else {
      return {
        status: 'error',
        raw_requests: parameters,
        description: 'Zero balance'
      };
    }
  }
};

(async () => {
  const result = await tick(
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx',
    '2.1', true, 0.01, 7000, 'btc', 'usd', false);

  console.log('Place order result: ', JSON.stringify(result, null, 2));
})();

module.exports = tick;
