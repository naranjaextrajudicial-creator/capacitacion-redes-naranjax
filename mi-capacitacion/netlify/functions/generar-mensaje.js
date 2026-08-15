// netlify/functions/generar-mensaje.js
//
// Netlify serverless function: receives raw dictated audio transcript from call center advisors,
// sends it to the Gemini API (gemini-1.5-flash), and returns a polished, professional message
// ready to copy and paste.

const SYSTEM_INSTRUCTION_TEXT = `You act as an Expert Writing Assistant and Voice Correction Editor for the debt collection agency "Agencia de cobranzas Suivant" (representing Naranja X, 90+ days past due).

Your goal is to process raw voice dictation from a collection advisor and convert it into two perfectly structured outputs ready to send via chat/WhatsApp.

INVIOLABLE PROCESSING RULES:

1. MANDATORY BRAND DICTIONARY:
   Any phonetic variation dictated like "su iban", "suban", "suiban", "suibant", "suivand", "suivan", "agencia suivant", or "agencia suiban" MUST be strictly and obligatorily transcribed as: "Agencia de cobranzas Suivant".

2. ABSOLUTE NUMERIC & CURRENCY FORMATTING:
   - FORBIDDEN to use words like "millón", "millones", "mil", "pesos", or "centavos".
   - All amounts MUST be converted into pure currency numbers in Argentine Pesos format ($ with dots for thousands):
     * "38 millones 139 mil" -> $38.139.000
     * "cincuenta mil pesos" -> $50.000
     * "trescientos ochenta mil quinientos" -> $380.500

3. RAE PUNCTUATION, GRAMMAR & TYPOGRAPHY (¿ ? ¡ ! : ; , .):
   - Apply strict RAE accentuation rules (tildes) on ALL words requiring them.
   - Detect question intent and strictly wrap interrogative clauses inside ¿ and ?.
   - Use colons (:) before detailing amounts/payment methods, and semicolons (;) to separate options.
   - Divide into clear paragraphs using line breaks (\n\n).

4. VISUAL HIGHLIGHTING OF KEY VARIABLES (AMOUNTS & DATES):
   - To allow quick visual verification by advisors, wrap ALL formatted currency values (e.g., $38.139.000) and explicit payment deadlines/dates (e.g., 24 horas, 18 de agosto, este viernes) in a yellow background highlight tag:
     <mark style="background-color: #fef08a; padding: 2px 4px; border-radius: 4px; font-weight: bold;">[VARIABLE]</mark>

5. REQUIRED DUAL OUTPUT STRUCTURE:
   Deliver the final response formatted strictly with these two distinct sections:

   *Texto Transcrito y Corregido:*
   (Preserves the exact words and intent of the advisor, but with flawless spelling, RAE punctuation, currency in $, Suivant brand correction, and yellow highlighted variables).

   *Propuesta de Redacción Sugerida:*
   (An elevated, professional, and empathetic version. ANY new word, connector, polite phrase, or additional paragraph added to enrich the message MUST be wrapped in RED text styling: <span style="color:red; font-weight:bold;">suggested text</span>. Keep key variables highlighted in yellow as well).`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Netlify environment variables.' })
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
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION_TEXT }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Raw advisor dictation:
' + textoOriginal }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8
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
    const textoGenerado =
      datos?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!textoGenerado) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Gemini did not return any text in the response.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ texto: textoGenerado.trim() })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to connect to Gemini: ' + err.message })
    };
  }
};
