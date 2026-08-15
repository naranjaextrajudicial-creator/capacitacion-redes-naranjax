// netlify/functions/corregir-mejorar.js
//
// Netlify serverless function for the "Corrector Ortográfico y Mejorador" module.
// Receives raw text pasted by the advisor, sends it to Gemini asking for TWO
// clearly separated versions (strict spelling correction + AI-enhanced version
// with additions wrapped in red <span> tags), and returns both to the frontend.
//
// REQUIRED NETLIFY CONFIGURATION (shared with the voice transcription module —
// no extra setup needed if you already configured it):
// 1. Netlify → your site → Site configuration → Environment variables
// 2. Key:   GEMINI_API_KEY
//    Value: (your actual Gemini API key from Google AI Studio)
// 3. Trigger a redeploy so Netlify picks up the variable.
//
// The API key MUST NEVER be hardcoded in this file or exposed to the frontend client.

// Delimitador fijo para separar las dos versiones en la respuesta de Gemini.
// Tiene que coincidir EXACTAMENTE con el que espera el JavaScript del frontend
// (constante CORR_DELIMITADOR en index.html).
const DELIMITADOR = '###VERSION2###';

const SYSTEM_PROMPT = `Actúas como un Corrector Ortográfico y Editor Experto para asesores de cobranzas (Agencia de cobranzas Suivant, en representación de Naranja X).
Procesa el texto recibido y devuelve DOS versiones bien diferenciadas.

VERSIÓN 1 (Corrección Ortográfica Estricta):
- Corrige únicamente faltas de ortografía, tildes, comas, puntos y signos de interrogación (¿ ?).
- MANTENÉ EXACTAMENTE las mismas palabras y el sentido original del asesor. NO agregues ni quites ideas, no reformules oraciones, no cambies el vocabulario.

VERSIÓN 2 (Texto Mejorado por IA):
- Eleva la redacción a un nivel profesional, fluido, empático y persuasivo.
- Podés sugerir mejores sinónimos, reestructurar oraciones o agregar párrafos aclaratorios.
- REQUISITO OBLIGATORIO: CUALQUIER palabra nueva, cambio de redacción, sinónimo sugerido o párrafo agregado DEBE estar envuelto en esta etiqueta exacta: <span style="color: red; font-weight: bold;">texto sugerido</span>. El texto base que no cambie debe quedar sin la etiqueta, en texto normal.

FORMATO DE RESPUESTA OBLIGATORIO — segui esta estructura exacta, sin agregar nada antes ni después:

VERSIÓN 1 (texto plano, sin HTML, sin comillas)
${DELIMITADOR}
VERSIÓN 2 (con las etiquetas <span style="color: red; font-weight: bold;">...</span> donde corresponda)

No agregues explicaciones, títulos adicionales, ni ningún texto fuera de esas dos versiones y el delimitador.`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'GEMINI_API_KEY is not configured in Netlify environment variables.'
      })
    };
  }

  let textoOriginal = '';
  try {
    const body = JSON.parse(event.body || '{}');
    textoOriginal = (body.texto || '').toString().trim();
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  if (!textoOriginal) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing input text to process.' }) };
  }

  try {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' +
      apiKey;

    const respuestaGemini = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: SYSTEM_PROMPT + '\n\nTexto del asesor a procesar:\n' + textoOriginal }]
          }
        ],
        generationConfig: {
          temperature: 0.4
        }
      })
    });

    if (!respuestaGemini.ok) {
      const detalle = await respuestaGemini.text();
      return {
        statusCode: respuestaGemini.status,
        body: JSON.stringify({ error: 'Gemini API Error: ' + detalle })
      };
    }

    const datos = await respuestaGemini.json();
    const textoCrudo =
      datos &&
      datos.candidates &&
      datos.candidates[0] &&
      datos.candidates[0].content &&
      datos.candidates[0].content.parts &&
      datos.candidates[0].content.parts[0]
        ? datos.candidates[0].content.parts[0].text
        : '';

    if (!textoCrudo) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Gemini did not return any text in the response.' })
      };
    }

    // Separamos las dos versiones usando el delimitador fijo.
    const partes = textoCrudo.split(DELIMITADOR);
    const textoA = (partes[0] || '').trim();
    const textoB = (partes[1] || '').trim();

    if (!textoA && !textoB) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'No se pudo separar las dos versiones en la respuesta de Gemini.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        textoA: textoA || textoCrudo.trim(),
        textoB: textoB || ''
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to connect to Gemini: ' + err.message })
    };
  }
};
