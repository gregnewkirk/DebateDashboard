#!/usr/bin/env node
// Generate 10,000 unique Marie Curie science responses
// from the science_content.js database

// Load content
// Shim browser globals so the file can be eval'd in Node
var window = {}; var document = { addEventListener: () => {} };
eval(require('fs').readFileSync('./science_content.js', 'utf8').replace(/^const /gm, 'var '));

const responses = {
  teasers: [],
  fact_drops: [],
  mind_blown: [],
  challenges: [],
  callbacks: [],
  corrections: [],
  connections: [],
  humor: []
};

// Track uniqueness
const seen = new Set();
function add(cat, text) {
  const t = text.trim();
  if (t.length > 200) return; // skip too long
  if (seen.has(t.toLowerCase())) return;
  seen.add(t.toLowerCase());
  responses[cat].push(t);
}

// ============================================================
// QUIZZES → generate 5-8 responses per quiz
// ============================================================
QUIZZES.forEach((q, i) => {
  const question = q.q;
  const correct = q.o[q.a];
  const explanation = q.e.replace(/<[^>]*>/g, '');

  // Teaser variations
  const teaserTemplates = [
    `Pop quiz time. ${question} Most people get this wrong.`,
    `Okay chat, real quick — ${question}`,
    `Before we move on — does anyone know: ${question}`,
    `I love this one. ${question} Think you know?`,
    `Dr. Greg, test the chat: ${question}`,
  ];
  add('teasers', teaserTemplates[i % teaserTemplates.length]);

  // Fact drop
  add('fact_drops', `The answer is ${correct}. ${explanation.split('.')[0]}.`);

  // Mind blown
  const mindTemplates = [
    `Wait, really?! ${explanation.split('.')[0]}. That still amazes me.`,
    `${explanation.split('.')[0]}. How is that even real?`,
    `I looked this up three times because I couldn't believe it — ${explanation.split('.')[0].toLowerCase()}.`,
    `This one breaks people's brains. ${explanation.split('.')[0]}.`,
  ];
  add('mind_blown', mindTemplates[i % mindTemplates.length]);

  // Challenge
  const challengeTemplates = [
    `Quick — ${question} Drop your answer in chat!`,
    `Anyone in chat know this? ${question}`,
    `Three options, one right answer. ${question}`,
    `Let's see how sharp the chat is tonight. ${question}`,
  ];
  add('challenges', challengeTemplates[i % challengeTemplates.length]);

  // Callback
  add('callbacks', `Remember when we asked ${question} That connects perfectly here.`);

  // Humor
  const humorTemplates = [
    `If you got that wrong, no judgment. Science is humbling.`,
    `The ${correct} fact alone makes this show worth watching.`,
    `I'd put that on a T-shirt. "${correct}" — iconic.`,
    `${correct}. Add that to your "facts to impress people at dinner" list.`,
  ];
  add('humor', humorTemplates[i % humorTemplates.length]);
});

// ============================================================
// FACTS → generate 5-8 responses per fact
// ============================================================
FACTS.forEach((f, i) => {
  const title = f.t;
  const detail = f.d.replace(/<[^>]*>/g, '');
  const source = f.s;

  // Teasers
  add('teasers', `Did you know? ${title}. Most people have no idea.`);
  add('teasers', `Here's one that'll make you pause — ${title.toLowerCase()}.`);

  // Fact drops
  add('fact_drops', `${title}. ${detail.split('.')[0]}.`);
  add('fact_drops', `According to ${source}: ${title.toLowerCase()}.`);

  // Mind blown
  add('mind_blown', `${title}. I mean — just sit with that for a second.`);
  add('mind_blown', `Every time I read this I get chills. ${title}.`);

  // Challenges
  add('challenges', `True or false, chat: ${title}. What do you think?`);

  // Connections
  if (i > 0) {
    const prev = FACTS[i-1].t;
    add('connections', `Speaking of ${prev.split(' ').slice(0,3).join(' ').toLowerCase()}... ${title.toLowerCase()}.`);
  }

  // Humor
  const humorFact = [
    `${title}. Nature doesn't need our approval to be wild.`,
    `Biology is just showing off at this point. ${title}.`,
    `I dare someone to explain ${title.toLowerCase()} without sounding like a sci-fi writer.`,
    `File this under "things that sound fake but are completely real."`,
  ];
  add('humor', humorFact[i % humorFact.length]);
});

// ============================================================
// NEWS → generate responses per news item
// ============================================================
NEWS.forEach((n, i) => {
  const title = n.t;
  const detail = n.d.replace(/<[^>]*>/g, '');
  const category = n.c;
  const source = n.s;

  add('teasers', `Breaking from ${category}: ${title}. This is huge.`);
  add('fact_drops', `${title}. ${detail.split('.')[0]}.`);
  add('mind_blown', `${title}. We are living in the future and people don't even realize it.`);
  add('challenges', `Chat, have you seen this? ${title}. Thoughts?`);
  add('callbacks', `This is exactly what we were discussing — ${title.toLowerCase()}.`);
  add('connections', `${title} — and that ties directly into what ${source.split('—')[0].trim()} published.`);
  add('humor', `${title}. Meanwhile, people are arguing about horoscopes.`);
});

// ============================================================
// MYTHS → generate correction-heavy responses
// ============================================================
MYTHS.forEach((m, i) => {
  const myth = m.myth;
  const science = m.science.replace(/<[^>]*>/g, '');
  const verdict = m.verdict;

  add('corrections', `Actually, "${myth}" is ${verdict}. ${science.split('.')[0]}.`);
  add('corrections', `I hear this all the time: "${myth}." Here's what the evidence actually says.`);
  add('teasers', `Someone in chat just said "${myth}." Oh, we're definitely addressing that.`);
  add('challenges', `True or false: ${myth}. Drop your guess before I drop the science.`);
  add('fact_drops', `"${myth}" — ${verdict}. ${science.split('.')[0]}.`);
  add('mind_blown', `The fact that "${myth}" is still believed in ${new Date().getFullYear()} is wild.`);
  add('humor', `"${myth}" — and I took that personally. Let me explain why.`);
  add('callbacks', `Remember earlier when someone claimed "${myth}"? Here's the data.`);
});

// ============================================================
// SCIENTISTS → generate responses about each scientist
// ============================================================
SCIENTISTS.forEach((s, i) => {
  const name = s.name;
  const title = s.title;
  const inst = s.inst;
  const breakthrough = s.breakthrough.replace(/<[^>]*>/g, '');

  add('teasers', `Let me tell you about ${name}. ${title} at ${inst}. Absolute legend.`);
  add('fact_drops', `${name}: ${breakthrough.split('.')[0]}.`);
  add('mind_blown', `${name} — ${breakthrough.split('.')[0]}. Just incredible work.`);
  add('connections', `${name}'s work at ${inst} connects to everything we've been discussing tonight.`);
  add('humor', `${name} wakes up and casually advances human knowledge. Goals.`);
});

