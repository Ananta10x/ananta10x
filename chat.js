// api/chat.js
// Vercel Serverless Function — this runs on the SERVER, never in the browser.
// The Groq API key lives only here, as an environment variable. It is never
// sent to or visible from the user's device.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY. Add it in Vercel → Project → Settings → Environment Variables.' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required.' });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      return res.status(groqResponse.status).json({ error: `Groq API error: ${errBody}` });
    }

    const data = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content || 'No response generated.';

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error.' });
  }
}
