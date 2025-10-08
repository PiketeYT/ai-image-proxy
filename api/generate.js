import fetch from 'node-fetch';

// 🔹 Variable global para almacenar los intentos por IP (temporal, se reinicia si Vercel reinicia la función)
const attemptCounts = {};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // 🧠 Identificar al usuario por IP
    const userIP =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.connection?.remoteAddress ||
      'unknown';

    // Inicializar contador
    if (!attemptCounts[userIP]) {
      attemptCounts[userIP] = { count: 0, lastAttempt: Date.now() };
    }

    // Si ha pasado mucho tiempo, reiniciar (opcional: cada 24 horas)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - attemptCounts[userIP].lastAttempt > ONE_DAY) {
      attemptCounts[userIP].count = 0;
    }

    // 📉 Comprobar si superó los 5 intentos
    if (attemptCounts[userIP].count >= 5) {
      return res.status(429).json({
        error:
          'Has alcanzado tus intentos de diseño libre. Para más información contacta con all-in@espinillerasfutbol.es',
      });
    }

    // Incrementar contador
    attemptCounts[userIP].count++;
    attemptCounts[userIP].lastAttempt = Date.now();

    // Datos del prompt
    const { prompt, style, images } = req.body;

    const API_KEY = process.env.GOOGLE_API_KEY;

    const contents = [
      {
        role: 'user',
        parts: [
          { text: `Genera una imagen de producto estilo ${style}. Descripción: ${prompt}` },
          ...(images || []).map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
      },
    ];

    const payload = {
      contents,
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    const candidate = data.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.mimeType.startsWith('image/')
    );

    if (!imagePart)
      return res.status(500).json({ error: 'No se generó imagen' });

    res.status(200).json({
      image_base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
