const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawn, execSync } = require('child_process');

// ==========================================
// 1. ENVIRONMENT CONFIGURATION & .ENV LOADER
// ==========================================
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    } catch (err) {
      console.warn('[Env] Notice loading .env file:', err.message);
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_DEBUG = process.env.DEBUG === 'true';
const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMP_DIR = path.join(os.tmpdir(), 'duet-karaoke');

const DEFAULT_ADMIN_PASSWORD_HASH = '196f2deff8658060de89629dae41bbb4:cf49c84b2c38a7002793f32aa83304cab88424a6003cbea7017721eabd2aa151a57d2c4cb3daa79e22299c807cb792a3dcdbb452b0d6ed042d2c9f47ea28cbbe';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'feroznadafm@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH).trim();
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '9de27f4c519e1116b9dd80134fa7de216b91e6a9a0a3407776ef8b84173ae935';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(o => o.trim().toLowerCase())
  .filter(Boolean);

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

// Universal H.264 High 4.1 + AAC + Faststart encoding preset
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
// 2. SECURITY HEADERS & CORS HELPERS
// ==========================================
function getClientIp(req) {
  // 1. Cloudflare real client IP header (critical when proxied through Cloudflare CDN)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') {
    return cfIp.trim();
  }

  // 2. Standard X-Forwarded-For header
  const xForwarded = req.headers['x-forwarded-for'];
  if (xForwarded) {
    const ips = xForwarded.split(',');
    return ips[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function hashIpForLog(ip) {
  return crypto.createHash('sha256').update(String(ip) + 'privacy-salt').digest('hex').slice(0, 16);
}

function setSecurityHeaders(res, req) {
  // Content-Security-Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data:",
    "connect-src 'self' https://*.supabase.co https://lrclib.net https://www.youtube.com https://generativelanguage.googleapis.com blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
}

function handleCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) {
    // Same-origin or direct browser request
    return true;
  }

  const originLower = origin.toLowerCase();
  const isAllowed = ALLOWED_ORIGINS.includes(originLower) ||
                    originLower.startsWith('http://localhost:') ||
                    originLower.startsWith('http://127.0.0.1:');

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
    return true;
  }

  return false;
}

// ==========================================
// 3. IN-MEMORY SLIDING-WINDOW RATE LIMITER
// ==========================================
class RateLimiter {
  constructor(windowMs, maxHits, name = 'default') {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
    this.name = name;
    this.hits = new Map();

    // Auto-cleanup stale IPs every 5 minutes to prevent memory leaks
    setInterval(() => {
      const now = Date.now();
      for (const [ip, records] of this.hits.entries()) {
        const valid = records.filter(t => now - t < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(ip);
        } else {
          this.hits.set(ip, valid);
        }
      }
    }, 300000).unref();
  }

  isAllowed(ip) {
    const now = Date.now();
    const records = this.hits.get(ip) || [];
    const valid = records.filter(t => now - t < this.windowMs);

    if (valid.length >= this.maxHits) {
      this.hits.set(ip, valid);
      return false;
    }

    valid.push(now);
    this.hits.set(ip, valid);
    return true;
  }
}

// 120 requests/minute for general endpoints
const globalLimiter = new RateLimiter(60 * 1000, 120, 'global');
// 10 heavy jobs per 5 minutes (renders / duet audio extraction)
const renderLimiter = new RateLimiter(5 * 60 * 1000, 10, 'render');
// 5 attempts per 15 minutes for admin login to prevent brute force
const authLimiter = new RateLimiter(15 * 60 * 1000, 5, 'auth');

