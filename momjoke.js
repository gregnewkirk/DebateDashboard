const LLM_URL = process.env.LLM_URL || 'http://localhost:3000/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'nemotron-3-nan-4b';

const MOM_JOKE_PATTERNS = [
  /your mom/i,
  /yo mama/i,
  /your mother/i,
  /ya mom/i,
  /ur mom/i,
  /your mum/i,
  /yo momma/i,
];

const FALLBACK_JOKES = [
  "Your mom is so dense, she has her own gravitational field.",
  "Your mom thought evolution was a software update.",
  "Your mom uses essential oils as peer-reviewed sources.",
];

function detectMomJoke(transcript) {
  if (!transcript || typeof transcript !== 'string') return false;
  return MOM_JOKE_PATTERNS.some(pattern => pattern.test(transcript));
}

async function generatePileOn(transcript, currentTopic) {
  try {
    const topic = currentTopic || 'science';
    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 1.0,
        messages: [
          {
            role: 'system',
            content: 'You generate mom jokes. Return ONLY a JSON array of 3 strings. No markdown, no explanation.',
          },
          {
            role: 'user',
            content: `A mom joke was just told during a debate about ${topic}. Generate exactly 3 follow-up mom jokes that tie into the science topic. Each joke MAX 15 words. Return as a JSON array of 3 strings. Be savage but funny.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[MomJoke] LLM request failed: ${response.status}`);
      return FALLBACK_JOKES;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) return FALLBACK_JOKES;

    // Strip markdown code fences if present
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3).map(j => String(j));
      }
    } catch {
      // Try to extract array from surrounding text
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return parsed.slice(0, 3).map(j => String(j));
          }
        } catch {
          // fall through
        }
      }
    }

    return FALLBACK_JOKES;
  } catch (err) {
    console.error('[MomJoke] LLM error:', err.message);
    return FALLBACK_JOKES;
  }
}

module.exports = { detectMomJoke, generatePileOn };