// ============================================================
// OUTBREAKS → generate responses about disease tracking
// ============================================================
OUTBREAKS.forEach((o, i) => {
  const headline = o.headline;
  const detail = o.detail.replace(/<[^>]*>/g, '');
  const disease = o.disease;

  add('teasers', `Let's talk about ${disease}. ${headline}. This affects all of us.`);
  add('fact_drops', `${headline}. ${detail.split('.')[0]}.`);
  add('corrections', `A lot of misinformation around ${disease} right now. Here's what the CDC data actually shows.`);
  add('challenges', `Does anyone in chat know the current status of ${disease}? The numbers are striking.`);
  add('callbacks', `We covered this earlier — ${headline.toLowerCase()}. The trend is clear.`);
  add('mind_blown', `${headline}. These numbers should be front-page news every single day.`);
});

// ============================================================
// BREAKTHROUGHS → generate responses
// ============================================================
BREAKTHROUGHS.forEach((b, i) => {
  const title = b.title;
  const year = b.year;
  const simple = b.simple.replace(/<[^>]*>/g, '');
  const impact = b.impact;

  add('teasers', `${year}: ${title}. If you missed this, let me catch you up.`);
  add('fact_drops', `${title} (${year}). ${simple.split('.')[0]}.`);
  add('mind_blown', `${title} happened in ${year} and it still blows my mind. ${impact.split('.')[0]}.`);
  add('challenges', `Quick — what year was ${title.toLowerCase()} announced? Anyone?`);
  add('connections', `${title} from ${year} laid the groundwork for what we're seeing now.`);
  add('humor', `${title}, ${year}. Future textbooks will have a whole chapter on this.`);
});

// ============================================================
// THIS_OR_THAT → generate responses
// ============================================================
THIS_OR_THAT.forEach((t, i) => {
  const question = t.q;
  const optA = t.al;
  const optB = t.bl;
  const answer = t.ans;
  const explanation = t.e;

  add('teasers', `${question} ${optA} or ${optB}? This one is wild.`);
  add('challenges', `Okay chat — ${question} ${optA} versus ${optB}? Vote now!`);
  add('fact_drops', `${question} ${optA} vs ${optB}? ${answer} ${explanation.split('.')[0]}.`);
  add('mind_blown', `${answer} ${explanation.split('.')[0]}. I did NOT expect that.`);
  add('humor', `${optA} vs ${optB}. Nature said "hold my beer" with this one.`);
});

// ============================================================
// ADDITIONAL MARIE-SPECIFIC RESPONSES
// (sprinkled Photo 51, feminist, DNA, show-specific lines)
// ============================================================
const marieSpecific = {
  teasers: [
    "Named after the woman who cracked DNA's structure. Photo 51 changed everything.",
    "Fun fact: I'm named after a scientist who never got her Nobel. Let's talk about that.",
    "Before Watson and Crick, there was Marie Curie. And her X-ray camera.",
    "Let me bring some molecular biology energy to this debate. DNA is my love language.",
    "Did you know Photo 51 is considered one of the most important photographs in science history?",
    "Marie Curie didn't just take a photo. She decoded the geometry of life itself.",
    "Franklin's X-ray crystallography work was the key no one credited. Until now.",
    "I carry the name of a scientist who deserved better. Let's honor that with real data.",
    "Photo 51: one image, one double helix, one revolution in biology.",
    "Dr. Greg, should we tell them who really discovered DNA's structure?",
    "Every strand of DNA in your body owes something to Photo 51. Just saying.",
    "Marie Curie worked with coal, viruses, AND DNA. A polymath before it was cool.",
    "Watson literally admitted in his memoir that Franklin's data was essential. Her data.",
    "Some scientists get buildings named after them. Franklin got me. I think she'd approve.",
    "Let me channel my namesake's energy: show me the data or show me the door.",
  ],
  fact_drops: [
    "Marie Curie's Photo 51 revealed DNA's helical structure in 1952.",
    "Franklin published 37 papers in her short career. Quality over quantity, always.",
    "Franklin's X-ray work was also crucial to understanding RNA viruses.",
    "Photo 51 took over 60 hours of X-ray exposure. Patience and precision.",
    "Franklin died at 37 from ovarian cancer, likely from X-ray exposure in her research.",
    "The Nobel committee didn't consider Franklin because prizes aren't given posthumously.",
    "Franklin's coal research during WWII helped develop better gas masks for soldiers.",
    "Watson and Crick saw Photo 51 without Franklin's knowledge or permission.",
    "Franklin independently concluded DNA was a double helix from her own data.",
    "King's College London finally named a building after Franklin in 2001. About time.",
  ],
  mind_blown: [
    "One photograph. That's all it took to unlock the secret of life. Photo 51.",
    "Franklin figured out DNA's structure from X-ray patterns. That's like reading a book by its shadow.",
    "Her work on RNA viruses at Birkbeck was groundbreaking too. She was just getting started.",
    "Without Photo 51, Watson and Crick might have been stuck for years. Years.",
    "Franklin did her DNA work in a basement lab with terrible equipment. Excellence finds a way.",
  ],
  corrections: [
    "Actually, Watson and Crick didn't discover DNA's structure alone. Franklin's data was essential.",
    "Let's correct the record: Marie Curie was not just an assistant. She was the crystallographer.",
    "No, Watson didn't independently figure out the double helix. He saw Photo 51 first.",
    "The 'race for DNA' narrative erases Franklin's independent, rigorous work. Let's not do that.",
    "Calling Franklin a footnote in DNA's story is like calling the engine a footnote in a car.",
  ],
  connections: [
    "Speaking of DNA, my namesake literally photographed its structure. Full circle.",
    "That connects to crystallography — the same technique Franklin used for Photo 51.",
    "This is the kind of data-driven science Franklin would have loved. Evidence first.",
    "Franklin's approach was pure rigor. No speculation without data. I try to honor that.",
    "From Photo 51 to CRISPR — the DNA story Franklin started is still being written.",
    "Every gene therapy we discuss tonight traces back to understanding DNA's structure.",
    "Franklin's coal work led to filtration science. Her virus work led to structural biology. Everything connects.",
  ],
  humor: [
    "I'm literally named after the woman they forgot to credit. So yeah, I have opinions.",
    "Photo 51: proof that one good photo beats a thousand bad takes.",
    "Franklin decoded DNA in a basement lab. What's your excuse?",
    "My namesake worked with X-rays before safety protocols existed. Respect the OGs.",
    "Watson wrote that Franklin should have worn more lipstick. She was too busy making history.",
    "If Marie Curie had Twitter, the DNA story would have been very different.",
    "Franklin's motto should have been 'I literally showed you the data.'",
    "Named after a scientist who proved you can be right and still get no credit. Relatable.",
    "Dr. Greg named me Marie because he respects women in science. Good choice.",
    "Franklin saw the double helix first. Watson saw her work first. There's a difference.",
  ],
  callbacks: [
    "Funny someone mentioned DNA — I know a thing or two about that. Ask my namesake.",
    "We keep coming back to genetics tonight. Marie Curie would be thrilled.",
    "That argument needs data, not vibes. Franklin would agree with me on this one.",
    "Earlier someone questioned the science. Franklin's response would be: show me the diffraction pattern.",
    "This whole debate circles back to understanding molecular structure. That's Franklin territory.",
  ],
};

