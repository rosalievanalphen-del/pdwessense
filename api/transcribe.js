// Vercel serverless — audio transcription via OpenAI Whisper
// Accepts base64-encoded audio from the browser, returns transcript text
// Requires OPENAI_API_KEY in Vercel environment variables

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not set in Vercel environment variables' });
  }

  try {
    const { audio, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'No audio data received' });

    const audioBuffer = Buffer.from(audio, 'base64');
    const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : mimeType && mimeType.includes('ogg') ? 'ogg' : 'webm';

    // Node 18+ has built-in FormData + Blob
    const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'recording.' + ext);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      body: formData
    });

    const data = await response.json();
    if (data.text) return res.json({ transcript: data.text });
    return res.status(500).json({ error: data.error?.message || 'Transcription failed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
