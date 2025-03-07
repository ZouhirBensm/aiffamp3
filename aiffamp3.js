const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT;

app.use('/public', express.static('public'));


// Rate limiting to prevent spam/DOS attacks
const limiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 66, // Limit each IP to 66 requests per windowMs
});
app.use(limiter);

// Temporary storage for uploaded files
const upload = multer({
  dest: 'uploads/', // Store files in an 'uploads' directory
  limits: {
    fileSize: 100 * 1024 * 1024, // Limit file size to 100MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow .aiff files
    if (file.mimetype === 'audio/aiff' || file.mimetype === 'audio/x-aiff') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only AIFF files are allowed.'));
    }
  },
});




// Queue for managing simultaneous requests
const queue = [];
let isProcessing = false;

// Function to process the queue
const processQueue = () => {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const { filePath, outputPath, res } = queue.shift();

  // Convert AIFF to MP3 using FFmpeg
  exec(`ffmpeg -i ${filePath} ${outputPath}`, (error) => {
    if (error) {
      res.status(500).send('Conversion failed');
    } else {
      // Send the converted file back to the user
      res.download(outputPath, () => {
        // Clean up files after download
        fs.unlinkSync(filePath);
        fs.unlinkSync(outputPath);
      });
    }

    // Process the next item in the queue
    isProcessing = false;
    processQueue();
  });
};


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});



// POST endpoint for file upload and conversion
app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded or invalid file type.');
  }

  const filePath = req.file.path;
  const outputPath = path.join('uploads', `${uuidv4()}.mp3`);

  // Add the conversion task to the queue
  queue.push({ filePath, outputPath, res });

  // Process the queue if not already processing
  processQueue();
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
