import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite cualquier dominio (puedes restringir luego)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder a preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') 
      return res.status(405).json({ error: 'Método no permitido' });

    const { prompt, style, images } = req.body;

    // API Key desde variable de entorno
    const API_KEY = process.env.GOOGLE_API_KEY;

    const contents = [
      {
        role: "user",
        parts: [
          { text: `Genera una imagen de producto estilo ${style}. Descripción: ${prompt}` },
          ...images.map(img => ({
            inlineData: { mimeType: img.mimeType, data: img.data }
          }))
        ]
      }
    ];

    const payload = { contents, generationConfig: { responseModalities: ["TEXT","IMAGE"] } };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    const candidate = data.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(
      p => p.inlineData && p.inlineData.mimeType.startsWith('image/')
    );

    if (!imagePart) return res.status(500).json({ error: 'No se generó imagen' });

    res.status(200).json({ image_base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
