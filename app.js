const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const Redis = require('ioredis');
const { ipLimiter, userIdlimiter, ipRequestCounter, userRequestCounter } = require('./middleware/rateLimit');
const app = express();

const server = new WebSocket.Server({ port: 443 });
const bitstampWebSocket = new WebSocket('wss://ws.bitstamp.net');

app.use(ipLimiter)
//負數和1~1000之外需考慮進去
app.get('/data', userIdlimiter, async (req, res) => {
  try {
    const userId = req.query.user;

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

// redis
const redis = new Redis('redis://127.0.0.1:6379');

const userSubscriptions = {};

//測試訂閱
server.on('connection', (ws) => {

  console.log('Client connected')
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(data.currencyPair)
      if (data.action === 'subscribe') {
        console.log('subscribe')
        subscribeToCurrencyPair(ws, data.currencyPair);
      } else if (data.action === 'unsubscribe') {
        unsubscribeFromCurrencyPair(ws, data.currencyPair);
      }
    } catch (error) {
      console.log(error)
    }
  });

  ws.on('close', () => {
    unsubscribeAllFromUser(ws);
  });
});

function subscribeToCurrencyPair(ws, currencyPair) {
  if (!userSubscriptions[ws]) {
    userSubscriptions[ws] = [];
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

    
    console.log(`Subscribed to ${currencyPair}`);
  }
}

//測試 Bitstamp websocket API
bitstampWebSocket.on('open', () => {
  console.log('Connected to Bitstamp WebSocket API');
  const subscribeMsg = JSON.stringify({
    event: 'bts:subscribe',
    data: {
      channel: 'live_trades_btcusd',
    },
  });
  bitstampWebSocket.send(subscribeMsg);
});

bitstampWebSocket.on('message', (message) => {
  const data = JSON.parse(message);

  if (data.event === 'trade') {
    const tradeData = data.data;
    console.log('Received trade data:', tradeData);
  }
});
bitstampWebSocket.on('close', () => {
  console.log('Disconnected from Bitstamp WebSocket API');
});
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
      ws.send(JSON.stringify(unsubscribeMsg));

      console.log(`Unsubscribed from ${currencyPair}`);
    }
  }
}

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
