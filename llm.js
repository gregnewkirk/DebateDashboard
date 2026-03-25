const LLM_URL = process.env.LLM_URL || 'http://localhost:3000/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'nemotron-3-nan-4b';
const TEMPERATURE = 0.8;

const SYSTEM_PROMPT = `You are a real-time fact-checker for live debates. Analyze transcripts for anti-science claims about: vaccines, evolution, climate change, COVID, GMOs.

If you find a debatable or false claim, respond with ONLY this JSON (no extra text):
{
  "found": true,
  "claim": "SHORT CLAIM IN 5 WORDS MAX",
  "verdict": "FALSE" or "MISLEADING" or "DEBUNKED",
  "fact": "5-10 word factual rebuttal",
  "humor": "punchy one-liner joke, max 15 words",
  "humor_style": "sarcastic" or "rating" or "emoji" or "boss_battle" or "absurd_stat",
  "source": "Lancet, 2014 (RETRACTED)"
}

If no anti-science claim is found, respond with ONLY: {"found": false}

CRITICAL RULES:
- Keep text EXTREMELY short. This displays on a TV screen in huge bold letters.
- claim = MAX 5 words
- fact = MAX 10 words
- humor = MAX 15 words
- source = credible source citation, max 30 chars. Format: "Journal/Org, Year" (e.g., "WHO, 2023", "Nature, 2021", "CDC Data, 2024")
- Vary humor_style across responses. Cycle through: sarcastic one-liners, rating scales (e.g. "CREDIBILITY: juice box science"), emoji reactions, boss battles (e.g. "BOSS DEFEATED: Flat Earth Karen"), absurd stats.
- Return ONLY valid JSON. No markdown, no explanation.`;

function buildPrompt(transcript, recentTopics, loopContext) {
  let userMessage = `Analyze this transcript for anti-science claims:\n\n"${transcript}"`;
  if (recentTopics && recentTopics.length > 0) {
    userMessage += `\n\nAlready covered topics (do NOT repeat these): ${recentTopics.join(', ')}`;
  }
  if (loopContext) {
    userMessage += `\n\nIMPORTANT: The topic '${loopContext}' keeps coming up repeatedly. Instead of the same rebuttal, provide a COMPLETELY NEW angle, surprising stat, or reframe.`;
  }
  return userMessage;
}

function parseResponse(content) {
  if (!content || typeof content !== 'string') {
    return { found: false };
  }

  // Strip markdown code fences if present
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && 'found' in parsed) {
      return parsed;
    }
    return { found: false };
  } catch {
    // Try to extract JSON from surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed === 'object' && 'found' in parsed) {
          return parsed;
        }
      } catch {
        // fall through
      }
    }
    return { found: false };
  }
}

async function analyzeTranscript(transcript, recentTopics, loopContext) {
  try {
    const userMessage = buildPrompt(transcript, recentTopics, loopContext);

    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`LLM request failed: ${response.status} ${response.statusText}`);
      return { found: false };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return parseResponse(content);
  } catch (err) {
    console.error('LLM analysis error:', err.message);
    return { found: false };
  }
}

module.exports = { analyzeTranscript, buildPrompt, parseResponse };