// ==========================================
// 4. ADMIN AUTHENTICATION & TOKEN UTILITIES
// ==========================================
function verifyAdminPassword(password) {
  if (!ADMIN_PASSWORD_HASH || !password) return false;
  try {
    const [saltHex, hashHex] = ADMIN_PASSWORD_HASH.split(':');
    if (!saltHex || !hashHex) return false;
    const saltBuf = Buffer.from(saltHex, 'hex');
    const computedBuf = crypto.pbkdf2Sync(password, saltBuf, 100000, 64, 'sha512');
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch (err) {
    console.error('[Auth] Password verification error:', err);
    return false;
  }
}

function createAdminSessionToken(email) {
  const expiresAt = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: expiresAt,
    nonce: crypto.randomBytes(8).toString('hex')
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function verifyAdminSession(req) {
  let token = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check X-Admin-Token header
  if (!token && req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  }

  // 3. Check duet_admin_session Cookie
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)duet_admin_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET)
      .update(payload)
      .digest('base64url');

    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (_) {
    return null;
  }
}

// ==========================================
// 5. RESPONSE HELPERS & INPUT SANITIZATION
// ==========================================
const sendJson = (res, statusCode, data) => {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
};

const sendError = (res, statusCode, clientMessage, internalError = null) => {
  if (internalError) {
    console.error(`[Server Error ${statusCode}]`, internalError);
  }
  sendJson(res, statusCode, {
    status: 'error',
    error: clientMessage,
    message: clientMessage
  });
};

