export default function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  // In serverless cloud deployment, notify client to use client-side canvas recorder
  return res.status(501).json({
    status: 'error',
    ffmpegAvailable: false,
    message: 'Server-side FFmpeg rendering is disabled in serverless cloud environments. Please use real-time in-browser Canvas/MediaRecorder export.'
  });
}
