const fs = require('fs');
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

const jsonFileToObj = (inputFileName) => {
  let jsonDb = {};
  if (fs.existsSync(inputFileName)) {
    jsonDb = JSON.parse(fs.readFileSync(inputFileName));
  } else {
    console.log(`\nInput file name ${inputFileName} doesn't exist`);
    process.exit(1);
  }

  return jsonDb;
};

module.exports = {
  jsonFileToObj,
  BitexApi,
};
