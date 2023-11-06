const rateLimit = require('express-rate-limit');

const ipRequestCounter = new Map();
const userRequestCounter = new Map();

const ipLimiter = rateLimit({
  windowMs: 60000, //1分鐘
  max: 10, //請求次數
  handler: (req, res) => {
    const ip = req.ip;
    const userId = req.query.user;
    
    const ipCount = ipRequestCounter.get(ip) || 0;
    const userCount = userRequestCounter.get(userId) || 0;
    console.log(String(ipCount)+" "+String(userCount))
    res.status(429).json({ ip: ipCount, id: userCount });
  },
});

const userIdlimiter = rateLimit({
  windowMs: 60000, 
  max: 5, 
  keyGenerator: (req) => req.query.user, //ID限制
  handler: (req, res) => {
    const ip = req.ip;
    const userId = req.query.user;
    const ipCount = ipRequestCounter.get(ip) || 0;
    const userCount = userRequestCounter.get(userId) || 0;
    console.log(String(ipCount)+" "+String(userCount))
    res.status(429).json({ ip: ipCount, id: userCount });
  },
});

module.exports = {
  ipLimiter,
  userIdlimiter,
  ipRequestCounter,
  userRequestCounter,
};
