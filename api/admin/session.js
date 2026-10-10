import crypto from 'crypto';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'duet-default-secret-change-me';

function verifyAdminSession(req) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token && req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  }

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

export default function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  const session = verifyAdminSession(req);
  if (!session) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: No active admin session' });
  }

  return res.status(200).json({ authenticated: true, email: session.email });
}
