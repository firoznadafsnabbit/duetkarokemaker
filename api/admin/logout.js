export default function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  res.setHeader('Set-Cookie', [
    'duet_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  ]);
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}
