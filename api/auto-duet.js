export default async function handler(req, res) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict CORS: Allow same-origin or localhost
  const origin = req.headers.origin || '';
  if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { url, title } = req.body || {};
    let songTitle = (title || 'Duet Song').slice(0, 120);

    if (url) {
      // Validate YouTube URL to prevent SSRF
      const ytPattern = /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_\-]+(\S*)?$/;
      if (!ytPattern.test(String(url).trim())) {
        return res.status(400).json({ status: 'error', message: 'Invalid YouTube URL provided.' });
      }

      try {
        const oeRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oeRes.ok) {
          const oeData = await oeRes.json();
          songTitle = oeData.title || songTitle;
        }
      } catch (_) {}
    }

    return res.status(200).json({
      status: 'ok',
      title: songTitle,
      environment: 'vercel-serverless'
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Request processing error' });
  }
}
