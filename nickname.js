const LLM_URL = 'http://localhost:3000/v1/chat/completions';
const MODEL = 'qwen2.5';

async function generateNickname(claims, recentTranscript) {
  try {
    const claimList = claims.map((c, i) => `${i + 1}. ${c}`).join('\n');

    const prompt = `You are a comedy writer for a live debate show. Based on the anti-science claims listed below and the recent transcript, generate a single funny nickname (MAX 4 words) for the debate opponent.

The nickname should be creative, relevant to what they've been saying, and funny. Examples: "Dr. YouTube", "Captain Anecdote", "The Peer-Review Dodger", "Professor Facebook"

Claims so far:
${claimList}

Recent transcript:
${recentTranscript || '(none)'}

Return ONLY the nickname text, nothing else. No quotes, no explanation.`;

    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1.0,
        max_tokens: 30,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM returned status ${response.status}`);
    }

    const data = await response.json();
    let nickname = data.choices?.[0]?.message?.content || '';

    // Clean up: strip quotes, trim whitespace, remove trailing punctuation
    nickname = nickname.trim().replace(/^["']+|["']+$/g, '').trim();

    if (!nickname) {
      return 'CHALLENGER';
    }

    return nickname;
  } catch (err) {
    console.error('[Nickname] Error generating nickname:', err.message);
    return 'CHALLENGER';
  }
}

module.exports = { generateNickname };
