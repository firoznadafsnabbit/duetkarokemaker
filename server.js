const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMP_DIR = path.join(os.tmpdir(), 'duet-karaoke');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// MIME types mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ass': 'text/plain; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Universal H.264 High 4.1 + AAC + Faststart encoding preset (100% playable on Mobile, TV, PC, WhatsApp)
const UNIVERSAL_MP4_ARGS = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-profile:v', 'high',
  '-level', '4.1',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '44100',
  '-ac', '2',
  '-movflags', '+faststart'
];

// ==========================================
// 1. REUSABLE UTILITIES & RESPONSE HELPERS (DRY)
// ==========================================

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
};

const sendError = (res, statusCode, message, details = null) => {
  sendJson(res, statusCode, {
    status: 'error',
    error: message,
    message,
    ...(details ? { details } : {})
  });
};

const generateJobId = (prefix = 'job') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const decodeBase64Payload = (dataUriOrBase64) => {
  const cleanBase64 = dataUriOrBase64.replace(/^data:[a-zA-Z0-9\/\-+.]+;base64,/, '');
  return Buffer.from(cleanBase64, 'base64');
};

const escapeAssPath = (filePath) => {
  let normalized = filePath.replace(/\\/g, '/');
  if (process.platform === 'win32') {
    normalized = normalized.replace(/:/g, '\\:');
  }
  return normalized;
};

const cleanFiles = (...filePaths) => {
  for (const fp of filePaths) {
    if (fp) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {}
    }
  }
};