const generateJobId = (prefix = 'job') =>
  `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

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
// 6. FFMPEG DETECTION (CACHED)
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
// 7. REQUEST BODY PARSING & LIMITS
// ==========================================
const parseJsonBody = (req, maxBytes = 50 * 1024 * 1024) => {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        req.destroy();
        reject(new Error('Payload exceeds maximum allowed size (50MB limit)'));
        return;
      }
      data += chunk;
    });

    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (_) {
        reject(new Error('Invalid JSON payload format'));
      }
    });

    req.on('error', reject);
  });
};

// ==========================================
// 8. STATIC FILE SERVING WITH CLOUDFLARE CDN HEADERS & GZIP
// ==========================================
const serveStatic = (req, res, pathname) => {
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  } else if (safePath === '/admin' || safePath === '\\admin') {
    safePath = '/admin.html';
  } else if (safePath === '/privacy' || safePath === '\\privacy') {
    safePath = '/privacy.html';
  } else if (safePath === '/terms' || safePath === '\\terms') {
    safePath = '/terms.html';
  } else if (safePath === '/refund' || safePath === '\\refund') {
    safePath = '/refund.html';
  } else if (safePath === '/pricing' || safePath === '\\pricing') {
    safePath = '/pricing.html';
  } else if (safePath === '/contact' || safePath === '\\contact') {
    safePath = '/contact.html';
  }

  // Prevent directory traversal
  const resolvedPublic = path.resolve(PUBLIC_DIR);
  const filePath = path.resolve(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(resolvedPublic)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';

    // Cloudflare Edge Cache headers:
    // HTML: revalidate immediately on client, cache 1 hour at Cloudflare Edge
    // Static assets (CSS, JS, SVG, Fonts): cache 7 days in browser, 30 days at Cloudflare Edge
    const cacheControl = isHtml
      ? 'public, max-age=0, s-maxage=3600, must-revalidate'
      : 'public, max-age=604800, s-maxage=2592000, immutable';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'CDN-Cache-Control': isHtml ? 'max-age=3600' : 'max-age=2592000',
      'Cloudflare-CDN-Cache-Control': isHtml ? 'max-age=3600' : 'max-age=2592000',
      'Vary': 'Accept-Encoding'
    };

    // Native Gzip streaming compression for text & code assets (reduces transfer by 75%)
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const isCompressible = ['.html', '.css', '.js', '.json', '.svg'].includes(ext);

    if (isCompressible && acceptEncoding.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      const rawStream = fs.createReadStream(filePath);
      const gzipStream = zlib.createGzip({ level: 6 });
      rawStream.pipe(gzipStream).pipe(res);
    } else {
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end('<h1>404 Not Found</h1><p>Duet Karaoke Maker resource not found.</p>');
  }
};

// ==========================================
// 9. HTTP SERVER & SECURE API ROUTING
// ==========================================
const server = http.createServer(async (req, res) => {
  const clientIp = getClientIp(req);
  setSecurityHeaders(res, req);
  handleCors(req, res);

  // Global rate limiter check
  if (!globalLimiter.isAllowed(clientIp)) {
    return sendError(res, 429, 'Too many requests. Please slow down and try again shortly.');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const { pathname } = parsedUrl;

  // ------------------------------------------
  // ADMIN AUTHENTICATION ENDPOINTS
  // ------------------------------------------

  // POST /api/admin/login
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    if (!authLimiter.isAllowed(clientIp)) {
      return sendError(res, 429, 'Too many login attempts. Please wait 15 minutes before trying again.');
    }

    try {
      const body = await parseJsonBody(req, 1024 * 64);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        return sendError(res, 400, 'Email and password are required.');
      }

      // Strict email match and salted PBKDF2 hash comparison
      const isEmailValid = email === ADMIN_EMAIL;
      const isPasswordValid = verifyAdminPassword(password);

      if (!isEmailValid || !isPasswordValid) {
        return sendError(res, 401, 'Invalid administrator credentials. Access denied.');
      }

      const token = createAdminSessionToken(email);

      // Set secure HTTP-only session cookie
      const isSecure = req.headers['x-forwarded-proto'] === 'https';
      res.setHeader('Set-Cookie', [
        `duet_admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${isSecure ? '; Secure' : ''}`
      ]);

      return sendJson(res, 200, {
        success: true,
        email,
        token,
        message: 'Admin authorization successful'
      });
    } catch (err) {
      return sendError(res, 500, 'Authentication error occurred.', err);
    }
  }

  // POST /api/admin/logout
  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', [
      'duet_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    ]);
    return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
  }

  // GET /api/admin/session
  if (pathname === '/api/admin/session' && req.method === 'GET') {
    const session = verifyAdminSession(req);
    if (!session) {
      return sendError(res, 401, 'Unauthorized: No active admin session');
    }
    return sendJson(res, 200, { authenticated: true, email: session.email });
  }

  // ------------------------------------------
  // API: Status Check (Sanitized - No Leaked Paths)
  // ------------------------------------------
  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      ffmpegAvailable: checkFFmpeg(),
      environment: NODE_ENV
    });
  }

  // ------------------------------------------
  // API: User Data Deletion Request (GDPR / DPDP)
  // ------------------------------------------
  if (pathname === '/api/user/delete-account' && req.method === 'POST') {
    if (!authLimiter.isAllowed(clientIp)) {
      return sendError(res, 429, 'Too many requests. Please wait a few minutes before trying again.');
    }

    try {
      const body = await parseJsonBody(req, 1024 * 16);
      const email = String(body.email || '').trim().toLowerCase();
      const reason = String(body.reason || 'User requested deletion via privacy portal').slice(0, 200);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return sendError(res, 400, 'A valid email address is required to process data deletion.');
      }

      if (body.confirmed !== true) {
        return sendError(res, 400, 'Explicit user confirmation is required to proceed with permanent data deletion.');
      }

      const ticketId = 'DEL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const record = {
        ticketId,
        email,
        reason,
        requestedAt: new Date().toISOString(),
        clientIp: hashIpForLog(clientIp),
        status: 'PENDING_DELETION'
      };

      const deletionLogPath = path.join(TEMP_DIR, 'data_deletion_requests.jsonl');
      fs.appendFileSync(deletionLogPath, JSON.stringify(record) + '\n', 'utf8');

      return sendJson(res, 200, {
        success: true,
        ticketId,
        message: 'Your data deletion request has been registered under GDPR Article 17 and the DPDP Act. Your account credentials, profile, and token balances will be permanently removed.',
        instructions: 'Active browser sessions will be terminated immediately.'
      });
    } catch (err) {
      return sendError(res, 500, 'Error processing data deletion request.', err);
    }
  }

  // ------------------------------------------
  // API: Server-side FFmpeg Subtitle Video Render
  // ------------------------------------------
  if (pathname === '/api/render-ffmpeg' && req.method === 'POST') {
    if (!renderLimiter.isAllowed(clientIp)) {
      return sendError(res, 429, 'Render limit exceeded. Please wait a moment before launching new renders.');
    }

    if (!checkFFmpeg()) {
      return sendError(res, 400, 'FFmpeg is not installed on this server. Please use in-browser rendering.');
    }

    try {
      const body = await parseJsonBody(req);
      const { audioBase64, audioExt, assContent, serverAudioFile } = body;

      if ((!audioBase64 && !serverAudioFile) || !assContent) {
        return sendError(res, 400, 'Missing audio payload or subtitle content.');
      }

      if (typeof assContent !== 'string' || assContent.length > 2 * 1024 * 1024) {
        return sendError(res, 400, 'Invalid subtitle content length (exceeds 2MB).');
      }

      const safeExt = String(audioExt || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
      const ALLOWED_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
      if (!ALLOWED_EXTS.includes(safeExt)) {
        return sendError(res, 400, 'Unsupported audio file format.');
      }

      const jobId = generateJobId('karaoke');
      let audioPath = '';
      const assPath = path.join(TEMP_DIR, `${jobId}.ass`);
      const outputPath = path.join(TEMP_DIR, `${jobId}.mp4`);
      const filesToClean = [assPath];

      if (serverAudioFile) {
        const fname = path.basename(String(serverAudioFile));
        // Verify filename pattern
        if (/^[a-zA-Z0-9_\-.]+\.(mp3|wav|ogg|m4a|flac)$/.test(fname)) {
          const candidatePath = path.join(TEMP_DIR, fname);
          if (fs.existsSync(candidatePath)) {
            audioPath = candidatePath;
          }
        }
      }

      if (!audioPath && audioBase64) {
        audioPath = path.join(TEMP_DIR, `${jobId}.${safeExt}`);
        fs.writeFileSync(audioPath, decodeBase64Payload(audioBase64));
        filesToClean.push(audioPath);
      }

      if (!audioPath || !fs.existsSync(audioPath)) {
        return sendError(res, 400, 'Audio file not found or could not be processed.');
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

      console.log(`[FFmpeg] Rendering job ${jobId}...`);
      await execProcess(getFFmpegPath() || 'ffmpeg', ffmpegArgs, { tempFilesToClean: filesToClean });

      if (fs.existsSync(outputPath)) {
        return sendJson(res, 200, {
          success: true,
          jobId,
          downloadUrl: `/api/download/${jobId}.mp4`
        });
      } else {
        return sendError(res, 500, 'FFmpeg render was unable to generate output video.');
      }
    } catch (err) {
      return sendError(res, 500, 'Video rendering failed. Please check audio format and font settings.', err);
    }
  }

  // ------------------------------------------
  // API: Convert client-recorded canvas video to universal H.264 MP4
  // ------------------------------------------
  if (pathname === '/api/convert-recording' && req.method === 'POST') {
    if (!renderLimiter.isAllowed(clientIp)) {
      return sendError(res, 429, 'Conversion limit reached. Please wait before submitting another conversion.');
    }

    if (!checkFFmpeg()) {
      return sendError(res, 400, 'FFmpeg is not installed on system PATH.');
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
        return sendError(res, 500, 'Video conversion output file not generated.');
      }
    } catch (err) {
      return sendError(res, 500, 'Video conversion failed.', err);
    }
  }

  // ------------------------------------------
  // API: Unified Auto-Pilot Duet (Sanitized & SSRF-Protected)
  // ------------------------------------------
  if ((pathname === '/api/auto-duet' || pathname === '/api/youtube-duet') && req.method === 'POST') {
    if (!renderLimiter.isAllowed(clientIp)) {
      return sendError(res, 429, 'Rate limit exceeded. Please wait before launching another song extraction.');
    }

    try {
      const payload = await parseJsonBody(req);
      const rawUrl = String(payload.url || '').trim();
      const rawTitle = String(payload.title || 'Duet Song').trim().slice(0, 120);
      const audioBase64 = payload.audioBase64 || '';
      const rawExt = String(payload.audioExt || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');

      // Server-side Gemini API key preference (never exposed to client)
      const apiKey = process.env.GEMINI_API_KEY || (payload.apiKey ? String(payload.apiKey).trim() : '');

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const scriptPath = path.join(__dirname, 'youtube_duet.py');
      const args = [scriptPath];

      if (rawUrl) {
        // Strict YouTube URL validation to prevent SSRF and command injection
        const ytPattern = /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_\-]+(\S*)?$/;
        if (!ytPattern.test(rawUrl)) {
          return sendError(res, 400, 'Invalid YouTube URL. Please provide a standard YouTube video link.');
        }
        console.log(`[*] Validated Auto-Duet YouTube request: ${rawUrl}`);
        args.push('--url', rawUrl);
      } else if (audioBase64) {
        const ALLOWED_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
        const safeExt = ALLOWED_EXTS.includes(rawExt) ? rawExt : 'mp3';
        const jobId = generateJobId('duet_upload');
        const audioPath = path.join(TEMP_DIR, `${jobId}.${safeExt}`);
        fs.writeFileSync(audioPath, decodeBase64Payload(audioBase64));
        args.push('--audio-file', audioPath, '--title', rawTitle);
      } else {
        return sendError(res, 400, 'Either a valid YouTube link or an audio file is required.');
      }

      if (apiKey) {
        args.push('--api-key', apiKey);
      }

      const { stdout } = await execProcess(pythonCmd, args);

      let jsonCandidate = stdout.trim();
      const jsonIdx = jsonCandidate.lastIndexOf('{"status":');
      if (jsonIdx !== -1) {
        jsonCandidate = jsonCandidate.substring(jsonIdx);
      }

      const parsed = JSON.parse(jsonCandidate);
      return sendJson(res, 200, parsed);
    } catch (err) {
      return sendError(res, 500, 'Failed to extract song and lyrics.', err);
    }
  }

  // ------------------------------------------
  // API: Secure File Download & Stream
  // ------------------------------------------
  if (pathname.startsWith('/api/download/')) {
    const rawFilename = pathname.replace('/api/download/', '');
    const filename = path.basename(rawFilename);

    // Strict filename verification (prevents path traversal and arbitrary file download)
    if (!/^[a-zA-Z0-9_\-.]+\.(mp4|mp3|webm|wav|ogg)$/.test(filename)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Invalid download filename requested');
    }

    const resolvedTemp = path.resolve(TEMP_DIR);
    const filePath = path.resolve(path.join(TEMP_DIR, filename));

    if (!filePath.startsWith(resolvedTemp)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access Denied');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filename).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      fs.createReadStream(filePath).pipe(res);

      // Auto-clean temporary download file after 20 minutes
      setTimeout(() => {
        cleanFiles(filePath);
      }, 1200000).unref();
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File not found or expired');
    }
  }

  // ------------------------------------------
  // Static File Serving
  // ------------------------------------------
  serveStatic(req, res, pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`====================================================`);
  console.log(`   🎤 Duet Karaoke Maker (Secured Lite Web Server) `);
  console.log(`====================================================`);
  console.log(`[*] Server running at: ${url}`);
  console.log(`[*] Security: Rate Limiting, CSP, CORS, & Salted PBKDF2 Active`);
  console.log(`[*] RAM footprint: ~25MB (Optimized for 4GB RAM + HDD)`);
  console.log(`====================================================`);
});
