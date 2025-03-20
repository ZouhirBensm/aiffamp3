const express = require('express');
const path = require('path');
const router = express.Router();
const fs = require('fs');
// const fsp = fs.promises;


let processing = false;
const queue = [];




router.get('/one', (req, res) => {
  return res.status(200).json({
    message: 'Hello, POC one!',
  });
});


router.get('/webpage1', (req, res) => {
  const filePath = path.join(__dirname, 'public/poc/webpage1.html');
  console.log('File Path:', filePath); // Log the resolved path
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      return res.status(500).send('Something went wrong! poc 1');
    }
  });
});


router.get('/webpage2', (req, res) => {
  const filePath = path.join(__dirname, 'public/poc/webpage2.html');
  console.log('File Path:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      return res.status(500).send('Something went wrong! poc 2');
    }
  });
});



router.post('/post1', async (req, res) => {
  const filePath = path.join(__dirname, './converted/med60.mp3');
  
  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  // Set the headers to prompt the browser to download the file
  res.download(filePath, 'med60.mp3', (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      return res.status(500).json({ message: 'Something went wrong while downloading the file' });
    }
  });
});



module.exports = router;