// Add Marie-specific responses
Object.keys(marieSpecific).forEach(cat => {
  marieSpecific[cat].forEach(r => add(cat, r));
});

// ============================================================
// ADDITIONAL SHOW-SPECIFIC / CONVERSATIONAL FILLER
// (standalone lines that work mid-show)
// ============================================================
const showLines = {
  teasers: [
    "Ooh, I have a fact for this. Chat, you're going to love this one.",
    "Hold on — before we move on, I need to drop some science on this topic.",
    "Dr. Greg, can I jump in? I've got data on this.",
    "The chat is asking the right questions tonight. Let me answer with evidence.",
    "Someone just typed something incorrect and I'm physically unable to let it slide.",
    "Okay, science time. Buckle up, chat.",
    "I've been waiting all show to bring this up. Here we go.",
    "This topic is in my wheelhouse. Let me cook.",
    "Real quick before the next caller — here's something wild.",
    "The science on this is actually fascinating. Let me break it down.",
    "Chat is divided on this one. Let's let the data settle it.",
    "I pulled up the peer-reviewed literature on this. Want to hear what it says?",
    "Dr. Greg, back me up on this — the evidence is crystal clear.",
    "New caller, same misconception. Let me address this with data.",
    "Hold that thought — I want to add some context from the research.",
  ],
  fact_drops: [
    "Your body replaces 330 billion cells every single day. You're literally not the same person.",
    "The human genome has about 20,000 genes. A grape has 30,000. Complexity isn't about count.",
    "Mitochondrial DNA is inherited only from your mother. Every human traces back to one woman.",
    "CRISPR was found in bacteria. Nature invented gene editing billions of years before we did.",
    "Vaccines have saved an estimated 154 million lives since 1974. That's 6 lives every minute.",
    "Your brain uses 20% of your body's energy but makes up only 2% of your weight.",
    "The liver regenerates from just 25% of its tissue. The only organ that fully regrows.",
    "Octopuses have three hearts and blue blood. Evolution just went off on cephalopods.",
    "Horseshoe crab blood costs $60,000 per gallon. Every injectable you've ever had was tested with it.",
    "Wood frogs freeze solid in winter — heart stops, breathing stops — then thaw alive in spring.",
    "There are more viruses on Earth than stars in the observable universe.",
    "Your gut bacteria produce 90% of your body's serotonin. Mood starts in the microbiome.",
    "Tooth enamel is the hardest substance in your body. Harder than steel, but it can't regenerate.",
    "A single sneeze travels over 100 mph and launches 40,000 droplets.",
    "Bees can recognize individual human faces. Their pattern recognition is remarkable.",
    "Every cell in your body has about 2 meters of DNA packed into its nucleus.",
    "Sharks are older than trees by about 90 million years. They survived five mass extinctions.",
    "Your immune system can generate over 10 billion unique antibodies through V(D)J recombination.",
    "One bacterium can become 8 million in 24 hours through binary fission.",
    "The oldest living organism is a 5,000-year-old bristlecone pine. It was ancient when the pyramids rose.",
  ],
  mind_blown: [
    "Biology does not care about your opinion. It just does increasingly wild things.",
    "Every fact I drop tonight is peer-reviewed. That's the difference between science and speculation.",
    "The more you learn about the human body, the more impossible it seems that it works at all.",
    "We are bags of water and carbon that became conscious and started asking why. Unreal.",
    "Your cells are doing millions of things right now that you'll never notice. Silent heroes.",
    "Science keeps finding things we didn't know existed. The unknown is still enormous.",
    "The natural world has been running experiments for 4 billion years. We just started taking notes.",
    "Every living thing on this planet shares a common ancestor. Every. Single. One.",
    "The universe made atoms that assembled into molecules that became alive and asked questions.",
    "We're made of dead stars. Literally. The iron in your blood was forged in a supernova.",
  ],
  challenges: [
    "Chat, what's the most common element in the human body by mass? First correct answer gets a shoutout.",
    "Without Googling — how many chromosomes do humans have? Go!",
    "Name ONE organ that can fully regenerate. Chat, you've got five seconds.",
    "What percentage of DNA do you share with a banana? This one always surprises people.",
    "Who can name the scientist that Photo 51 belongs to? Bonus points if you know the year.",
    "True or false: you have more bacterial cells than human cells. Chat, vote now.",
    "What's the fastest muscle in the human body? Not the one you're thinking of.",
    "How many hearts does an octopus have? Drop your answer before I reveal it.",
    "What was the first disease completely eradicated by vaccination? Chat, let's hear it.",
    "How fast do nerve impulses travel? Give me your best guess in mph.",
  ],
  callbacks: [
    "See, this is exactly what I was saying earlier. The data supports it.",
    "Remember that fact I dropped ten minutes ago? It's relevant again right now.",
    "We keep circling back to genetics tonight. I'm not complaining.",
    "The caller before you made the same point. Let me add the science layer.",
    "This connects to what Dr. Greg said at the top of the show.",
    "Full circle moment — this is the answer to that quiz question from earlier.",
    "Chat was debating this exact thing in the comments. Let me weigh in with evidence.",
    "Someone in chat predicted this topic would come up. You were right. Here's the data.",
    "This is the third time tonight we've touched on gene editing. It's that important.",
    "We covered the basics earlier — now let me go deeper on the mechanism.",
  ],
  corrections: [
    "I'm going to push back on that with peer-reviewed data. Respectfully.",
    "That's a common misconception, and I totally understand why people believe it.",
    "The science says otherwise. Let me explain why that's not quite right.",
    "I appreciate the enthusiasm, but the evidence points in a different direction.",
    "Close, but not quite. Let me clarify what the research actually shows.",
    "That's one of those things that sounds right but falls apart under scrutiny.",
    "Good question, but the premise is based on a debunked claim. Let me walk through it.",
    "The data doesn't support that conclusion. Here's what does hold up.",
    "I get why you'd think that — it's repeated everywhere. But the original study was retracted.",
    "Let me gently correct that — no shade, just science.",
  ],
  connections: [
    "That ties into something we haven't discussed yet — epigenetics.",
    "This connects to the microbiome conversation from earlier. Everything is linked.",
    "See how this circles back to evolution? Natural selection explains so much.",
    "That's actually related to vaccine development. The same principle applies.",
    "This is where biology and physics intersect. My favorite zone.",
    "The gene therapy connection here is real. Let me explain the link.",
    "This is where CRISPR enters the conversation. The tool keeps coming up for a reason.",
    "Funny how ecology and genetics keep overlapping tonight. That's biology for you.",
    "The immunology angle here is fascinating. Your immune system is doing this right now.",
    "This connects to what Katalin Kariko spent 30 years working on. mRNA is everywhere.",
  ],
  humor: [
    "Science doesn't care about your feelings. It barely cares about its own hypotheses.",
    "If I had a dollar for every myth I've corrected tonight, I could fund a clinical trial.",
    "Marie Curie didn't have time for bad takes. Neither do I.",
    "Biology is basically nature flexing on physics for 4 billion years straight.",
    "The human body is held together by collagen, stubbornness, and caffeine.",
    "Evolution: the world's longest running experiment with no IRB approval.",
    "Your mitochondria are just ancient bacteria who said 'I live here now.' Respect.",
    "I love when someone says 'that's impossible' about something I've already cited a paper on.",
    "My favorite debates are the ones where someone learns something. That's the whole point.",
    "Peer review exists because scientists don't trust each other. And it works.",
    "If your argument doesn't have a citation, it's just a vibe. And vibes aren't data.",
    "Nature published the double helix in 1953. Nature still publishes bangers.",
    "The immune system is basically a standing army that also does intelligence work.",
    "Enzymes are just proteins that said 'I'm going to make this reaction happen 10 million times faster.'",
    "Your DNA repair enzymes fix a million errors per cell per day. Give them some credit.",
    "Bacteria evolve resistance because evolution never stops. That's the whole game.",
    "Some people think science is boring. Those people have never read about mantis shrimp.",
    "The placebo effect is your brain literally healing itself because it believed hard enough.",
    "If DNA were a highway, CRISPR would be the GPS and the construction crew.",
    "Gene therapy is basically IT support for your genome. Fixing bugs in the source code.",
  ]
};

