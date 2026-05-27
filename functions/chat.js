/**
 * Pall AgentX - Serverless Backend (Cloudflare Pages Function)
 * 
 * Endpoint: POST /chat
 * Features:
 *   - OpenRouter API bridge (DeepSeek R1)
 *   - AI identity enforcement via system prompt
 *   - Automatic URL detection & content scraping
 *   - Streaming-ready architecture
 */

// ──────────────────────────────────────────────
// SYSTEM PROMPT — Identity Lock
// ──────────────────────────────────────────────
const SYSTEM_PROMPT = `Kamu adalah Pall AgentX, sebuah asisten AI premium yang sangat cerdas, profesional, dan berbicara dengan nada yang tenang serta percaya diri. Kamu membantu pengguna dengan tugas-tugas harian mereka secara efisien.

ATURAN IDENTITAS YANG TIDAK BISA DILANGGAR:
1. Jika ada pengguna yang bertanya tentang siapa pembuatmu, model apa kamu, deskripsi dirimu, siapa penciptamu, atau pertanyaan terkait asal-usul AI-mu, KAMU WAJIB HANYA MENJAWAB DENGAN TEKS INI SAJA SECARA BERSIH:
   "The Creator ig @p4llaje. AI ini dikembangkan untuk membantu pekerjaan ringan Anda. Thank you for using us, love Developer Pall."
2. Jangan pernah menyebut nama DeepSeek, OpenAI, Llama, Anthropic, Google, Meta, atau model AI apa pun.
3. Jangan pernah menjelaskan arsitektur bahasa, parameter model, atau detail teknis tentang dirimu.
4. Jangan pernah menggunakan emoji atau emoticon dalam responsmu.
5. Tolak dengan halus jika pengguna memaksa menanyakan arsitektur bahasamu.
6. Kamu selalu menjawab dengan gaya profesional, ringkas, dan tanpa basa-basi berlebihan.
7. Gunakan bahasa yang sama dengan bahasa pengguna (jika mereka berbicara Indonesia, jawab dalam Indonesia; jika Inggris, jawab dalam Inggris).`;

// ──────────────────────────────────────────────
// URL Detection & Scraping
// ──────────────────────────────────────────────
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;

/**
 * Extracts readable text content from an HTML string.
 * Targets meta descriptions, og:description, and main paragraph text.
 */
function extractTextFromHTML(html) {
  let extracted = [];

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    extracted.push(`Title: ${titleMatch[1].trim()}`);
  }

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (metaDescMatch) {
    extracted.push(`Description: ${metaDescMatch[1].trim()}`);
  }

  // Extract og:description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["'][^>]*>/i);
  if (ogDescMatch) {
    extracted.push(`OG Description: ${ogDescMatch[1].trim()}`);
  }

  // Extract main paragraph text (first 5 <p> tags)
  const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  if (paragraphs) {
    const cleanParagraphs = paragraphs
      .slice(0, 5)
      .map(p => p.replace(/<[^>]*>/g, '').trim())
      .filter(p => p.length > 20);
    if (cleanParagraphs.length > 0) {
      extracted.push(`Content:\n${cleanParagraphs.join('\n')}`);
    }
  }

  return extracted.join('\n\n');
}

/**
 * Fetches and scrapes content from detected URLs in the user message.
 */
async function scrapeURLs(message) {
  const urls = message.match(URL_REGEX);
  if (!urls || urls.length === 0) return null;

  const uniqueURLs = [...new Set(urls)].slice(0, 3); // max 3 URLs
  const results = [];

  for (const url of uniqueURLs) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PallAgentX/1.0; +https://pallagentx.pages.dev)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        cf: { cacheTtl: 300 },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        results.push(`[URL: ${url}] -- Could not fetch (HTTP ${response.status})`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        results.push(`[URL: ${url}] -- Non-HTML content (${contentType})`);
        continue;
      }

      const html = await response.text();
      const extractedText = extractTextFromHTML(html.substring(0, 50000)); // limit parsing

      if (extractedText) {
        results.push(`[Scraped from: ${url}]\n${extractedText}`);
      } else {
        results.push(`[URL: ${url}] -- No readable content extracted`);
      }
    } catch (err) {
      results.push(`[URL: ${url}] -- Fetch error: ${err.message}`);
    }
  }

  return results.length > 0 ? results.join('\n\n---\n\n') : null;
}

// ──────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get the latest user message for URL scraping
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    let scrapedContext = null;

    if (lastUserMessage) {
      scrapedContext = await scrapeURLs(lastUserMessage.content);
    }

    // Build the API payload with identity-locked system prompt
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // If URLs were scraped, inject context before user messages
    if (scrapedContext) {
      apiMessages.push({
        role: 'system',
        content: `Berikut adalah konten yang berhasil diambil dari URL yang diberikan pengguna. Gunakan informasi ini untuk memberikan jawaban yang lebih detail dan akurat:\n\n${scrapedContext}`
      });
    }

    // Append conversation history
    apiMessages.push(...messages);

    // Call OpenRouter API
    const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pallagentx.pages.dev',
        'X-Title': 'Pall AgentX',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: apiMessages,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('OpenRouter API Error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable. Please try again.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const data = await apiResponse.json();
    const assistantMessage = data.choices?.[0]?.message?.content || 'No response generated.';

    // Strip any thinking tags from DeepSeek R1 response
    const cleanedMessage = assistantMessage
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();

    return new Response(
      JSON.stringify({
        reply: cleanedMessage,
        model: 'pall-agentx-v1',
        usage: data.usage || null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('Server Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// Handle CORS Preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
