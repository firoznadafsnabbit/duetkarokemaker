import crypto from 'crypto';
import https from 'https';

const DEFAULT_ADMIN_PASSWORD_HASH = '196f2deff8658060de89629dae41bbb4:cf49c84b2c38a7002793f32aa83304cab88424a6003cbea7017721eabd2aa151a57d2c4cb3daa79e22299c807cb792a3dcdbb452b0d6ed042d2c9f47ea28cbbe';
const ADMIN_PIN_HASH = 'eb6bc73d96ed6151ecd61522213e11aa:88b19367db018aa7a168ff7ddb926bdb3cffd4add588c1a07c9be144d5b9c8b6df04c837a38504b1c2c15b18a67622c4fdfe69a28eec4fae75b654ca134da300';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'feroznadafm@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH).trim();
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'duet-default-secret-change-me';

const SUPABASE_URL = 'https://odvgmniswfpahwkqwtcw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmdtbmlzd2ZwYWh3a3F3dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzE4MTksImV4cCI6MjEwNzEwNzgxOX0.dl3gytRtsokArFxN_VH2nMABfAF35757ghOnm-dYESs';

function verifyHash(password, hashRecord) {
  if (!hashRecord || !password) return false;
  try {
    const [saltHex, hashHex] = hashRecord.split(':');
    if (!saltHex || !hashHex) return false;
    const saltBuf = Buffer.from(saltHex, 'hex');
    const computedBuf = crypto.pbkdf2Sync(password, saltBuf, 100000, 64, 'sha512');
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch (_) {
    return false;
  }
}

function verifyAdminPassword(password) {
  if (!password) return false;
  if (verifyHash(password, ADMIN_PASSWORD_HASH)) return true;
  if (verifyHash(password, DEFAULT_ADMIN_PASSWORD_HASH)) return true;
  if (verifyHash(password, ADMIN_PIN_HASH)) return true;
  return false;
}

function fetchSupabaseAdminSession() {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        email: ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD || 'FerozSana@521#'
      });

      const req = https.request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 4000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token && parsed.refresh_token) {
              resolve({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token
              });
              return;
            }
          } catch (_) {}
          resolve(null);
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    } catch (_) {
      resolve(null);
    }
  });
}

function createAdminSessionToken(email) {
  const expiresAt = Date.now() + (2 * 60 * 60 * 1000);
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

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const inputEmail = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || body.pin || '').trim();

    if (!password) {
      return res.status(400).json({ status: 'error', message: 'Admin password or PIN is required.' });
    }

    const isEmailValid = !inputEmail ||
      inputEmail === ADMIN_EMAIL ||
      inputEmail === 'feroznadafm@gmail.com' ||
      inputEmail === 'admin@example.com' ||
      inputEmail === 'admin' ||
      inputEmail === 'feroznadaf';

    const isPasswordValid = verifyAdminPassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials. Access denied.' });
    }

    const email = ADMIN_EMAIL;
    const token = createAdminSessionToken(email);
    const isSecure = req.headers['x-forwarded-proto'] === 'https';

    res.setHeader('Set-Cookie', [
      `duet_admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${isSecure ? '; Secure' : ''}`
    ]);

    // Securely bridge to Supabase session for admin DB controls
    const supabaseSession = await fetchSupabaseAdminSession();

    return res.status(200).json({
      success: true,
      email,
      token,
      supabaseSession,
      message: 'Admin authorization successful'
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Authentication error occurred.' });
  }
}
