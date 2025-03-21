const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();


// In-memory task store (for simplicity; use a DB in production)
const tasks = new Map();

// Configure multer for file uploads
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
    fileSize: 1.5 * 1024 * 1024 * 1024 // 1GB limit
  }
};
const upload = multer(multerConfig);

// Queue management
const MAX_MEMORY = 32 * 1024 * 1024 * 1024; // 32GB in bytes
let processing = false;
const queue = [];
let currentQueueSize = 0; // in bytes
const MAX_QUEUE_SIZE = 6; // Max 6 items in queue

// Rate limiter configuration
const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  requests: new Map()
};



// Generate a simple task ID
function generateTaskId() {
  return Math.random().toString(36).substring(2, 10);
}



// Custom rate limiter middleware
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

// Middleware to check queue size and memory before upload
const checkLimits = (req, res, next) => {
  if (queue.length >= MAX_QUEUE_SIZE) {
    return res.status(503).send('Server queue limit reached. Please try again later.');
  }

  const contentLength = parseInt(req.headers['content-length'], 10);
  if (contentLength && !isNaN(contentLength)) {
    if (currentQueueSize + contentLength > MAX_MEMORY) {
      return res.status(503).send('Server memory limit reached. Please try again later.');
    }
  }

  next();
};

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
    await fs.appendFile(path.join(__dirname, 'request_logs.txt'), logEntry);
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



// Updated processQueue with status updates
async function processQueueWithStatus(taskId) {
  if (processing || queue.length === 0) return;

  processing = true;
  const { taskId: currentTaskId, filePath, outputPath } = queue.shift();
  tasks.set(currentTaskId, { status: 'processing', progress: 0, filePath, outputPath });

  try {
      await new Promise((resolve, reject) => {
          // Simulate some progress (since FFmpeg doesn't provide it natively here)
          const ffmpeg = exec(`ffmpeg -i ${filePath} ${outputPath}`, (error) => {
              if (error) reject(error);
              else resolve();
          });

          // Fake progress for simplicity (in reality, you'd parse FFmpeg stderr)
          let progress = 0;
          const interval = setInterval(() => {
              progress += 25;
              if (progress <= 100) {
                  tasks.set(currentTaskId, { ...tasks.get(currentTaskId), progress });
              }
          }, 1000); // Update every second

          ffmpeg.on('close', () => clearInterval(interval));
      });

      tasks.set(currentTaskId, { status: 'completed', progress: 100, filePath, outputPath });

      currentQueueSize -= await getFileSize(filePath);
      await fs.unlink(filePath).catch(() => {});
      processing = false;
      processQueueWithStatus(tasks.keys().next().value); // Next in queue
  } catch (error) {
      console.error('Conversion error:', error);
      tasks.set(currentTaskId, { status: 'error', progress: 0, filePath, outputPath });
      currentQueueSize -= await getFileSize(filePath);
      await fs.unlink(filePath).catch(() => {});
      processing = false;
      processQueueWithStatus(tasks.keys().next().value);
  }
}




// Existing /convert endpoint (modified)
router.post(
  '/convert',
  rateLimiter,
  checkLimits,
  upload.single('file'),
  async (req, res) => {
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
          await fs.unlink(filePath).catch(() => {});
          return res.status(503).send('Server memory limit reached. Please try again later.');
      }

      const taskId = generateTaskId();
      tasks.set(taskId, { status: 'queued', progress: 0, filePath, outputPath });

      currentQueueSize += fileSize;
      queue.push({ taskId, filePath, outputPath });
      processQueueWithStatus(taskId);

      // Return task ID immediately
      res.json({ taskId });
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



// New status endpoint
router.get('/status/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  const task = tasks.get(taskId);

  if (!task) {
      return res.status(404).send('Task not found');
  }

  res.json({ status: task.status, progress: task.progress });
});


// New download endpoint
router.get('/download/:taskId', async (req, res) => {
  const taskId = req.params.taskId;
  const task = tasks.get(taskId);

  if (!task || task.status !== 'completed') {
      return res.status(404).send('File not ready or not found');
  }

  res.download(task.outputPath, 'converted.mp3', async (err) => {
      if (err) {
          console.error('Error sending file:', err);
          return res.status(500).send('Error downloading file');
      }

      // Cleanup after download
      await fs.unlink(task.outputPath).catch(() => {});
      tasks.delete(taskId);
  });
});






router.get('/webpage', (req, res) => {
  const filePath = path.join(__dirname, 'public/poc/html/webpage2.html');
  console.log('File Path:', filePath); // Log the resolved path
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      return res.status(500).send('Something went wrong! poc 1');
    }
  });
});






module.exports = router;