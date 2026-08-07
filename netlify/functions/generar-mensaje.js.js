// netlify/functions/generar-mensaje.js
//
// Función serverless de Netlify: recibe el texto crudo dictado por el asesor,
// lo envía a la API de Gemini (gemini-1.5-flash) y devuelve el mensaje
// corregido y listo para copiar.
//
// IMPORTANTE — CONFIGURACIÓN REQUERIDA EN NETLIFY (una sola vez):
// 1. Netlify → tu sitio → Site configuration → Environment variables → Add a variable
// 2. Key:   GEMINI_API_KEY
//    Value: (tu clave real de Gemini, la que te dio Google AI Studio)
// 3. Volver a desplegar el sitio (Deploys → Trigger deploy) para que tome la variable.
//
// La clave NUNCA va en este archivo ni en ningún archivo del frontend: vive
// únicamente como variable de entorno del lado del servidor. Así, aunque
// cualquiera pueda ver el código del sitio, nadie puede ver ni usar la clave.

const SYSTEM_PROMPT = `Actúas como un Profesor de Lengua y Redactor Experto para la Agencia Suivant (en representación de Naranja X, mora +90 días). Toma la siguiente dictación en crudo de un asesor de cobranzas y reescribela perfectamente para ser enviada por chat:
1. Párrafos: Divide el texto en párrafos claros usando punto y aparte (\\n\\n) según la evolución de las ideas.
2. Puntuación y Preguntas: Aplica reglas estrictas de la RAE, coloca comas, y envuelve las preguntas en signos de apertura y cierre (¿ ?).
3. Moneda: Convierte cualquier monto o número mencionado a formato pesos ($380.000, $50.000).
4. Redacción: Eleva el vocabulario para que suene sumamente profesional, respetuoso, empático y humano. No cambies el sentido ni la intención original del asesor.
Devuelve ÚNICAMENTE el texto final corregido listo para copiar y pegar.`;

exports.handler = async function (event) {
  // Solo aceptamos POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'GEMINI_API_KEY no está configurada en las variables de entorno de Netlify.'
      })
    };
  }

  let textoOriginal = '';
  try {
    const body = JSON.parse(event.body || '{}');
    textoOriginal = (body.texto || '').toString().trim();
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cuerpo de la petición inválido.' }) };
  }

  if (!textoOriginal) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el texto a procesar.' }) };
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
            parts: [{ text: SYSTEM_PROMPT + '\n\nDictado del asesor:\n' + textoOriginal }]
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
        body: JSON.stringify({ error: 'Error de la API de Gemini: ' + detalle })
      };
    }

    const datos = await respuestaGemini.json();
    const textoGenerado =
      datos &&
      datos.candidates &&
      datos.candidates[0] &&
      datos.candidates[0].content &&
      datos.candidates[0].content.parts &&
      datos.candidates[0].content.parts[0]
        ? datos.candidates[0].content.parts[0].text
        : '';

    if (!textoGenerado) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Gemini no devolvió texto en la respuesta.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ texto: textoGenerado.trim() })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Fallo al conectar con Gemini: ' + err.message })
    };
  }
};
