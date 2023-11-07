# fuglePreTest

安裝套件
```
npm install
```

開啟terminal跑程式
```
npm run dev
```


## websocket server : ws://localhost:443/streaming

訂閱機制:

```json
{
    {
    "action": "subscribe",
    "currencyPair": ["btcusd", "ethusd", "xrpusd", "ltcusd", "bchusd", "ethbtc", "xrpbtc", "ltcbtc", "bchbtc", "eosusd"]
}
}
```

```json
{
    "action": "unsubscribe",
    "currencyPair": ["ethusd", "xrpusd", "ltcusd", "bchusd", "ethbtc", "xrpbtc", "ltcbtc", "bchbtc", "eosusd"]
}
```
此時上面範例Json應當只監聽btcusd的訊息。

## 取得OHLC
取得（例如btcusd）的OHLC資料：
```
GET /api/ohlc/btcusd
```
```json
{
    "open": "34743",
    "high": "34743",
    "low": "34743",
    "close": "34743"
}
```
