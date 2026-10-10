import crypto from 'crypto';

const DEFAULT_ADMIN_PASSWORD_HASH = '196f2deff8658060de89629dae41bbb4:cf49c84b2c38a7002793f32aa83304cab88424a6003cbea7017721eabd2aa151a57d2c4cb3daa79e22299c807cb792a3dcdbb452b0d6ed042d2c9f47ea28cbbe';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'feroznadafm@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH).trim();
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'duet-default-secret-change-me';

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
  } catch (_) {
    return false;
  }
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
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    const isEmailValid = email === ADMIN_EMAIL;
    const isPasswordValid = verifyAdminPassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return res.status(401).json({ status: 'error', message: 'Invalid administrator credentials. Access denied.' });
    }

    const token = createAdminSessionToken(email);
    const isSecure = req.headers['x-forwarded-proto'] === 'https';

    res.setHeader('Set-Cookie', [
      `duet_admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${isSecure ? '; Secure' : ''}`
    ]);

    return res.status(200).json({
      success: true,
      email,
      token,
      message: 'Admin authorization successful'
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Authentication error occurred.' });
  }
}
