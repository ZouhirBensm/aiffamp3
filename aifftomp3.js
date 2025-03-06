const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use('/public', express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});


const gracefulShutdown = () => {
  console.log('Closing the app gracefully...');
  // Perform any cleanup actions here (close DB connections, etc)
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
