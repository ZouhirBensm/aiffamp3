// POST /poc4/convert

// This router is destined for the android version on the app

// This router is non functional and operations under development context.

// This router has is trying to implement the system to update the client on the status of their conversion (i.e. uses FFmpeg progress inner mechanics). The update client mechanics are implemented in the ./pocRouter2.js script /poc/convert.

const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.aiff' && ext !== '.aif') {
      return cb(new Error('Only AIFF files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 1127 * 1024 * 1024 }
});

const MAX_MEMORY = 32 * 1024 * 1024 * 1024;
let processing = false;
const queue = [];
let currentQueueSize = 0;
const tasks = new Map();

function generateTaskId() {
  return Math.random().toString(36).substring(2, 10);
}

async function processQueue() {
  if (processing || queue.length === 0) return;

  processing = true;
  const { taskId, filePath, outputPath } = queue.shift();
  tasks.set(taskId, { status: 'processing', progress: 0 });

  try {
    await new Promise((resolve, reject) => {
      const ffmpeg = exec(`ffmpeg -i ${filePath} ${outputPath}`, (error) => {
        if (error) reject(error);
        else resolve();
      });

      ffmpeg.stderr.on('data', (data) => {
        const timeMatch = data.toString().match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const progress = Math.min(99, Math.round(Math.random() * 100)); // Simplified progress
          tasks.set(taskId, { ...tasks.get(taskId), progress });
        }
      });
    });

    tasks.set(taskId, { status: 'completed', progress: 100 });
    currentQueueSize -= (await fs.stat(filePath)).size;
    await fs.unlink(filePath);
  } catch (error) {
    tasks.set(taskId, { status: 'error', progress: 0 });
    currentQueueSize -= (await fs.stat(filePath)).size;
    await fs.unlink(filePath);
  } finally {
    processing = false;
    processQueue();
  }
}

router.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');

  const filePath = req.file.path;
  const outputPath = path.join('uploads', `${req.file.filename}.mp3`);
  const fileSize = req.file.size;

  if (currentQueueSize + fileSize > MAX_MEMORY) {
    await fs.unlink(filePath);
    return res.status(503).send('Server memory limit reached');
  }

  const taskId = generateTaskId();
  tasks.set(taskId, { status: 'queued', progress: 0 });
  currentQueueSize += fileSize;
  queue.push({ taskId, filePath, outputPath });
  processQueue();
  res.json({ taskId });
});

router.get('/status/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).send('Task not found');
  res.json(task);
});

module.exports = router;