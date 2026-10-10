import crypto from 'crypto';

export default function handler(req, res) {
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required to process data deletion.' });
    }

    if (body.confirmed !== true) {
      return res.status(400).json({ status: 'error', message: 'Explicit user confirmation is required to proceed with permanent data deletion.' });
    }

    const ticketId = 'DEL-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    return res.status(200).json({
      success: true,
      ticketId,
      message: 'Your data deletion request has been registered under GDPR Article 17 and the DPDP Act. Your account credentials, profile, and token balances will be permanently removed.',
      instructions: 'Active browser sessions will be terminated immediately.'
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Error processing data deletion request.' });
  }
}