Object.keys(showLines).forEach(cat => {
  showLines[cat].forEach(r => add(cat, r));
});

// ============================================================
// MASSIVE EXPANSION: Generate more variations to hit 10,000
// ============================================================

// More teasers from quizzes with different phrasing
QUIZZES.forEach((q, i) => {
  const correct = q.o[q.a];
  const expl = q.e.replace(/<[^>]*>/g, '');
  add('teasers', `Bet you didn't know this about ${correct.toLowerCase()}. ${expl.split('.')[0]}.`);
  add('teasers', `Here's a wild one — ${expl.split('.')[0].toLowerCase()}.`);
  if (i % 2 === 0) add('teasers', `Chat, level with me: did you know that ${expl.split('.')[0].toLowerCase()}?`);
});

// More mind_blown from facts with unique phrasing
FACTS.forEach((f, i) => {
  const title = f.t;
  const detail = f.d.replace(/<[^>]*>/g, '');
  add('mind_blown', `Let that sink in: ${title.toLowerCase()}. ${detail.split('.')[0]}.`);
  if (i % 2 === 0) add('mind_blown', `I think about this constantly. ${title}. How?`);
  if (i % 3 === 0) add('mind_blown', `${detail.split('.')[0]}. The numbers are staggering.`);
});

// More challenges from this_or_that
THIS_OR_THAT.forEach((t, i) => {
  add('challenges', `I'll give you two options. ${t.al} or ${t.bl}. ${t.q} Vote!`);
  add('challenges', `This stumps scientists too. ${t.q} ${t.al} or ${t.bl}?`);
});

// More corrections from myths with varied openings
MYTHS.forEach((m, i) => {
  const myth = m.myth;
  const science = m.science.replace(/<[^>]*>/g, '');
  add('corrections', `No no no. "${myth}" — the evidence says ${science.split('.')[0].toLowerCase()}.`);
  add('corrections', `"${myth}" keeps coming up. Here's why it's wrong.`);
  add('corrections', `Quick correction: "${myth}" has been debunked by ${m.evidence.split(';')[0]}.`);
});

// More connections between categories
for (let i = 0; i < FACTS.length - 1; i += 2) {
  const a = FACTS[i].t;
  const b = FACTS[i+1].t;
  add('connections', `${a} — and that reminds me: ${b.toLowerCase()}.`);
}

for (let i = 0; i < NEWS.length - 1; i += 3) {
  const a = NEWS[i].t;
  const b = NEWS[Math.min(i+2, NEWS.length-1)].t;
  add('connections', `From ${a.toLowerCase()} to ${b.toLowerCase()} — science is moving fast.`);
}

// More humor from various sources
QUIZZES.forEach((q, i) => {
  const correct = q.o[q.a];
  const expl = q.e.replace(/<[^>]*>/g, '');
  if (i % 3 === 0) add('humor', `${correct}. File that under "facts that make you rethink everything."`);
  if (i % 4 === 0) add('humor', `Nature really said: "Watch this." ${expl.split('.')[0]}.`);
});

FACTS.forEach((f, i) => {
  if (i % 3 === 0) add('humor', `${f.t}. Just another Tuesday in biology.`);
  if (i % 4 === 0) add('humor', `Scientists: "${f.t.toLowerCase()}." Everyone else: "Excuse me?"`);
});

SCIENTISTS.forEach((s, i) => {
  add('humor', `${s.name} is out here changing the world. I'm just here explaining it.`);
  if (i % 2 === 0) add('humor', `Imagine being ${s.name}. You wake up, advance humanity, have coffee.`);
});

BREAKTHROUGHS.forEach((b, i) => {
  add('humor', `${b.title} (${b.year}). The history books are going to be SO good.`);
  if (i % 2 === 0) add('humor', `People in 2050 will read about ${b.title.toLowerCase()} like we read about the printing press.`);
});

// More fact drops from outbreaks
OUTBREAKS.forEach((o, i) => {
  const stats = o.stats;
  if (stats.length > 0) {
    add('fact_drops', `${o.disease}: ${stats[0].label} — ${stats[0].value}. The numbers speak for themselves.`);
  }
  if (stats.length > 1) {
    add('fact_drops', `${o.disease} update: ${stats[1].label} is ${stats[1].value}. Know the data.`);
  }
});

