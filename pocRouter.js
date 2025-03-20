const express = require('express');
const path = require('path');
const router = express.Router();



router.get('/one', (req, res) => {
  
  return res.status(200).json({
    message: 'Hello, POC one!',
  });

});


router.get('/webpage1', (req, res) => {
  const filePath = path.join(__dirname, './public/poc/webpage1.html');
  console.log('File Path:', filePath); // Log the resolved path
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      return res.status(500).send('Something went wrong! 2');
    }
  });
});


// Export the router so it can be used in app.js
module.exports = router;
