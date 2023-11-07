const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const Redis = require('ioredis');
const { ipLimiter, userIdlimiter, ipRequestCounter, userRequestCounter } = require('./middleware/rateLimit');
const redis = new Redis('redis://127.0.0.1:6379');
const app = express();

const server = new WebSocket.Server({ port: 443 });
const bitstampWebSocket = new WebSocket('wss://ws.bitstamp.net');

app.use(ipLimiter)
//負數和1~1000之外需考慮進去
app.get('/data', userIdlimiter, async (req, res) => {
  try {
    const userId = req.query.user;

    if (isNaN(userId) || userId < 1 || userId > 1000) {
      res.status(400).send('Invalid user ID');
      return;
    }
    
    const response = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty');
    const data = response.data;
    const result = data.filter((number) => number % userId === 0);

    res.json({ result });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }

  const ip = req.ip;
  const user = req.query.user;

  ipRequestCounter.set(ip, (ipRequestCounter.get(ip) || 0) + 1);
  userRequestCounter.set(user, (userRequestCounter.get(user) || 0) + 1);

});



const userSubscriptions = {};

//測試訂閱
server.on('connection', (ws) => {
  
  console.log('Client connected')
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'subscribe') {
        console.log('subscribe')
        for (const pair of data.currencyPair){
          console.log(pair)
          subscribeToCurrencyPair(ws, pair);
        }     
      } else if (data.action === 'unsubscribe') {
        for (const pair of data.currencyPair){
          console.log(pair)
          unsubscribeFromCurrencyPair(ws, pair);
        }     
      }
    } catch (error) {
      console.log(error)
    }
  });

  ws.on('close', () => {
    console.log('close')
  });
});

function subscribeToCurrencyPair(ws, currencyPair) {
  if (!userSubscriptions[ws]) {
    userSubscriptions[ws] = [];
    console.log(userSubscriptions)
  }
  if (!userSubscriptions[ws].includes(currencyPair)) {
    userSubscriptions[ws].push(currencyPair);
    console.log(`live_trades_${currencyPair}`)
    const subscribeMsg = {
      event: 'bts:subscribe',
      data: {
        channel: `live_trades_${currencyPair}`,
      },
    };
    bitstampWebSocket.send(JSON.stringify(subscribeMsg));
    console.log(`Send to bitstamp message`)
    
    console.log(`Subscribed to ${currencyPair}`);
  }
}

function unsubscribeFromCurrencyPair(ws, currencyPair) {
  if (userSubscriptions[ws]) {
    const index = userSubscriptions[ws].indexOf(currencyPair);
    if (index !== -1) {
      userSubscriptions[ws].splice(index, 1);

      const unsubscribeMsg = {
        event: 'bts:unsubscribe',
        data: {
          channel: `live_trades_${currencyPair}`,
        },
      };
      bitstampWebSocket.send(JSON.stringify(unsubscribeMsg));

      console.log(`Unsubscribed from ${currencyPair}`);
    }
  }
}

//放入相對應的幣種
app.get('/api/ohlc/:currencyPair', async (req, res) => {
  const currencyPair = req.params.currencyPair;
  const ohlcData = await getOHLCData(currencyPair);

  if (ohlcData) {
    res.json(ohlcData);
  } else {
    res.status(404).json({ error: 'OHLC data not found' });
  }
});

async function getOHLCData(currencyPair) {
  const key = `ohlc:${currencyPair}`;
  const ohlcData = await redis.get(key);
  if (ohlcData) {
    console.log(`Redis get the key ${key}`)
    return JSON.parse(ohlcData);
  } else {

    //如果有抓到資料就放入redis並設為15分鐘期限
    const newOHLCData = await fetchOHLCFromBitstamp(currencyPair);
    if (newOHLCData) {
      await redis.setex(key, 900, JSON.stringify(newOHLCData));
      return newOHLCData;
    }
    return null;
  }
}

async function fetchOHLCFromBitstamp(currencyPair) {
  try {
    const url = `https://www.bitstamp.net/api/v2/ohlc/${currencyPair}/?step=60&limit=1`;
    console.log(url)
    const response = await axios.get(url);
    
    if (response.status === 200) {
      const ohlcData = response.data.data.ohlc;
      if (ohlcData && ohlcData.length > 0) {
        const latestOHLC = ohlcData[0];
        return {
          open: latestOHLC.open,
          high: latestOHLC.high,
          low: latestOHLC.low,
          close: latestOHLC.close,
        };
      }
    }

    return null;
  } catch (error) {

    console.error('Error fetching OHLC data from Bitstamp:', error);
    return null;
  }
}

bitstampWebSocket.on('message', (message) => {
  const data = JSON.parse(message);

  if (data.event === 'trade') {
    //回傳資料根據切割channel最後的幣種，方便顯示是哪個幣種的即時價格 
    //e.g. live_trades_btcusd
    const channelParts = data.channel.split('_');
    const currencypairString = channelParts[channelParts.length - 1];
    const tradeData = data.data; 
    console.log('Currency pair:', currencypairString);
    console.log('Received trade data:', tradeData);
  }
});
bitstampWebSocket.on('close', () => {
  console.log('Disconnected from Bitstamp WebSocket API');
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
