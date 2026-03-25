/**
 * Predictive Claim Detection
 *
 * Based on 93-stream analysis, certain phrases ALWAYS lead to specific claims.
 * Marie says "I know exactly where this is going..." and preloads the response.
 *
 * PIPELINE PHRASES → PREDICTED CLAIM
 * When someone says a pipeline phrase, we predict what's coming next
 * and can pre-generate the fact-check card.
 */

const PREDICTION_CHAINS = [
  {
    pipeline: ['i just think parents should have a choice', 'parental rights', 'my kids my choice', 'medical freedom'],
    predicted: 'VACCINE MANDATES',
    confidence: 0.85,
    marie: "I know exactly where this is going. Buckle up, Greg.",
  },
  {
    pipeline: ['do your own research', 'look it up', 'it\'s all out there', 'open your eyes'],
    predicted: 'GENERIC CONSPIRACY',
    confidence: 0.90,
    marie: "Three words that have never preceded a PubMed citation.",
  },
  {
    pipeline: ['i\'m not anti-vax but', 'i\'m just asking questions', 'just questioning', 'healthy skepticism'],
    predicted: 'VACCINE HESITANCY → FULL ANTI-VAX',
    confidence: 0.80,
    marie: "Heard that before. It starts with questions and ends with YouTube.",
  },
  {
    pipeline: ['follow the money', 'they make billions', 'profit motive', 'it\'s all about money'],
    predicted: 'BIG PHARMA CONSPIRACY',
    confidence: 0.88,
    marie: "The 'follow the money' pipeline. Straight to Big Pharma in three, two...",
  },
  {
    pipeline: ['government can\'t tell me', 'constitutional rights', 'tyranny', 'nazi germany'],
    predicted: 'MANDATES → POLITICAL CONSPIRACY',
    confidence: 0.82,
    marie: "And there's the comparison to authoritarianism. Right on schedule.",
  },
  {
    pipeline: ['natural is better', 'god designed our bodies', 'immune system is perfect', 'we survived without'],
    predicted: 'NATURAL IMMUNITY ABSOLUTISM',
    confidence: 0.85,
    marie: "The 'natural is always better' fallacy. Arsenic is natural too.",
  },
  {
    pipeline: ['they don\'t want you to know', 'they\'re hiding', 'cover up', 'whistleblower'],
    predicted: 'CENSORSHIP / COVER-UP',
    confidence: 0.87,
    marie: "Ah, the mysterious 'they.' My favorite character in conspiracy fiction.",
  },
  {
    pipeline: ['it\'s still experimental', 'emergency use', 'not fda approved', 'rushed'],
    predicted: 'VACCINE SAFETY CONCERNS',
    confidence: 0.90,
    marie: "The 'experimental' claim. I already know the next three talking points.",
  },
  {
    pipeline: ['what about the vaers', 'thousands of deaths reported', 'adverse events'],
    predicted: 'VAERS MISINTERPRETATION',
    confidence: 0.92,
    marie: "VAERS incoming. Someone doesn't understand passive surveillance systems.",
  },
  {
    pipeline: ['you can\'t even sue', 'no liability', 'they\'re protected', 'national childhood vaccine'],
    predicted: 'PHARMA LIABILITY SHIELD',
    confidence: 0.88,
    marie: "The liability argument. Predictable as gravity, less understood.",
  },
  {
    pipeline: ['look at the ingredients', 'what\'s in it', 'have you read the insert'],
    predicted: 'INGREDIENT FEAR (ALUMINUM, FORMALDEHYDE, ETC.)',
    confidence: 0.85,
    marie: "Ingredient fear incoming. Someone's about to mispronounce a chemical.",
  },
  {
    pipeline: ['kids get too many', 'overloaded', 'too many too soon', 'spreading them out'],
    predicted: 'VACCINE SCHEDULE OVERLOAD',
    confidence: 0.87,
    marie: "The 'too many too soon' myth. Their immune system handles millions of antigens daily.",
  },
  {
    pipeline: ['rfk', 'kennedy', 'children\'s health defense', 'maha', 'make america healthy'],
    predicted: 'RFK/MAHA TALKING POINTS',
    confidence: 0.90,
    marie: "RFK talking points incoming. I've got a whole category for this.",
  },
  {
    pipeline: ['what about japan', 'japan banned', 'other countries stopped', 'sweden stopped'],
    predicted: 'CHERRY-PICKED INTERNATIONAL POLICIES',
    confidence: 0.82,
    marie: "International cherry-picking detected. They always leave out context.",
  },
  {
    pipeline: ['i know someone who', 'my friend', 'my cousin', 'after the shot they'],
    predicted: 'ANECDOTAL EVIDENCE',
    confidence: 0.88,
    marie: "Anecdote alert. The plural of anecdote is not data.",
  },
  {
    pipeline: ['how do you explain', 'but what about', 'then explain this'],
    predicted: 'GISH GALLOP / WHATABOUTISM',
    confidence: 0.75,
    marie: "Incoming topic shift. Classic debate tactic when you're losing.",
  },
  {
    pipeline: ['fauci', 'fauci lied', 'gain of function'],
    predicted: 'FAUCI / GAIN OF FUNCTION',
    confidence: 0.90,
    marie: "And there it is. From personal choice to Fauci in record time.",
  },
  {
    pipeline: ['the earth is only', '6000 years', 'carbon dating is wrong', 'god created'],
    predicted: 'YOUNG EARTH CREATIONISM',
    confidence: 0.92,
    marie: "Young Earth creationism. Ignoring 4.5 billion years of evidence takes commitment.",
  },
  {
    pipeline: ['five g', '5g', 'radiation from towers', 'electromagnetic'],
    predicted: '5G CONSPIRACY',
    confidence: 0.85,
    marie: "5G fears. Non-ionizing radiation. This one writes itself.",
  },
  {
    pipeline: ['graphene', 'magnetic', 'nanobots', 'bluetooth'],
    predicted: 'GRAPHENE OXIDE / NANOTECH IN VACCINES',
    confidence: 0.90,
    marie: "Graphene oxide claims. Peak science fiction disguised as concern.",
  },
];

let lastPrediction = null;
let predictionCount = 0;

/**
 * Check transcript for pipeline phrases that predict upcoming claims.
 * Returns prediction info if a pattern matches.
 */
function checkForPrediction(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const chain of PREDICTION_CHAINS) {
    for (const phrase of chain.pipeline) {
      if (lower.includes(phrase)) {
        predictionCount++;
        lastPrediction = {
          predicted: chain.predicted,
          confidence: chain.confidence,
          marie: chain.marie,
          trigger: phrase,
          time: Date.now(),
        };
        console.log(`[Predictor] "${phrase}" → ${chain.predicted} (${Math.round(chain.confidence * 100)}% confidence)`);
        return lastPrediction;
      }
    }
  }
  return null;
}

function getPredictionStats() {
  return {
    totalPredictions: predictionCount,
    lastPrediction,
  };
}

module.exports = { checkForPrediction, getPredictionStats };
