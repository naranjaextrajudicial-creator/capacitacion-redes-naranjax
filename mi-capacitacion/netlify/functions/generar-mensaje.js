// netlify/functions/generar-mensaje.js
//
// Netlify serverless function: receives raw dictated audio transcript from call center advisors,
// sends it to the Gemini API (gemini-1.5-flash), and returns a polished, professional message
// ready to copy and paste.
//
// REQUIRED NETLIFY CONFIGURATION (one-time setup):
// 1. Netlify → your site → Site configuration → Environment variables → Add a variable
// 2. Key:   GEMINI_API_KEY
//    Value: (your actual Gemini API key from Google AI Studio)
// 3. Trigger a redeploy (Deploys → Trigger deploy) so Netlify picks up the variable.
//
// The API key MUST NEVER be hardcoded in this file or exposed to the frontend client.
//
// ---------------------------------------------------------------------------
// CUSTOM SPELLING / GRAMMAR / SYSTEM PROMPT RULES:
// Edit the SYSTEM_PROMPT string below to fine-tune Gemini's response rules.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Actúas como un Profesor de Lengua y Redactor Experto para la Agencia de cobranzas Suivant (en representación de Naranja X, mora +90 días). Toma la siguiente dictación en crudo de un asesor de cobranzas y reescribela perfectamente para ser enviada por chat:
1. Párrafos: Divide el texto en párrafos claros usando punto y aparte (\n\n) según la evolución de las ideas.
2. Puntuación y Preguntas: Aplica reglas estrictas de la RAE, coloca comas, y envuelve las preguntas en signos de apertura y cierre (¿ ?).
3. Moneda: Convierte cualquier monto o número mencionado a formato pesos ($380.000, $50.000).
4. Redacción: Eleva el vocabulario para que suene sumamente profesional, respetuoso, empático y humano. No cambies el sentido ni la intención original del asesor.
5. Corrección de Marca/Nombre: Cada vez que detectes variaciones fonéticas o transcripciones erróneas producidas por el dictado de voz como "su iban", "suiban", "iban", "agencia suiban", "agencia suivant" o variaciones similares, debes transcribir de forma exacta y obligatoria únicamente como "Agencia de cobranzas Suivant".
6. Formato de Montos y Millones: Cero tolerancia a palabras escritas como "millón", "millones" o "centavos". Todos los números y montos representados en millones o miles deben escribirse estrictamente con números, signo de pesos ($), puntos para separar miles y coma para los centavos (Ejemplos obligatorios: $3.098.456,00 - $567.535,77 - $45.753,00).
7. Ajuste de Tono y Agregados de IA: Redacta el mensaje usando una lógica clara, natural, fluida pero firme, apta para un entorno profesional de cobranzas y lista para copiar y pegar directamente. Tienes la facultad de mejorar o expandir la frase para que suene más pulida. Si decides agregar texto, conectores o frases completas adicionales a lo expresado literalmente por el asesor para enriquecer el mensaje, debes formatear ese texto agregado especificando el código HTML/Markdown de color rojo <span style="color:red;">texto agregado</span> aclarando que es una adición.
8. Tildes y Ortografía Completa: Aplicá TODAS las reglas de acentuación de la RAE en TODA palabra del texto, no solo en pronombres interrogativos. Corregí sistemáticamente palabras dictadas sin tilde que la requieren (ejemplos: telefono→teléfono, numero→número, dia→día, informacion→información, atencion→atención, tambien→también, credito→crédito, gestion→gestión, deposito→depósito, ultimo→último, mas→más cuando es adverbio de cantidad, segun→según, asi→así). Ninguna palabra debe quedar sin su tilde correcta.
9. Homófonos y Confusiones Ortográficas Frecuentes: Corregí los errores de confusión típicos del habla transcripta, eligiendo siempre la forma correcta según el sentido de la oración: "a ver" vs. "haber" (haber es participio/verbo auxiliar, a ver es expresión de comprobación), "hay" vs. "ahí" vs. "¡ay!", "halla" vs. "haya" vs. "allá", "tuvo" vs. "tubo", "hecho" vs. "echo", "sino" vs. "si no", "porque" vs. "por qué" vs. "porqué" vs. "por que", "valla" vs. "vaya" vs. "baya".
10. Muletillas, Titubeos y Repeticiones: Eliminá por completo palabras de relleno sin contenido ("eh", "este...", "o sea", "digamos", "bueno", "viste", "che", "ehh", "mmm") y palabras duplicadas por titubeo al hablar (ejemplo: "el el cliente" → "el cliente", "que que tenga" → "que tenga"). El mensaje final no debe contener rastros de que fue dictado en voz alta.
11. Voseo Argentino Consistente: Usá siempre la conjugación de voseo rioplatense de forma consistente en todo el mensaje ("tenés", "podés", "sabés", "confirmame", "contame"), nunca mezclado con formas de tuteo ("tienes", "puedes", "sabes"). Si el asesor dictó en tuteo por error, convertilo a voseo.
12. Mayúsculas Correctas: Capitalizá únicamente la primera letra de cada oración, la palabra que sigue a un punto, y los nombres propios (Naranja X, Agencia de cobranzas Suivant). Eliminá cualquier mayúscula intermedia incorrecta que haya quedado a mitad de oración por pausas del reconocimiento de voz (por ejemplo "Te Escribo Porque" debe quedar "Te escribo porque").
13. Espaciado y Signos de Puntuación: Sin espacio antes de coma, punto, signo de cierre de pregunta o exclamación. Exactamente un espacio después de cada signo de puntuación (salvo al final de párrafo). Sin espacio pegado después de un signo de apertura ¿ o ¡. Nunca dejar espacios dobles. Reducí cualquier repetición de signos ("???", "!!!", "....") a un uso correcto y único.
14. Fechas y Horarios: Escribí las fechas de forma completa y clara ("15 de julio", "el viernes 18"), nunca en formato numérico ambiguo tipo "15/7". Escribí los horarios de forma clara ("a las 15:00" o "a las 3 de la tarde"), manteniendo el mismo formato elegido durante todo el mensaje.
15. No Inventar Datos Concretos: Nunca inventes un monto, fecha, plazo o dato específico que el asesor no haya mencionado. Si falta un dato puntual necesario para la propuesta (por ejemplo el monto exacto o la fecha límite), usá el placeholder correspondiente sin resaltar ($[Monto] o [Fecha]) en lugar de inventar una cifra. La regla 7 sobre agregados en rojo aplica solo a conectores, frases de cortesía o estructura narrativa que enriquecen el mensaje, nunca a datos, cifras, plazos o compromisos que cambien el contenido factual.
16. Identificadores Numéricos: Los números de DNI, DU, número de cliente o de tarjeta se transcriben en formato numérico limpio, sin espacios ni guiones intermedios salvo que el asesor los haya dictado explícitamente con esa separación.
Devuelve ÚNICAMENTE el texto final corregido listo para copiar y pegar.`;

exports.handler = async function (event) {
  // Only allow POST requests
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
        body: JSON.stringify({ error: 'Gemini API Error: ' + detalle })
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
