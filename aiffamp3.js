//123

// The main script serves the main GET / GET /privacy-policy HTML webpages
// This code is essentially holds solely the mechanics of conversion. 
// The mechanics of polling the server to get an update of where the conversion is at is not implemented here. 
// The code here is kept as a reference so that I will be able to use to edit the code towards using multi-thread processing when the time to scale arives. 
// I can simply also use this code to test out the conversion mechanics, debugging, and to help me identify any issues in the code currently used in production.

const express = require('express');
const dotenv = require('dotenv');
const pocRouter3 = require('./pocRouter3');
const pocRouter4 = require('./pocRouter4');
const pocRouter2 = require('./pocRouter2');
dotenv.config();
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs').promises;
const fs_regular = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT;

app.set('trust proxy', true);

app.use('/public', express.static('public'));



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
    // fileSize: 1024 * 1024 // 100MB limit for testing
  }
};
const upload = multer(multerConfig);


// Queue management
const MAX_MEMORY = 32 * 1024 * 1024 * 1024; // 32GB in bytes
// const MAX_MEMORY = 590 * 1024 * 1024; // 590MB for testing with med60.aiff which is 649MB
// const MAX_MEMORY = 1024 * 1024; // 1MB for testing
let processing = false;
const queue = [];
let currentQueueSize = 0; // in bytes
const MAX_QUEUE_SIZE = 6; // Max 6 item in queue
// const MAX_QUEUE_SIZE = 1;



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



// Middleware to check queue size and memory before upload
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


const logFile = path.join(__dirname, 'request_logs.txt');


async function ensureUploadDir() {
  try {
    await fs.mkdir('uploads', { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}



async function logRequest(ip) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - IP: ${ip}\n`;
  try {
    await fs.appendFile(logFile, logEntry);
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
  // auto_save_mp3_queue_function.js
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

    const finalOutputPath = path.join(__dirname, 'converted', `${path.basename(filePath)}.mp3`);
    await fs.mkdir(path.join(__dirname, 'converted'), { recursive: true });
    await fs.rename(outputPath, finalOutputPath);

    res.status(200).send(`File converted and saved to: ${finalOutputPath}`);

    currentQueueSize -= await getFileSize(filePath);
    await fs.unlink(filePath).catch(() => {});
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).send('Error converting file');
    currentQueueSize -= await getFileSize(filePath);
    await fs.unlink(filePath).catch(() => {});
  } finally {
    processing = false;
    processQueue(); // Process next in queue
  }
}





app.use('/poc', pocRouter2)
// TODO turn off pocRouter3 once pocRouter4 functions as intended
app.use('/poc3', pocRouter3)

app.use('/poc4', pocRouter4)





// Temporarly turned and commented off this endpoint POST /convert
// // Conversion endpoint
// app.post(
//   '/convert',
//   rateLimiter,
//   checkLimits,
//   upload.single('file'),
//   async (req, res) => {
//     await ensureUploadDir();

//     const ip = req.ip || req.connection.remoteAddress;
//     await logRequest(ip);

//     if (!req.file) {
//       return res.status(400).send('No file uploaded');
//     }

//     const filePath = req.file.path;
//     const outputPath = path.join('uploads', `${req.file.filename}.mp3`);
//     const fileSize = await getFileSize(filePath);

//     if (currentQueueSize + fileSize > MAX_MEMORY) {
//       await fs.unlink(filePath).catch(() => {});
//       return res.status(503).send('Server memory limit reached. Please try again later. 2');
//     }

//     currentQueueSize += fileSize;
//     queue.push({ req, res, filePath, outputPath });
//     // console.log("queue.length, MAX_QUEUE_SIZE:", queue.length, MAX_QUEUE_SIZE);
//     processQueue();
//   },
//   (err, req, res, next) => {
//     if (err instanceof multer.MulterError) {
//       if (err.code === 'LIMIT_FILE_SIZE') {
//         return res.status(400).send('File too large');
//       }
//     }
//     if (err.message === 'Only AIFF files are allowed') {
//       return res.status(400).send(err.message);
//     }
//     next(err);
//   }
// );







app.get('/', (req, res) => {
  console.log(process.env.ENV_NAV_URL);
  const filePath = path.join(__dirname, 'public/poc/html/webpage2.html');

  console.log('File Path:', filePath);

  fs_regular.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Something went wrong while reading the file!');
    }

    const modifiedHtml = data.replace(
      '</head>',
      `<script>window.ENV_NAV_URL = "${process.env.ENV_NAV_URL || ''}";</script></head>`
    );

    res.send(modifiedHtml);
  });
});


// Route to handle NGINX-forwarded 413 errors
app.get('/error', (req, res) => {
  res.status(413).send('File too large 2');
});



app.get('/privacy-policy', (req, res) => {

  const filePath = path.join(__dirname, 'public/privacy-policy.html');
  console.log('File Path:', filePath);

  fs_regular.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error loading privacy policy');
    }

    res.type('html').send(data);
  });
});




// Error handling middleware. Catches as next(error) calls or undealt with error in the lifecycle.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong! 1');
});





const gracefulShutdown = async () => {
  console.log('Closing the app gracefully...');
  await Promise.all(queue.map(item => fs.unlink(item.filePath).catch(() => { })));
  process.exit(0);
};


process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});