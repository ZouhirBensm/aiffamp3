const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
// const os = require('os');

const app = express();
const PORT = process.env.PORT;

app.use('/public', express.static('public'));

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.aiff' && ext !== '.aif') {
      return cb(new Error('Only AIFF files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 1 * 1024 * 1024 * 1024 // Optional: 1GB limit as an example
    // fileSize: 1024 * 1024 // Optional: 1GB limit as an example
  }
}).single('file');



// Queue management
// const MAX_MEMORY = 1024 * 1024; // For testing
const MAX_MEMORY = 32 * 1024 * 1024 * 1024; // 32GB in bytes
let processing = false;
const queue = [];
let currentQueueSize = 0; // in bytes



// Rate limiter configuration
const RATE_LIMIT = {
  maxRequests: 10, // Max requests per IP
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  requests: new Map() // Map to store IP request counts and timestamps
};

// Custom rate limiter middleware
const rateLimiter = async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  // Clean up old entries
  for (const [storedIp, data] of RATE_LIMIT.requests) {
    if (now - data.startTime > RATE_LIMIT.windowMs) {
      RATE_LIMIT.requests.delete(storedIp);
    }
  }

  // Get or initialize IP data
  let ipData = RATE_LIMIT.requests.get(ip);
  if (!ipData) {
    ipData = {
      count: 0,
      startTime: now
    };
  }

  // Check rate limit
  if (now - ipData.startTime > RATE_LIMIT.windowMs) {
    // Reset if window has expired
    ipData = {
      count: 0,
      startTime: now
    };
  }

  if (ipData.count >= RATE_LIMIT.maxRequests) {
    return res.status(429).send('Too many requests. Please try again later.');
  }

  // Increment count and store
  ipData.count++;
  RATE_LIMIT.requests.set(ip, ipData);

  next();
};

// Log file path
const logFile = path.join(__dirname, 'request_logs.txt');

// Ensure uploads directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir('uploads', { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}

// Log request with IP
async function logRequest(ip) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - IP: ${ip}\n`;
  try {
    await fs.appendFile(logFile, logEntry);
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}

// Check file size
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (err) {
    console.error('Error getting file size:', err);
    return 0;
  }
}

// Process queue
async function processQueue() {
  if (processing || queue.length === 0) return;

  processing = true;
  const { req, res, filePath, outputPath } = queue.shift();

  try {
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -i ${filePath} ${outputPath}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Temporary change: Save file to converted/ directory instead of sending
    const finalOutputPath = path.join(__dirname, 'converted', `${path.basename(filePath)}.mp3`);
    await fs.mkdir(path.join(__dirname, 'converted'), { recursive: true }); // Ensure directory exists
    await fs.rename(outputPath, finalOutputPath); // Move file to converted/

    // Send success response instead of file download
    res.status(200).send(`File converted and saved to: ${finalOutputPath}`);

    // Cleanup
    currentQueueSize -= await getFileSize(filePath);
    await fs.unlink(filePath).catch(() => { });

    processing = false;
    processQueue(); // Process next in queue

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).send('Error converting file');
    currentQueueSize -= await getFileSize(filePath);
    await fs.unlink(filePath).catch(() => { });
    processing = false;
    processQueue();
  }
}
app.post(
  '/convert',
  rateLimiter, // Standard middleware
  upload,      // Multer middleware (can throw errors)
  async (req, res) => { // Route handler (only runs if no errors)
    await ensureUploadDir();

    const ip = req.ip || req.connection.remoteAddress;
    await logRequest(ip);

    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const filePath = req.file.path;
    const outputPath = path.join('uploads', `${req.file.filename}.mp3`);
    const fileSize = await getFileSize(filePath);

    if (currentQueueSize + fileSize > MAX_MEMORY) {
      await fs.unlink(filePath).catch(() => { });
      return res.status(503).send('Server memory limit reached. Please try again later.');
    }

    currentQueueSize += fileSize;
    queue.push({ req, res, filePath, outputPath });
    processQueue();
  },
  (err, req, res, next) => { // Error handler (only runs if error occurs)
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send('File too large');
      }
      // Add more Multer-specific error codes if needed
    }
    if (err.message === 'Only AIFF files are allowed') {
      return res.status(400).send(err.message);
    }
    next(err); // Pass unhandled errors to global error handler
  }
);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

const gracefulShutdown = async () => {
  console.log('Closing the app gracefully...');
  await Promise.all(
    queue.map(item => fs.unlink(item.filePath).catch(() => { }))
  );
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});