// 123
const express = require('express');
const dotenv = require('dotenv');
// const path = require('path'); // Add path module


dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use('/public', express.static('public'));
// app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html')); // Use path.join for dynamic paths
// });


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



