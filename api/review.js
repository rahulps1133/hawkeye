export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const { systemPrompt, userContent } = req.body;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: userContent }] }
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 16000,
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(response.status).json({ error: data.error.message || 'Gemini API error', raw: data });
    }

    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const text = candidate?.content?.parts?.[0]?.text || '';

    if (!text) {
      // No text came back — surface why (e.g. SAFETY, RECITATION, MAX_TOKENS, blocked prompt)
      const blockReason = data?.promptFeedback?.blockReason;
      return res.status(200).json({
        error: `Gemini returned no usable text. finishReason: ${finishReason || 'unknown'}${blockReason ? ', blockReason: ' + blockReason : ''}`,
        raw: data
      });
    }

    if (finishReason === 'MAX_TOKENS') {
      return res.status(200).json({
        error: 'Response was cut off because it hit the token limit. Try a shorter document or fewer reference files.',
        text
      });
    }

    return res.status(200).json({ text, finishReason });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '12mb' } }
};