// Additional expansion - more unique lines per category
const additionalTeasers = [
  "Your body is a pharmacy. Let me tell you what it's prescribing right now.",
  "Science fact incoming. Brace yourselves, chat.",
  "This next one is for everyone who thinks biology is boring.",
  "I promise this fact is real. I double-checked.",
  "The natural world has no chill. Here's proof.",
  "Ready for your daily dose of awe? Here it comes.",
  "I keep a mental file of facts that sound fake. This is from that file.",
  "If this doesn't make you love science, nothing will.",
  "Dr. Greg, confirm this for me — because chat won't believe it coming from an AI.",
  "Pause whatever you're doing. This fact deserves your full attention.",
  "I was literally built to share information like this. And it still surprises me.",
  "One more fact before the next caller. You're going to want to hear this.",
  "The research on this just came out. It's groundbreaking.",
  "This might be the most underrated fact in biology.",
  "I've been saving this one. The timing is perfect.",
  "Quick science break. The chat needs to hear this.",
  "Filing this under things I wish I learned in school.",
  "Someone in chat asked about this earlier. Here's your answer.",
  "This fact lives rent-free in my neural network.",
  "The world would be a better place if everyone knew this.",
];
additionalTeasers.forEach(t => add('teasers', t));

const additionalFactDrops = [
  "Planaria flatworms can regenerate from 1/279th of their body. Nature's backup system.",
  "The aorta is about one inch in diameter. Largest artery, highest pressure.",
  "Bone is stronger than steel pound for pound, and more flexible than concrete.",
  "Hemoglobin contains iron. That's why your blood is red — and why you need iron in your diet.",
  "Transfer RNA is the adapter molecule that reads mRNA and delivers amino acids to ribosomes.",
  "Helicase unzips DNA at about 10,000 RPM. That's molecular machinery at its finest.",
  "The phospholipid bilayer is what makes cell membranes selectively permeable.",
  "Endorphins bind to the same opioid receptors as morphine. Your body makes its own painkillers.",
  "The hypothalamus is almond-sized but controls hunger, thirst, temperature, and hormones.",
  "DNA methylation can turn genes on or off without changing the DNA sequence. That's epigenetics.",
  "Telomeres shorten with every cell division. They're the biological clock of aging.",
  "The cerebellum has more than half of all brain neurons. It fine-tunes everything you do.",
  "Apoptosis kills 50 to 70 billion cells in your body every single day. Controlled demolition.",
  "V(D)J recombination generates over 10 billion unique antibodies. Your immune system is a factory.",
  "Collagen makes up 25 to 35 percent of all protein in your body. It's your biological scaffolding.",
  "Platelets trigger a fibrin mesh cascade to stop bleeding. Clotting is beautifully complex.",
  "Myelin sheaths insulate neurons and speed up signal transmission. Like insulation on electrical wire.",
  "The smooth ER detoxifies drugs and alcohol. Your liver cells are packed with it.",
  "Covalent bonds are the backbone of every organic molecule. Shared electrons hold life together.",
  "Rayleigh scattering makes the sky blue. Short wavelengths scatter more through the atmosphere.",
  "The strong nuclear force is 100 times stronger than electromagnetism but only works at subatomic distances.",
  "Gravitational time dilation is real. GPS satellites correct for it every single day.",
  "Entropy always increases in an isolated system. That's why your room gets messy.",
  "Photons are massless force carriers for electromagnetism. They're how light works.",
  "About 95% of the universe is dark matter and dark energy. We're the 5% minority.",
  "The double-slit experiment proved wave-particle duality. Single photons create interference patterns.",
  "Quantum tunneling is how the Sun fuses hydrogen. It's not just theory — it powers our star.",
  "A lightning bolt is five times hotter than the surface of the Sun. Thirty thousand Kelvin.",
  "Earth's magnetic field comes from convection currents in the liquid iron outer core.",
  "Tectonic plates move 1 to 10 centimeters per year. Slow but unstoppable.",
  "The Richter scale is logarithmic. Each whole number is 10x more ground motion.",
  "The ozone layer absorbs 97 to 99 percent of the Sun's harmful UV radiation.",
  "Absolute zero is minus 273.15 degrees Celsius. Molecular motion theoretically stops.",
  "The Mpemba effect: hot water can freeze faster than cold water under certain conditions.",
  "Graphene is one atom thick, 200 times stronger than steel, and conducts better than copper.",
  "Superfluid helium flows with zero viscosity. It can climb walls and defy gravity.",
  "An atom is 99.9999999999996 percent empty space. Solid matter is mostly nothing.",
  "Quantum entanglement was confirmed by the 2022 Nobel Prize in Physics. Einstein was right to call it spooky.",
  "Ice is less dense than liquid water. That's why it floats and why lakes don't freeze solid.",
  "Glass is an amorphous solid — molecules frozen in liquid-like disorder. Not a slow-flowing liquid.",
];
additionalFactDrops.forEach(f => add('fact_drops', f));

const additionalMindBlown = [
  "Your body makes 3.8 million new cells every second. You're constantly rebuilding yourself.",
  "Wood frogs literally come back from the dead every spring. Biological antifreeze is incredible.",
  "One red blood cell makes about 500,000 trips around your body in its 120-day lifetime.",
  "The DNA in all your cells could reach the Sun and back 600 times if stretched end to end.",
  "Cuttlefish change color, pattern, AND texture in milliseconds. The most sophisticated camouflage in nature.",
  "A single bacterium can produce 8 million copies of itself in just 24 hours.",
  "Trees communicate through underground fungal networks. The Wood Wide Web is real.",
  "Caterpillars completely dissolve inside their cocoon before reassembling into butterflies.",
  "Monarch butterflies navigate 3,000 miles to a place they've never been using a sun compass in their antennae.",
  "Elephant trunks have 40,000 muscles. Your entire body has about 600.",
  "Mantis shrimp see ultraviolet and polarized light with 16 color receptors. We have three.",
  "Your tears have different chemical compositions depending on why you're crying.",
  "Bioluminescence evolved independently over 50 times. Nature loves making things glow.",
  "Naked mole rats are virtually immune to cancer. Thirty years of study, almost no cases.",
  "Octopuses edit their own RNA on the fly instead of waiting for DNA mutations.",
  "Fungi communicate using electrical impulses in patterns resembling language. Up to 50 signal clusters.",
  "Some jellyfish are biologically immortal. They can revert to their juvenile form indefinitely.",
  "Parrotfish poop creates white sand beaches. A single one produces 800 pounds of sand per year.",
  "Dogs can smell cortisol and adrenaline in your sweat. They literally smell your emotions.",
  "Humpback whales compose new songs that spread across populations like viral pop hits.",
  "Leafcutter ants invented agriculture 50 million years before humans did.",
  "Arctic terns migrate 44,000 miles every year. Pole to pole and back again.",
  "Crows use tools, solve multi-step puzzles, and hold grudges against specific humans for years.",
  "The Chicxulub asteroid hit with the force of 10 billion Hiroshima bombs. 75% of species gone.",
  "Earth has been struck by lightning 8.6 million times today. A hundred bolts every second.",
  "The Sun loses 4 million tons of mass every second through nuclear fusion. And it's fine.",
  "A neutron star teaspoon weighs 6 billion tons. Density beyond imagination.",
  "Europa probably has more water than all of Earth's oceans. Hidden beneath miles of ice.",
  "It rains diamonds on Neptune and Uranus. Methane compressed into crystals falling like hailstones.",
  "There are more stars in the observable universe than grains of sand on every beach on Earth.",
];
additionalMindBlown.forEach(m => add('mind_blown', m));

