// This router is not referenced, used nor activated from the main aiffamp3.js script

// This router was used for the following reasons:
// 1. In order to test added router functionality
// 2. To test the serving of a new HTML webpage
// 3. To test the ability to make a POST request from client, retrieve a mp3 from server file system, execute a download from the server onto the client

const express = require('express');
const path = require('path');
const router = express.Router();
const fs = require('fs');



router.get('/one', (req, res) => {
  return res.status(200).json({
    message: 'Hello, POC one!',
  });
});


router.get('/webpage1', (req, res) => {
  const filePath = path.join(__dirname, 'public/poc/html/webpage1.html');
  console.log('File Path:', filePath); // Log the resolved path
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      return res.status(500).send('Something went wrong! poc 1');
    }
  });
});


router.get('/webpage2', (req, res) => {
  const filePath = path.join(__dirname, 'public/poc/html/webpage2.html');
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
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  res.download(filePath, 'med60.mp3', (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      return res.status(500).json({ message: 'Something went wrong while downloading the file' });
    }
  });
});



module.exports = router;


