/**
 * Audience Participation Layer
 *
 * Curated audience interaction — not full chat integration (too noisy).
 * Greg says "someone in chat is asking about [topic]" → Marie responds.
 * Or: "shout out to [name]" → Marie acknowledges.
 *
 * Trigger detection runs on transcript, looking for audience-relay patterns.
 */

const AUDIENCE_TRIGGERS = [
  // Greg relaying a question from chat
  { pattern: /(?:someone|chat|viewer|audience).*(?:asking|wants to know|says?)\s+(?:about\s+)?(.{5,80})/i, type: 'question' },
  // Greg shouting someone out
  { pattern: /(?:shout ?out|big up|thanks|welcome)\s+(?:to\s+)?(\w+)/i, type: 'shoutout' },
  // Greg reading a comment
  { pattern: /(?:comment|chat)\s+(?:says?|from)\s+(.{5,80})/i, type: 'comment' },
];

const SHOUTOUT_RESPONSES = [
  "Welcome to the show! Glad you're here for the science.",
  "Thanks for tuning in! The more truth-seekers, the better.",
  "Hey there! Marie Curie, at your service.",
  "Welcome! You picked a good night for some fact-checking.",
  "Glad you're here! The conspiracy debunking is about to get good.",
  "Welcome aboard! Grab a seat, the science is free.",
  "Thanks for being here! Every viewer is another win for truth.",
  "Hey! Nice to have you. Stick around — it gets wild.",
];

const QUESTION_INTROS = [
  "Great question from the audience!",
  "Ooh, someone in chat is thinking!",
  "Love this question.",
  "The audience is bringing the real questions tonight.",
  "This is a good one from chat.",
];

/**
 * Check if Greg is relaying something from the audience.
 */
function checkAudienceTrigger(text) {
  if (!text) return null;

  for (const trigger of AUDIENCE_TRIGGERS) {
    const match = text.match(trigger.pattern);
    if (match) {
      return {
        type: trigger.type,
        content: match[1]?.trim() || '',
      };
    }
  }
  return null;
}

function getShoutoutResponse() {
  return SHOUTOUT_RESPONSES[Math.floor(Math.random() * SHOUTOUT_RESPONSES.length)];
}

function getQuestionIntro() {
  return QUESTION_INTROS[Math.floor(Math.random() * QUESTION_INTROS.length)];
}

module.exports = { checkAudienceTrigger, getShoutoutResponse, getQuestionIntro };