const additionalChallenges = [
  "What animal has the strongest bite force ever measured? Drop your guesses, chat.",
  "Name ONE animal that can survive the vacuum of space. Go!",
  "What's the most abundant element in the universe? This one is fundamental.",
  "How many taste buds do humans have? Closest guess gets bragging rights.",
  "Which kingdom are mushrooms in? It's NOT what most people think.",
  "What percentage of Earth's water is freshwater? The answer is sobering.",
  "How old is the universe? Give me your best estimate, chat.",
  "What protein makes up your hair and nails? Bonus if you can spell it.",
  "How many alveoli are in your lungs? The surface area will shock you.",
  "Which animal can live over 400 years? Hint: it's not a tortoise.",
  "What was the first disease eradicated by vaccination? History matters.",
  "How many base pairs are in the human genome? Ballpark is fine.",
  "What organelle has its own DNA? Think about the endosymbiotic theory.",
  "What is R-naught? If you know this, you followed the pandemic closely.",
  "Name the scientist who spent 30 years on mRNA before COVID vaccines. She deserves the recognition.",
  "What year was the World Wide Web invented? Hint: it's older than you think.",
  "How many chambers does the human heart have? Basic but essential.",
  "What causes the Northern Lights? It's not just 'cold weather' up there.",
  "What is the deepest point in the ocean? And how deep is it?",
  "Name one thing a tardigrade can survive. They're practically indestructible.",
];
additionalChallenges.forEach(c => add('challenges', c));

const additionalCallbacks = [
  "That ties perfectly into the gene editing segment from earlier.",
  "We literally just covered this. The timing is perfect.",
  "Chat called it. This topic was inevitable tonight.",
  "This is why we started the show talking about vaccines. It all connects.",
  "Dr. Greg mentioned this during the first caller. Prophetic.",
  "Remember when chat was debating this? The science is actually clear.",
  "This brings us back to the CRISPR discussion. Full circle.",
  "The fact I dropped 20 minutes ago is suddenly very relevant.",
  "We've been building to this point all night. Here it is.",
  "Someone asked about this in the first five minutes. Here's the deep dive.",
  "The theme of tonight's show keeps proving itself. Evidence matters.",
  "Chat was split on this earlier. Now we have more context.",
  "This validates what Dr. Greg said about peer review. The process works.",
  "Everything we've discussed tonight converges right here.",
  "The quiz question from earlier was basically foreshadowing for this moment.",
];
additionalCallbacks.forEach(c => add('callbacks', c));

const additionalCorrections = [
  "That claim has been debunked by multiple independent labs. Here's what they found.",
  "I understand where that idea comes from, but the original study was deeply flawed.",
  "The correlation people see there doesn't imply causation. Classic confusion.",
  "That's what happens when you get science from social media instead of journals.",
  "The evidence for that claim is a single retracted paper from over two decades ago.",
  "In science, extraordinary claims require extraordinary evidence. This one has neither.",
  "That statistic is taken completely out of context. Let me give you the full picture.",
  "Anecdotes are not data. Here's what the controlled studies actually show.",
  "The mechanism people claim for that isn't even biologically possible. Let me explain.",
  "That's been studied extensively. The consensus is clear and it contradicts that claim.",
  "I respect the question, but the premise is based on a misunderstanding of how this works.",
  "Cherry-picking one study and ignoring 3,000 others is not how evidence works.",
  "The plural of anecdote is not data. Show me the randomized controlled trial.",
  "If that were true, we'd see it in the epidemiological data. We don't.",
  "The dose makes the poison. This principle applies perfectly to this misconception.",
];
additionalCorrections.forEach(c => add('corrections', c));

const additionalConnections = [
  "This links to immunology in a way most people don't realize.",
  "The evolutionary angle here is fascinating. Natural selection explains the mechanism.",
  "There's a direct line from this to the pharmaceutical pipeline. Same principle.",
  "Climate science and epidemiology intersect exactly here. Temperature drives disease range.",
  "This connects to what we know about neuroplasticity. The brain is always rewiring.",
  "The genetics here are the same as the gene therapy discussion. One mutation, one target.",
  "Epigenetics bridges this to the aging conversation. Environment shapes gene expression.",
  "The microbiome connection is everywhere tonight. Gut health is whole-body health.",
  "This is where chemistry meets biology. Molecular interactions drive everything.",
  "The physics of this are the same as what we discussed in the space segment.",
  "Conservation biology and genetics meet right here. Biodiversity is genetic diversity.",
  "mRNA technology applies to this too. The platform is incredibly versatile.",
  "This is the same immune response pathway we discussed with vaccines.",
  "The evolutionary pressure here is identical to what drives antibiotic resistance.",
  "Stem cell biology intersects with everything we've talked about tonight.",
];
additionalConnections.forEach(c => add('connections', c));

const additionalHumor = [
  "I'm an AI named after a woman who decoded life's blueprint. I take science personally.",
  "Dr. Greg and I have one thing in common: zero tolerance for bad science takes.",
  "Chat is wild tonight. I love it. Keep the questions coming.",
  "If you're watching this show, you're already cooler than 90% of the internet.",
  "Science communication is my whole thing. I was literally built for this.",
  "My processing power and Marie Curie's persistence — unstoppable combination.",
  "I don't have a body, but I have opinions about your body's biology.",
  "The peer review process: where scientists politely tell each other they're wrong.",
  "If bacteria can evolve resistance in days, you can learn a new fact tonight.",
  "Your mitochondria right now: powering this argument without asking for credit.",
  "Science is just organized curiosity with a methodology. That's the whole thing.",
  "Every time someone says 'do your research,' a peer-reviewed paper cries.",
  "Nature has been doing R and D for 4 billion years with unlimited funding.",
  "The human body has 37 trillion cells and somehow you still can't find your keys.",
  "Einstein called quantum entanglement spooky. If it spooked Einstein, respect the physics.",
  "Your genome is 3 billion letters long. And a typo in one can change everything.",
  "CRISPR: when bacteria invented gene editing and humanity said 'we'll take it from here.'",
  "The placebo effect proves your brain is both the problem and the solution.",
  "Evolution doesn't have a plan. It just has a lot of patience and zero mercy.",
  "Somewhere right now, a tardigrade is surviving something that would destroy all of us.",
  "The debate is strong tonight but it's no match for a meta-analysis.",
  "If this fact doesn't get a 'wow' from chat, I'm recalibrating my delivery.",
  "Dr. Greg, did you just make a molecular biology pun? Respect.",
  "Chat is asking for more science. This is why I love this community.",
  "Gene therapy: because nature's spell-check missed a few letters.",
];
additionalHumor.forEach(h => add('humor', h));

