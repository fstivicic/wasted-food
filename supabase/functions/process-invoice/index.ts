import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const SYSTEM_PROMPT = `You are an invoice parser for a restaurant. Given OCR text from a supplier invoice, extract structured data.
Return ONLY valid JSON with this exact schema:
{
  "supplier_name": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "line_items": [
    {
      "product_name": "string",
      "quantity": number,
      "unit": "kg|l|pcs|box|string",
      "unit_price": number,
      "total": number
    }
  ],
  "confidence": number between 0 and 1
}
Parse amounts as numbers. If you can't determine a value, use 0. The invoice may be in Croatian or English.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { ocr_text } = await req.json()

    if (!ocr_text || typeof ocr_text !== 'string') {
      return new Response(JSON.stringify({ error: 'ocr_text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${SYSTEM_PROMPT}\n\nOCR Text:\n${ocr_text}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        }
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return new Response(JSON.stringify({ error: `Gemini API error: ${errText}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await response.json()
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      return new Response(JSON.stringify({ error: 'No response from Gemini' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse the JSON response
    const structured = JSON.parse(content)

    return new Response(JSON.stringify(structured), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
