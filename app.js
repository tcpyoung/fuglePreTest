const express = require('express');
const axios = require('axios');
const app = express();

app.get('/data', async (req, res) => {
  try {
    const userId = req.query.user;

    const response = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty');
    const data = response.data;
    const result = data.filter((number) => number % userId === 0);

    res.json({ result });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }

});

const port = 6379;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