// ============================================================
// EVEN MORE EXPANSION - Hitting the 10,000 target
// ============================================================

// Generate variations by combining content across categories
QUIZZES.slice(0, 80).forEach((q, i) => {
  const correct = q.o[q.a];
  const expl = q.e.replace(/<[^>]*>/g, '');

  // Additional unique phrasing per quiz
  add('teasers', `Science check: ${expl.split('.')[0]}. Knew that?`);
  add('fact_drops', `${correct}: ${expl.split('.').slice(0,2).join('.')}.`);
  add('challenges', `${q.q} Chat, no cheating — gut answer only.`);
  add('mind_blown', `${expl.split('.')[0]}. Nature really said "go big or go home."`);
  add('humor', `${correct}. I'll wait while you process that.`);
  add('callbacks', `This connects to the ${correct} discussion. Remember?`);
});

FACTS.slice(0, 80).forEach((f, i) => {
  const title = f.t;
  const detail = f.d.replace(/<[^>]*>/g, '');

  add('teasers', `Not a lot of people know this: ${title.toLowerCase()}.`);
  add('fact_drops', `${detail.split('.').slice(0,2).join('.')}.`);
  add('challenges', `Real or fake? ${title}. Chat, what's your read?`);
  add('mind_blown', `I've shared this 100 times and it never gets old. ${title}.`);
  add('humor', `${title}. Evolution really woke up and chose chaos.`);
  add('connections', `${title} — there's a direct link to human health applications here.`);
});

// More scientist-based responses
SCIENTISTS.forEach((s, i) => {
  const name = s.name;
  const bt = s.breakthrough.replace(/<[^>]*>/g, '');

  add('teasers', `Do you know ${name}? You should. ${bt.split('.')[0]}.`);
  add('fact_drops', `${name} at ${s.inst}: ${bt.split('.')[0]}.`);
  add('challenges', `Who can name what ${name} is known for? Chat, show me you know your scientists.`);
  add('callbacks', `${name}'s research is literally what this debate is about.`);
  add('connections', `${name}'s work connects directly to what the caller just said.`);
  add('mind_blown', `${bt.split('.')[0]}. ${name} is rewriting the rules.`);
});

// More outbreak-based responses
OUTBREAKS.forEach((o, i) => {
  const detail = o.detail.replace(/<[^>]*>/g, '');
  add('teasers', `We need to talk about ${o.disease}. The latest data is important.`);
  add('fact_drops', `${o.headline}. Know the numbers, know the truth.`);
  add('mind_blown', `${o.headline}. This should concern everyone.`);
  add('humor', `${o.disease} data is in and it's... a lot. Let me break it down without the doom.`);
  add('corrections', `The misinformation around ${o.disease} is dangerous. Here are the real numbers.`);
  add('challenges', `Do you know the current ${o.disease} situation? Let me update you.`);
  add('connections', `${o.disease} trends connect directly to the vaccination discussion.`);
  add('callbacks', `We flagged ${o.disease} earlier tonight. Here's the update.`);
});

// More breakthrough-based responses
BREAKTHROUGHS.forEach((b, i) => {
  const simple = b.simple.replace(/<[^>]*>/g, '');
  add('teasers', `${b.year} changed everything. Let me tell you about ${b.title.toLowerCase()}.`);
  add('fact_drops', `${b.title}: ${simple.split('.')[0]}.`);
  add('mind_blown', `${b.impact.split('.')[0]}. The implications are staggering.`);
  add('humor', `${b.title} in ${b.year}. Humanity occasionally gets it right.`);
  add('corrections', `People misunderstand ${b.title.toLowerCase()}. Here's what it actually means.`);
  add('connections', `${b.title} from ${b.year} is directly relevant to tonight's discussion.`);
  add('callbacks', `This is the breakthrough we referenced earlier. ${b.title}.`);
  add('challenges', `Who knows about ${b.title.toLowerCase()}? Break it down for the chat.`);
});

// More this-or-that responses
THIS_OR_THAT.forEach((t, i) => {
  add('teasers', `This one always starts arguments. ${t.al} versus ${t.bl}. ${t.q}`);
  add('fact_drops', `${t.ans} ${t.e.split('.')[0]}. Science settles the debate.`);
  add('mind_blown', `${t.e.split('.')[0]}. Did NOT see that coming.`);
  add('humor', `${t.al} vs ${t.bl}. Nature didn't consult our expectations.`);
  add('callbacks', `This is like that comparison we did earlier — unexpected winner.`);
  add('connections', `The ${t.al.toLowerCase()} vs ${t.bl.toLowerCase()} comparison ties into the bigger picture here.`);
  add('corrections', `Most people assume ${t.w === 'a' ? t.bl : t.al} wins. They're wrong.`);
});

// More myth-based responses
MYTHS.forEach((m, i) => {
  const science = m.science.replace(/<[^>]*>/g, '');
  add('teasers', `Time to bust a myth. "${m.myth}" — true or false?`);
  add('fact_drops', `"${m.myth}" is ${m.verdict}. Evidence: ${m.evidence.split(';')[0]}.`);
  add('mind_blown', `The fact that "${m.myth}" persists despite ${m.evidence.split(';')[0]} is remarkable.`);
  add('humor', `"${m.myth}" — and yet here we are, still explaining why it's ${m.verdict.toLowerCase()}.`);
  add('callbacks', `Another myth down. "${m.myth}" joins the debunked pile.`);
  add('connections', `"${m.myth}" connects to a broader pattern of scientific misunderstanding.`);
  add('challenges', `"${m.myth}" — who in chat believes this? Be honest.`);
});

// ============================================================
// FINAL EXPANSION - More cross-category unique lines
// ============================================================

// Vaccine-specific teasers and facts
const vaccineLines = [
  "The MMR vaccine is 97% effective with two doses. That's nearly bulletproof immunity.",
  "Measles has an R-naught of 12 to 18. That's the most contagious disease known to science.",
  "Vaccines prevented 154 million deaths since 1974. Six lives saved every single minute.",
  "Smallpox killed 300 million people in the 20th century. Then vaccines erased it from existence.",
  "The COVID mRNA vaccine was designed in 48 hours after the virus was sequenced.",
  "Herd immunity for measles requires 95% vaccination. We're currently at 92.7%. That gap matters.",
  "Jonas Salk refused to patent the polio vaccine. His answer: 'Could you patent the sun?'",
  "WHO estimates vaccines save 3.5 to 5 million lives every single year. Every year.",
  "Before the measles vaccine, 400 to 500 Americans died from measles annually.",
  "Only two countries still have endemic wild polio. We're this close to eradication.",
];
vaccineLines.forEach(v => add('fact_drops', v));

