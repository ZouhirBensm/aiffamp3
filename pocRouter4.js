// POST /poc4/convert

// This router is destined for the android version on the app

// This router is non functional and operations under development context.

// This router has is trying to implement the system to update the client on the status of their conversion (i.e. uses FFmpeg progress inner mechanics). The update client mechanics are implemented in the ./pocRouter2.js script /poc/convert.

const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs_regular = require('fs');
const fs = require('fs').promises;
const router = express.Router();


const multerConfig = {
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.aiff' && ext !== '.aif') {
      return cb(new Error('Only AIFF files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 1127 * 1024 * 1024 // 10% over 1GB
    // fileSize: 1.5 * 1024 * 1024 * 1024 // 1.5GB limit
  }
};
const upload = multer(multerConfig);

// Queue management
const MAX_MEMORY = 32 * 1024 * 1024 * 1024; // 32GB in bytes
let processing = false;
const queue = [];
let currentQueueSize = 0;
const MAX_QUEUE_SIZE = 6;

const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  requests: new Map()
};


const rateLimiter = async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  for (const [storedIp, data] of RATE_LIMIT.requests) {
    if (now - data.startTime > RATE_LIMIT.windowMs) {
      RATE_LIMIT.requests.delete(storedIp);
    }
  }
  let ipData = RATE_LIMIT.requests.get(ip);
  if (!ipData) {
    ipData = { count: 0, startTime: now };
  }
  if (now - ipData.startTime > RATE_LIMIT.windowMs) {
    ipData = { count: 0, startTime: now };
  }
  if (ipData.count >= RATE_LIMIT.maxRequests) {
    return res.status(429).send('Too many requests. Please try again later.');
  }
  ipData.count++;
  RATE_LIMIT.requests.set(ip, ipData);
  next();
};




const checkLimits = (req, res, next) => {
  console.log("queue.length, MAX_QUEUE_SIZE:", queue.length, MAX_QUEUE_SIZE);
  if (queue.length >= MAX_QUEUE_SIZE) {
    return res.status(503).send('Server queue limit reached. Please try again later.');
  }

  const contentLength = parseInt(req.headers['content-length'], 10);
  // console.log("\n\ncontentLength: ", contentLength, "\n\n")
  // const contentLength = NaN // For testing

  if (contentLength && !isNaN(contentLength)) {
    if (currentQueueSize + contentLength > MAX_MEMORY) {
      return res.status(503).send('Server memory limit reached. Please try again later. 1');
    }
  }

  next();
};


async function ensureUploadDir() {
  try {
    await fs.mkdir('uploads', { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const formattedSize = parseFloat((bytes / Math.pow(1024, unitIndex)).toFixed(2));

  return `${formattedSize} ${units[unitIndex]}`;
}


async function logRequest(ip, filesize) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - IP: ${ip} - File: ${formatFileSize(filesize)}\n`;
  try {
    await fs.appendFile(path.join(__dirname, 'request_logs.txt'), logEntry);
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}


async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (err) {
    console.error('Error getting file size:', err);
    return 0;
  }
}



// Process queue. 
// This can have 4 different types on implementation.
async function processQueue() {
  // auto_download_mp3_queue_function.js
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

    res.download(outputPath, 'converted.mp3', async (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }

      currentQueueSize -= await getFileSize(filePath);
      await fs.unlink(filePath).catch(() => { });
      await fs.unlink(outputPath).catch(() => { });

      processing = false;
      processQueue();
    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).send('Error converting file');
    currentQueueSize -= await getFileSize(filePath);
    await fs.unlink(filePath).catch(() => { });
    processing = false;
    processQueue();
  }
}



router.post(
  '/convert',
  rateLimiter,
  checkLimits,
  upload.single('file'),
  async (req, res) => {

    console.log("\n\nHit! /poc4/convert\n\n")

    await ensureUploadDir();

    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    // Kept in case you are having CORS issues
    // res.header('Access-Control-Allow-Origin', '*');
    // res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    // res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');


    const ip = req.headers['x-real-ip'] || req.ip;
    // || req.connection.remoteAddress;


    await logRequest(ip, req.file.size);


    const filePath = req.file.path;
    const outputPath = path.join('uploads', `${req.file.filename}.mp3`);
    const fileSize = await getFileSize(filePath);

    if (currentQueueSize + fileSize > MAX_MEMORY) {
      await fs.unlink(filePath).catch(() => { });
      return res.status(503).send('Server memory limit reached. Please try again later. 2');
    }

    currentQueueSize += fileSize;
    queue.push({ req, res, filePath, outputPath });
    processQueue();
  },
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send('File too large');
      }
    }
    if (err.message === 'Only AIFF files are allowed') {
      return res.status(400).send(err.message);
    }
    next(err);
  }
);



module.exports = router;