// Promise-based process runner with automated temp file cleanup
const execProcess = (cmd, args, { tempFilesToClean = [] } = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });

    child.on('close', code => {
      cleanFiles(...tempFilesToClean);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Process exited with code ${code}`);
        error.code = code;
        error.stderr = stderr;
        error.stdout = stdout;
        reject(error);
      }
    });

    child.on('error', err => {
      cleanFiles(...tempFilesToClean);
      reject(err);
    });
  });
};

// ==========================================
// 2. FFMPEG DETECTION (CACHED)
// ==========================================
let resolvedFFmpeg = null;

function getFFmpegPath() {
  if (resolvedFFmpeg && fs.existsSync(resolvedFFmpeg)) return resolvedFFmpeg;

  // 1. Check system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0].trim();
    if (out && fs.existsSync(out)) {
      resolvedFFmpeg = out;
      return resolvedFFmpeg;
    }
  } catch (_) {}

  // 2. Check Windows WinGet packages directory directly
  if (process.platform === 'win32') {
    const wingetPkg = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetPkg)) {
      try {
        const dirs = fs.readdirSync(wingetPkg);
        for (const d of dirs) {
          if (d.toLowerCase().includes('ffmpeg')) {
            const pkgPath = path.join(wingetPkg, d);
            const subdirs = fs.readdirSync(pkgPath);
            for (const sd of subdirs) {
              const candidate = path.join(pkgPath, sd, 'bin', 'ffmpeg.exe');
              if (fs.existsSync(candidate)) {
                resolvedFFmpeg = candidate;
                return resolvedFFmpeg;
              }
            }
          }
        }
      } catch (_) {}
    }
  }

  return null;
}

const checkFFmpeg = () => getFFmpegPath() !== null;

// ==========================================
// 3. REQUEST BODY PARSING (DRY)
// ==========================================
const parseJsonBody = (req) => {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      // Protect memory on 4GB RAM systems: cap body at 150MB
      if (data.length > 150 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large (150MB limit)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
};

// ==========================================
// 4. STATIC FILE HANDLER
// ==========================================
const serveStatic = (res, pathname) => {
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) ? '/index.html' : '/studio.html';
  } else if (safePath === '/admin' || safePath === '\\admin') {
    safePath = '/admin.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end('<h1>404 Not Found</h1><p>Duet Karaoke Maker web asset not found.</p>');
  }
};

// ==========================================
// 5. HTTP SERVER & API ROUTING
// ==========================================
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const { pathname } = parsedUrl;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API: Status check ---
  if (pathname === '/api/status' && req.method === 'GET') {
    const ffmpegPath = getFFmpegPath();
    return sendJson(res, 200, {
      status: 'ok',
      ffmpegAvailable: ffmpegPath !== null,
      ffmpegPath,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      tempDir: TEMP_DIR
    });
  }

  // --- API: Server-side FFmpeg Subtitle Video Render ---
  if (pathname === '/api/render-ffmpeg' && req.method === 'POST') {
    if (!checkFFmpeg()) {
      return sendError(res, 400, 'FFmpeg is not installed in system PATH. Use in-browser rendering or install FFmpeg via install_ffmpeg.bat.');
    }

    try {
      const body = await parseJsonBody(req);
      const { audioBase64, audioExt, assContent, serverAudioFile } = body;

      if ((!audioBase64 && !serverAudioFile) || !assContent) {
        return sendError(res, 400, 'Missing audio data or ASS subtitle content.');
      }

      const jobId = generateJobId('karaoke');
      let audioPath = '';
      const assPath = path.join(TEMP_DIR, `${jobId}.ass`);
      const outputPath = path.join(TEMP_DIR, `${jobId}.mp4`);
      const filesToClean = [assPath];

      if (serverAudioFile) {
        const fname = path.basename(serverAudioFile);
        const existingPath = path.join(TEMP_DIR, fname);
        if (fs.existsSync(existingPath)) {
          audioPath = existingPath;
        }
      }

      if (!audioPath && audioBase64) {
        audioPath = path.join(TEMP_DIR, `${jobId}.${audioExt || 'mp3'}`);
        fs.writeFileSync(audioPath, decodeBase64Payload(audioBase64));
        filesToClean.push(audioPath);
      }

      if (!audioPath || !fs.existsSync(audioPath)) {
        return sendError(res, 400, 'Audio file not found or could not be loaded.');
      }

      fs.writeFileSync(assPath, assContent, 'utf-8');

      const assPathEscaped = escapeAssPath(assPath);
      const ffmpegArgs = [
        '-y',
        '-f', 'lavfi',
        '-i', 'color=c=black:s=1920x1080:r=30',
        '-i', audioPath,
        '-vf', `ass='${assPathEscaped}'`,
        '-shortest',
        ...UNIVERSAL_MP4_ARGS,
        outputPath
      ];

      console.log(`[FFmpeg] Rendering job ${jobId} via ${getFFmpegPath()}...`);
      await execProcess(getFFmpegPath() || 'ffmpeg', ffmpegArgs, { tempFilesToClean: filesToClean });

      if (fs.existsSync(outputPath)) {
        return sendJson(res, 200, {
          success: true,
          jobId,
          downloadUrl: `/api/download/${jobId}.mp4`
        });
      } else {
        return sendError(res, 500, 'FFmpeg output file not generated.');
      }
    } catch (err) {
      console.error('[FFmpeg Render Error]', err);
      return sendError(res, 500, 'FFmpeg render failed. Check if font or libass is supported.', err.stderr?.slice(-500) || err.message);
    }
  }

  // --- API: Convert client-recorded canvas video to universal H.264 MP4 ---
  if (pathname === '/api/convert-recording' && req.method === 'POST') {
    if (!checkFFmpeg()) {
      return sendError(res, 400, 'FFmpeg is not installed in system PATH.');
    }

    try {
      const body = await parseJsonBody(req);
      const { videoBase64, mimeType } = body;

      if (!videoBase64) {
        return sendError(res, 400, 'Missing recorded video data.');
      }

      const jobId = generateJobId('recorded');
      const inputExt = (mimeType && mimeType.includes('mp4')) ? 'mp4' : 'webm';
      const inputPath = path.join(TEMP_DIR, `${jobId}_raw.${inputExt}`);
      const outputPath = path.join(TEMP_DIR, `${jobId}.mp4`);

      fs.writeFileSync(inputPath, decodeBase64Payload(videoBase64));

      const ffmpegArgs = [
        '-y',
        '-i', inputPath,
        ...UNIVERSAL_MP4_ARGS,
        outputPath
      ];

      console.log(`[FFmpeg] Converting recorded canvas video ${jobId} to universal MP4...`);
      await execProcess(getFFmpegPath() || 'ffmpeg', ffmpegArgs, { tempFilesToClean: [inputPath] });

      if (fs.existsSync(outputPath)) {
        return sendJson(res, 200, {
          success: true,
          jobId,
          downloadUrl: `/api/download/${jobId}.mp4`
        });
      } else {
        return sendError(res, 500, 'Conversion failed: output file not found.');
      }
    } catch (err) {
      console.error('[FFmpeg Convert Error]', err);
      return sendError(res, 500, `Conversion failed: ${err.stderr?.slice(-300) || err.message}`);
    }
  }

  // --- API: Unified Auto-Pilot Duet (Local Audio File or YouTube URL) ---
  if ((pathname === '/api/auto-duet' || pathname === '/api/youtube-duet') && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const url = (payload.url || '').trim();
      const apiKey = (payload.apiKey || '').trim();
      const audioBase64 = payload.audioBase64 || '';
      const audioExt = (payload.audioExt || 'mp3').replace(/[^a-zA-Z0-9]/g, '');
      const title = (payload.title || 'Duet Song').trim();

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const scriptPath = path.join(__dirname, 'youtube_duet.py');
      const args = [scriptPath];

      if (url) {
        console.log(`[*] Auto-Duet YouTube request for: ${url}`);
        args.push('--url', url);
      } else if (audioBase64) {
        console.log(`[*] Auto-Duet local file request for: ${title} (.${audioExt})`);
        const jobId = generateJobId('duet_upload');
        const audioPath = path.join(TEMP_DIR, `${jobId}.${audioExt}`);
        fs.writeFileSync(audioPath, decodeBase64Payload(audioBase64));
        args.push('--audio-file', audioPath, '--title', title);
      } else {
        return sendError(res, 400, 'Either a YouTube URL or an audio file is required.');
      }

      if (apiKey) args.push('--api-key', apiKey);

      const { stdout } = await execProcess(pythonCmd, args);

      let jsonCandidate = stdout.trim();
      const jsonIdx = jsonCandidate.lastIndexOf('{"status":');
      if (jsonIdx !== -1) {
        jsonCandidate = jsonCandidate.substring(jsonIdx);
      }

      const parsed = JSON.parse(jsonCandidate);
      return sendJson(res, 200, parsed);
    } catch (err) {
      console.error('[Auto-Duet Error]', err.stderr || err.message);
      let errMsg = 'Failed to extract song and lyrics.';
      try {
        const errParsed = JSON.parse(err.stdout || '{}');
        if (errParsed.message) errMsg = errParsed.message;
      } catch (_) {
        if (err.stderr) errMsg = err.stderr.slice(-300);
      }
      return sendError(res, 500, errMsg);
    }
  }

  // --- API: Download/Stream rendered or extracted audio/video file ---
  if (pathname.startsWith('/api/download/')) {
    const filename = path.basename(pathname.replace('/api/download/', ''));
    const filePath = path.join(TEMP_DIR, filename);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);

      // Auto-clean temporary file after 20 minutes
      setTimeout(() => {
        cleanFiles(filePath);
      }, 1200000);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File not found or expired');
    }
  }

  // --- Static File Serving from /public ---
  serveStatic(res, pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`====================================================`);
  console.log(`   🎤 Duet Karaoke Maker (Ultra-Lite Web App)       `);
  console.log(`====================================================`);
  console.log(`[*] Server running at: ${url}`);
  console.log(`[*] RAM footprint: ~25MB (Optimized for 4GB RAM + HDD)`);
  console.log(`[*] Opening your browser now...`);
  console.log(`====================================================`);
});