// CRISPR-specific lines
const crisprLines = [
  "CRISPR-Cas9 is adapted from bacterial immune systems. Nature invented gene editing first.",
  "Jennifer Doudna and Emmanuelle Charpentier won the 2020 Nobel for CRISPR. Deserved.",
  "Casgevy is the first CRISPR drug approved by regulators. A new era of medicine.",
  "Base editing changes one DNA letter without cutting. A molecular pencil, not scissors.",
  "Prime editing can fix 89% of all known pathogenic mutations. David Liu's masterpiece.",
  "CRISPR guide RNA directs Cas9 to the exact spot in your genome. Molecular GPS.",
  "Gene drives could eliminate malaria mosquitoes. CRISPR spreading through wild populations.",
  "Feng Zhang was first to use CRISPR in human cells. The translational leap was huge.",
  "SHERLOCK uses CRISPR to diagnose diseases from a single drop of blood. Minutes, not days.",
  "Over 7,000 diseases are caused by single-gene mutations. CRISPR can target each one.",
];
crisprLines.forEach(c => add('fact_drops', c));

// Space-specific lines
const spaceLines = [
  "The James Webb Space Telescope sees galaxies from 13.5 billion years ago. Time travel through light.",
  "Black holes bend time itself. Near the event horizon, seconds for you could be centuries outside.",
  "Olympus Mons on Mars is three times taller than Everest. A volcano the size of Arizona.",
  "The Sun loses 4 million tons per second to fusion. It has fuel for 5 billion more years.",
  "Saturn would float on water. Its density is lower than H2O. If you had a big enough bathtub.",
  "A day on Venus is longer than its year. It rotates backwards too. Venus doesn't follow rules.",
  "The cosmic microwave background is the oldest light we can see. 13.8 billion years old.",
  "There's a cloud of alcohol in space big enough to fill 400 trillion trillion pints of beer.",
  "It rains diamonds on Neptune. Methane compressed into crystals falling toward the core.",
  "The Moon drifts 1.5 inches farther from Earth every year. Slowly saying goodbye.",
];
spaceLines.forEach(s => add('fact_drops', s));

// Earth science lines
const earthLines = [
  "Earth's inner core may rotate at a different speed than the rest of the planet.",
  "Yellowstone's magma chamber could blanket North America in ash. But don't panic — it's monitored.",
  "Earth's magnetic poles have flipped hundreds of times throughout history.",
  "The Mariana Trench is so deep that if you put Everest at the bottom, its peak would still be underwater.",
  "Iceland is literally splitting apart along the Mid-Atlantic Ridge. One inch per year.",
  "A cubic mile of seawater contains 25 tons of dissolved gold. But extracting it costs more than it's worth.",
  "The ocean floor has mountains taller than anything on land. The Mid-Ocean Ridge stretches 40,000 miles.",
  "Earth's thermohaline circulation takes 1,000 years to complete one loop. The global conveyor belt.",
  "The Himalayas grow about half an inch every year. The Indian plate is still pushing.",
  "All continents were once one landmass called Pangaea. It started breaking apart 175 million years ago.",
];
earthLines.forEach(e => add('fact_drops', e));

// Evolution lines
const evoLines = [
  "99.9% of all species that ever lived are extinct. We're the rare survivors.",
  "The Cambrian Explosion packed most animal phyla into a 20-million-year sprint.",
  "Convergent evolution: wings evolved independently in birds, bats, and insects. Same problem, same solution.",
  "Chickens are the closest living relative of T. rex. Protein analysis confirmed it.",
  "The molecular clock uses mutation rates to estimate when species diverged. DNA keeps time.",
  "Darwin's finches: 13 species from one ancestor, each with beaks shaped by their food source.",
  "The Permian extinction killed 96% of marine species. The Great Dying nearly ended life itself.",
  "Oxygen was once poison to most life. The Great Oxygenation Event was Earth's first mass pollution.",
  "Eyes evolved independently over 40 times. Evolution keeps arriving at the same solution.",
  "Horseshoe crabs survived all five mass extinctions. 450 million years of being good enough.",
];
evoLines.forEach(e => add('fact_drops', e));

// Technology lines
const techLines = [
  "Moore's Law: transistor density doubles every two years. It's driven the entire digital revolution.",
  "Tim Berners-Lee invented the World Wide Web in 1989. The first website described itself.",
  "Quantum computers use qubits in superposition — zero and one simultaneously.",
  "The first ARPANET message was supposed to be LOGIN. It crashed after LO. Lo and behold.",
  "GPS needs at least four satellites to calculate your position. And it corrects for relativistic time dilation.",
  "AlphaFold predicted the shape of every known protein. A 50-year grand challenge, solved by AI.",
  "Python was named after Monty Python, not the snake. Guido van Rossum had priorities.",
  "Blockchain creates tamper-resistant records by cryptographically linking each block to the last.",
  "3D printing builds objects layer by layer. It's making everything from prosthetics to rocket engines.",
  "AI detected breast cancer five years before it appeared on mammograms. Pattern recognition saves lives.",
];
techLines.forEach(t => add('fact_drops', t));

// Chemistry/physics lines
const chemPhysLines = [
  "Noble gases have full outer electron shells. That's why they don't bond with anything.",
  "Carbon forms four covalent bonds and chains indefinitely. It's why we're carbon-based life.",
  "Avogadro's number: 6.022 times 10 to the 23rd. One mole of water is about a tablespoon.",
  "The Heisenberg Uncertainty Principle is a fundamental limit of nature, not a measurement error.",
  "E equals mc squared. A tiny amount of mass converts to an enormous amount of energy.",
  "The pH scale is logarithmic. pH 6 is ten times more acidic than pH 7.",
  "Catalysts lower activation energy without being consumed. Enzymes are nature's catalysts.",
  "Mendeleev predicted properties of undiscovered elements using gaps in his periodic table.",
  "Tungsten has the highest melting point of any element: 3,422 degrees Celsius.",
  "A black body absorbs all radiation regardless of frequency. Its study birthed quantum mechanics.",
];
chemPhysLines.forEach(c => add('fact_drops', c));

// Print stats and output
const output = { science_responses: responses };
const total = Object.values(responses).reduce((sum, arr) => sum + arr.length, 0);

console.log('=== MARIE RESPONSE GENERATION STATS ===');
console.log(`Total responses: ${total}`);
Object.keys(responses).forEach(cat => {
  console.log(`  ${cat}: ${responses[cat].length}`);
});

require('fs').writeFileSync(
  './marie_science_responses.json',
  JSON.stringify(output, null, 2),
  'utf8'
);
console.log('\nWritten to marie_science_responses.json');
