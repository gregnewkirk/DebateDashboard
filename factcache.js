/**
 * Pre-Generated Fact-Check Card Cache
 *
 * Built from analysis of 93 live debate transcripts.
 * Each entry has multiple trigger phrases and pre-written cards
 * with varied humor styles so the same claim doesn't always
 * produce the same card.
 *
 * Cache hit = instant response (0ms vs 500-1000ms LLM).
 * Cache miss = falls through to live LLM for novel claims.
 */

const CACHED_CLAIMS = [

  // ============================================================
  // 1. FLAT EARTH (55/93 streams)
  // ============================================================
  {
    id: 'flat_earth',
    triggers: ['flat earth', 'earth is flat', 'globe lie', 'no curvature', 'horizon is flat', 'nasa lies', 'globe earth'],
    cards: [
      {
        claim: 'EARTH IS FLAT',
        verdict: 'FALSE',
        fact: 'Earth is an oblate spheroid — confirmed by every space agency on Earth',
        humor: 'CREDIBILITY LEVEL: frisbee science',
        humor_style: 'rating',
        source: 'NASA, ESA, JAXA, etc.',
      },
      {
        claim: 'EARTH IS FLAT',
        verdict: 'DEBUNKED',
        fact: 'Ships vanish hull-first over horizon — observed for 2,500+ years',
        humor: 'Even ancient Greeks figured this out without WiFi',
        humor_style: 'sarcastic',
        source: 'Eratosthenes, 240 BCE',
      },
      {
        claim: 'EARTH IS FLAT',
        verdict: 'FALSE',
        fact: 'GPS, satellite imagery, and time zones all require a sphere',
        humor: '🌍 vs 🥏 — science chose the emoji wisely',
        humor_style: 'emoji',
        source: 'Physics, all of it',
      },
    ],
  },

  // ============================================================
  // 2. LAB LEAK / WUHAN (46/93 streams)
  // ============================================================
  {
    id: 'lab_leak',
    triggers: ['lab leak', 'wuhan lab', 'made in a lab', 'engineered virus', 'gain of function', 'bioweapon', 'man made virus', 'man-made virus'],
    cards: [
      {
        claim: 'COVID WAS MADE IN A LAB',
        verdict: 'MISLEADING',
        fact: 'No evidence of engineering — genomic analysis shows natural origin most likely',
        humor: 'BOSS BATTLE: Lab Leak Larry — defeated by peer review',
        humor_style: 'boss_battle',
        source: 'Nature Medicine, 2020',
      },
      {
        claim: 'COVID IS A BIOWEAPON',
        verdict: 'FALSE',
        fact: 'Genomic signatures show no evidence of manipulation',
        humor: 'If it was designed, the designer needs to be fired',
        humor_style: 'sarcastic',
        source: 'Cell, 2020; Nature, 2021',
      },
      {
        claim: 'GAIN OF FUNCTION MADE COVID',
        verdict: 'MISLEADING',
        fact: 'Multiple independent analyses find natural zoonotic origin most supported',
        humor: 'CREDIBILITY: trusting a YouTube documentary over genomics',
        humor_style: 'rating',
        source: 'Science, 2022',
      },
    ],
  },

  // ============================================================
  // 3. "IT'S GENE THERAPY" (40/93 streams)
  // ============================================================
  {
    id: 'gene_therapy',
    triggers: ['gene therapy', 'changes your dna', 'changes dna', 'modifies your dna', 'alters your dna', 'mrna changes', 'not a real vaccine', "it's not a vaccine"],
    cards: [
      {
        claim: 'MRNA IS GENE THERAPY',
        verdict: 'FALSE',
        fact: 'mRNA never enters the nucleus — cannot alter DNA',
        humor: 'Tell me you skipped biology without telling me',
        humor_style: 'sarcastic',
        source: 'Nature Rev Genetics, 2021',
      },
      {
        claim: 'VACCINE CHANGES DNA',
        verdict: 'FALSE',
        fact: 'mRNA degrades in hours — DNA is in the nucleus, mRNA stays in cytoplasm',
        humor: '📧 mRNA is a text message, not a hard drive reformat',
        humor_style: 'emoji',
        source: 'CDC; Molecular Bio 101',
      },
      {
        claim: 'MRNA IS GENE THERAPY',
        verdict: 'DEBUNKED',
        fact: 'Gene therapy alters genes — mRNA vaccines instruct cells to make a protein temporarily',
        humor: 'CREDIBILITY: confusing a Post-it note with a tattoo',
        humor_style: 'rating',
        source: 'FDA Definition, 2021',
      },
    ],
  },

  // ============================================================
  // 4. VACCINE INJURY / VACCINES ARE POISON (36/93 streams)
  // ============================================================
  {
    id: 'vaccine_injury',
    triggers: ['vaccine injury', 'vaccine injured', 'vaccines are poison', 'vaccines are dangerous', 'vaccine damage', 'vaccine harm', 'poisoning us with vaccines', 'vaccines kill'],
    cards: [
      {
        claim: 'VACCINES ARE POISON',
        verdict: 'FALSE',
        fact: 'Vaccines prevent 4-5 million deaths per year globally',
        humor: 'BOSS DEFEATED: Captain Anecdote — felled by epidemiology',
        humor_style: 'boss_battle',
        source: 'WHO, 2024',
      },
      {
        claim: 'VACCINE INJURY EPIDEMIC',
        verdict: 'MISLEADING',
        fact: 'Serious adverse events are ~1 in a million — driving is riskier',
        humor: 'By this logic, water is poison too (drowning exists)',
        humor_style: 'sarcastic',
        source: 'CDC MMWR, 2023',
      },
      {
        claim: 'VACCINES ARE DANGEROUS',
        verdict: 'FALSE',
        fact: 'Most rigorous safety monitoring system of any medical product',
        humor: '⚠️ Side effects: not dying of preventable diseases',
        humor_style: 'emoji',
        source: 'Lancet, 2022',
      },
    ],
  },

  // ============================================================
  // 5. VACCINES CAUSE AUTISM (23/93 streams)
  // ============================================================
  {
    id: 'vaccines_autism',
    triggers: ['vaccines cause autism', 'vaccine autism', 'autism from vaccine', 'autism vaccine link', 'wakefield', 'vaxxed movie', 'vaxxed film', 'mmr autism'],
    cards: [
      {
        claim: 'VACCINES CAUSE AUTISM',
        verdict: 'DEBUNKED',
        fact: 'Exposed by 1.2 million+ children across 7 studies — zero link',
        humor: 'Wakefield lost his license for this fraud. Literally.',
        humor_style: 'sarcastic',
        source: 'Lancet RETRACTED; JAMA, 2019',
      },
      {
        claim: 'VACCINES CAUSE AUTISM',
        verdict: 'FALSE',
        fact: 'Largest study: 650,000 Danish children, no association found',
        humor: 'CREDIBILITY: citing a retracted paper as evidence',
        humor_style: 'rating',
        source: 'Ann Intern Med, 2019',
      },
      {
        claim: 'MMR CAUSES AUTISM',
        verdict: 'DEBUNKED',
        fact: 'Wakefield fabricated data — paid by lawyers suing vaccine makers',
        humor: 'BOSS DEFEATED: Andrew Wakefield — stripped of medical license',
        humor_style: 'boss_battle',
        source: 'BMJ Investigation, 2011',
      },
    ],
  },

  // ============================================================
  // 6. MYOCARDITIS (29/93 streams)
  // ============================================================
  {
    id: 'myocarditis',
    triggers: ['myocarditis', 'heart inflammation', 'blood clot', 'blood clots', 'cardiac', 'heart attack vaccine', 'died suddenly'],
    cards: [
      {
        claim: 'VACCINE CAUSES MYOCARDITIS',
        verdict: 'MISLEADING',
        fact: 'COVID infection causes myocarditis at 6x higher rate than the vaccine',
        humor: 'Worried about the fire extinguisher but not the fire',
        humor_style: 'sarcastic',
        source: 'Nature Medicine, 2022',
      },
      {
        claim: 'VACCINE HEART DAMAGE',
        verdict: 'MISLEADING',
        fact: 'Vaccine myocarditis is rare and almost always resolves — COVID myocarditis does not',
        humor: '📊 Risk from COVID: 6x higher. Math is hard.',
        humor_style: 'emoji',
        source: 'JAMA Cardiology, 2022',
      },
      {
        claim: 'DIED SUDDENLY = VACCINES',
        verdict: 'FALSE',
        fact: 'Sudden cardiac death rates unchanged post-vaccination in all data',
        humor: 'CREDIBILITY: conspiracy documentary over cardiologists',
        humor_style: 'rating',
        source: 'Eur Heart J, 2023',
      },
    ],
  },

  // ============================================================
  // 7. BIG PHARMA CONSPIRACY (29/93 streams)
  // ============================================================
  {
    id: 'big_pharma',
    triggers: ['big pharma', 'pharma profits', 'pharma money', 'shilling for pharma', 'pharmaceutical companies', 'pharma shill', 'bought by pharma'],
    cards: [
      {
        claim: 'BIG PHARMA CONSPIRACY',
        verdict: 'MISLEADING',
        fact: 'Vaccines are the least profitable pharma product — treating disease pays more',
        humor: 'If pharma wanted money, they would SKIP vaccines and sell treatments',
        humor_style: 'sarcastic',
        source: 'Health Affairs, 2021',
      },
      {
        claim: 'PHARMA CONTROLS SCIENCE',
        verdict: 'MISLEADING',
        fact: 'Independent researchers in 195 countries all reach the same conclusions',
        humor: 'BOSS BATTLE: Big Pharma — but the conspiracy requires millions of silent co-conspirators',
        humor_style: 'boss_battle',
        source: 'WHO Global Data, 2023',
      },
    ],
  },

  // ============================================================
  // 8. NATURAL IMMUNITY (21/93 streams)
  // ============================================================
  {
    id: 'natural_immunity',
    triggers: ['natural immunity', 'god gave us immune', 'immune system', 'natural antibodies', 'already immune', 'survived without vaccine'],
    cards: [
      {
        claim: 'NATURAL IMMUNITY IS ENOUGH',
        verdict: 'MISLEADING',
        fact: 'Natural immunity requires surviving the disease first — vaccines skip that part',
        humor: 'Natural immunity to smallpox: 30% death rate. Great plan.',
        humor_style: 'sarcastic',
        source: 'NEJM, 2022',
      },
      {
        claim: 'GOD GAVE US IMMUNITY',
        verdict: 'MISLEADING',
        fact: 'Before vaccines, 46% of children died before age 5',
        humor: '📉 Pre-vaccine child mortality: basically a coin flip',
        humor_style: 'emoji',
        source: 'Our World in Data, 2023',
      },
    ],
  },

  // ============================================================
  // 9. TERRAIN THEORY / GERM THEORY DENIAL (26/93 streams)
  // ============================================================
  {
    id: 'terrain_theory',
    triggers: ['terrain theory', 'germ theory is wrong', 'germ theory denial', 'germs arent real', "germs aren't real", 'viruses arent real', "viruses aren't real", "viruses don't exist", 'viruses dont exist', 'no such thing as virus'],
    cards: [
      {
        claim: 'VIRUSES ARE NOT REAL',
        verdict: 'FALSE',
        fact: 'Viruses have been photographed, sequenced, and isolated thousands of times',
        humor: 'BOSS DEFEATED: Terrain Theory Terry — KO by electron microscope',
        humor_style: 'boss_battle',
        source: 'Virology, all of it',
      },
      {
        claim: 'TERRAIN THEORY IS REAL',
        verdict: 'DEBUNKED',
        fact: 'Béchamp lost this debate 150 years ago — Koch and Pasteur won with evidence',
        humor: 'CREDIBILITY: 19th century losing argument repackaged for the internet',
        humor_style: 'rating',
        source: 'Koch Postulates, 1890',
      },
      {
        claim: 'GERM THEORY IS WRONG',
        verdict: 'FALSE',
        fact: 'Every antibiotic, antiviral, and vaccine works because germ theory is correct',
        humor: 'If germs are fake, why does hand sanitizer work?',
        humor_style: 'sarcastic',
        source: 'Microbiology textbooks',
      },
    ],
  },

  // ============================================================
  // 10. GMO FEARS (26/93 streams)
  // ============================================================
  {
    id: 'gmo_fears',
    triggers: ['gmo', 'gmos', 'genetically modified', 'monsanto', 'glyphosate', 'roundup', 'frankenfood', 'modified food'],
    cards: [
      {
        claim: 'GMOS ARE DANGEROUS',
        verdict: 'FALSE',
        fact: '2,000+ studies confirm GMO safety — zero credible evidence of harm',
        humor: 'Every banana you eat was genetically modified. By farmers. For centuries.',
        humor_style: 'sarcastic',
        source: 'NAS Report, 2016',
      },
      {
        claim: 'GMOS ARE POISON',
        verdict: 'DEBUNKED',
        fact: 'Every major science org worldwide confirms GMO safety',
        humor: 'CREDIBILITY: Food Babe blog vs 2,000 peer-reviewed studies',
        humor_style: 'rating',
        source: 'WHO; AMA; AAAS, 2016',
      },
    ],
  },

  // ============================================================
  // 11. IVERMECTIN (25/93 streams)
  // ============================================================
  {
    id: 'ivermectin',
    triggers: ['ivermectin', 'horse paste', 'hydroxychloroquine', 'hcq'],
    cards: [
      {
        claim: 'IVERMECTIN CURES COVID',
        verdict: 'FALSE',
        fact: 'Largest clinical trials found zero benefit for COVID treatment',
        humor: 'BOSS DEFEATED: Dr. Horse Paste — downed by clinical trials',
        humor_style: 'boss_battle',
        source: 'NEJM, 2022; JAMA, 2022',
      },
      {
        claim: 'THEY SUPPRESSED IVERMECTIN',
        verdict: 'FALSE',
        fact: 'It was studied extensively — it just did not work',
        humor: 'Nobody suppressed it. It was tested. It failed. That is how science works.',
        humor_style: 'sarcastic',
        source: 'Cochrane Review, 2022',
      },
    ],
  },

  // ============================================================
  // 12. VAERS MISUSE (15/93 streams)
  // ============================================================
  {
    id: 'vaers',
    triggers: ['vaers', 'adverse event reporting', 'vaers data', 'vaers shows', 'reported to vaers'],
    cards: [
      {
        claim: 'VAERS PROVES DANGER',
        verdict: 'MISLEADING',
        fact: 'VAERS is unverified self-reporting — anyone can submit anything',
        humor: 'VAERS also has reports of vaccines turning people into the Hulk. Literally.',
        humor_style: 'sarcastic',
        source: 'CDC VAERS Disclaimer',
      },
      {
        claim: 'VAERS DEATHS = PROOF',
        verdict: 'MISLEADING',
        fact: 'VAERS reports correlation, not causation — that is printed on the website',
        humor: '📋 "Unverified" is literally in the VAERS disclaimer',
        humor_style: 'emoji',
        source: 'HHS/CDC, 2023',
      },
    ],
  },

  // ============================================================
  // 13. VACCINE SCHEDULE / TOO MANY VACCINES (29/93 streams)
  // ============================================================
  {
    id: 'vaccine_schedule',
    triggers: ['too many vaccines', 'vaccine schedule', 'too many shots', 'delay the schedule', 'too soon', 'overloaded immune', 'infant immune system'],
    cards: [
      {
        claim: 'TOO MANY VACCINES',
        verdict: 'FALSE',
        fact: 'Babies fight thousands of antigens daily — vaccines add a tiny fraction',
        humor: 'A baby crawling on a floor encounters more antigens than the entire vaccine schedule',
        humor_style: 'sarcastic',
        source: 'Pediatrics, 2002; AAP',
      },
      {
        claim: 'DELAY THE SCHEDULE',
        verdict: 'MISLEADING',
        fact: 'Delaying vaccines leaves children unprotected during highest-risk period',
        humor: 'CREDIBILITY: parenting blog vs immunologists',
        humor_style: 'rating',
        source: 'CDC; AAP Guidelines',
      },
    ],
  },

  // ============================================================
  // 14. YOUNG EARTH CREATIONISM (22/93 streams)
  // ============================================================
  {
    id: 'young_earth',
    triggers: ['6000 year', '6,000 year', 'young earth', 'earth is 6000', 'earth is young', 'created in 6 days'],
    cards: [
      {
        claim: 'EARTH IS 6,000 YEARS OLD',
        verdict: 'FALSE',
        fact: 'Earth is 4.54 billion years old — confirmed by radiometric dating',
        humor: 'Off by a factor of 750,000. Not great math.',
        humor_style: 'sarcastic',
        source: 'Geology; multiple methods',
      },
      {
        claim: 'YOUNG EARTH IS REAL',
        verdict: 'DEBUNKED',
        fact: 'Ice cores, tree rings, radiometric dating all independently confirm billions of years',
        humor: '🌍 4,540,000,000 vs 6,000 — one of these is not like the other',
        humor_style: 'emoji',
        source: 'USGS; Nature, 2014',
      },
    ],
  },

  // ============================================================
  // 15. SPIKE PROTEIN DANGER (26/93 streams)
  // ============================================================
  {
    id: 'spike_protein',
    triggers: ['spike protein', 'spike is toxic', 'spike damage', 'spike protein danger', 'free spike'],
    cards: [
      {
        claim: 'SPIKE PROTEIN IS TOXIC',
        verdict: 'MISLEADING',
        fact: 'Vaccine spike is anchored to cells and breaks down quickly — not free-floating',
        humor: 'The virus has WAY more spike protein than the vaccine. Pick your poison.',
        humor_style: 'sarcastic',
        source: 'Cell, 2020; Nature, 2021',
      },
      {
        claim: 'SPIKE PROTEIN DAMAGE',
        verdict: 'MISLEADING',
        fact: 'Vaccine-generated spike is modified to be harmless — virus spike is the dangerous one',
        humor: 'CREDIBILITY: fearing the photo of the criminal, not the criminal',
        humor_style: 'rating',
        source: 'Science, 2021',
      },
    ],
  },

  // ============================================================
  // 16. MEDICAL FREEDOM / MANDATES (29/93 streams)
  // ============================================================
  {
    id: 'mandates',
    triggers: ['my body my choice', 'forced vaccination', 'mandate', 'mandates', 'medical freedom', 'forced to take', 'bodily autonomy vaccine'],
    cards: [
      {
        claim: 'FORCED VACCINATION',
        verdict: 'MISLEADING',
        fact: 'No one was physically forced — mandates offered alternatives like testing',
        humor: '"Forced" like shoes in a restaurant are "forced"',
        humor_style: 'sarcastic',
        source: 'OSHA; SCOTUS, 2022',
      },
      {
        claim: 'MEDICAL FREEDOM',
        verdict: 'MISLEADING',
        fact: 'Public health requirements have existed since George Washington mandated smallpox inoculation',
        humor: '🇺🇸 Vaccine mandates are literally older than the Constitution',
        humor_style: 'emoji',
        source: 'US History, 1777',
      },
    ],
  },

  // ============================================================
  // 17. FLUORIDE (16/93 streams)
  // ============================================================
  {
    id: 'fluoride',
    triggers: ['fluoride', 'fluoride in water', 'water fluoridation', 'fluoride poison'],
    cards: [
      {
        claim: 'FLUORIDE IS POISON',
        verdict: 'MISLEADING',
        fact: 'At recommended levels, fluoride reduces cavities 25% with no health risk',
        humor: 'Everything is toxic at the wrong dose. Even water.',
        humor_style: 'sarcastic',
        source: 'ADA; WHO, 2022',
      },
    ],
  },

  // ============================================================
  // 18. ILLUMINATI / SECRET SOCIETIES (20/93 streams)
  // ============================================================
  {
    id: 'illuminati',
    triggers: ['illuminati', 'freemason', 'secret society', 'new world order', 'nwo', 'deep state', 'they control everything'],
    cards: [
      {
        claim: 'ILLUMINATI CONTROLS SCIENCE',
        verdict: 'FALSE',
        fact: 'Scientific consensus requires thousands of independent researchers to agree',
        humor: 'The real conspiracy is how badly this argument falls apart with basic logic',
        humor_style: 'sarcastic',
        source: 'History; Logic',
      },
    ],
  },

  // ============================================================
  // 19. EVOLUTION DENIAL (14/93 streams for speciation)
  // ============================================================
  {
    id: 'evolution_denial',
    triggers: ['just a theory', 'macro evolution', 'microevolution', 'missing link', 'monkeys to humans', 'if we came from monkeys', 'evolution is a lie', 'evolution is fake', 'evolution is wrong', 'irreducible complexity'],
    cards: [
      {
        claim: 'EVOLUTION IS JUST A THEORY',
        verdict: 'MISLEADING',
        fact: 'Scientific theory = extensively tested explanation — like gravity',
        humor: 'Gravity is "just a theory" too. Try jumping off a building.',
        humor_style: 'sarcastic',
        source: 'NAS Definition, 2008',
      },
      {
        claim: 'NO MISSING LINKS',
        verdict: 'FALSE',
        fact: 'Thousands of transitional fossils found — Tiktaalik, Archaeopteryx, Homo erectus',
        humor: 'Every fossil found creates two new "gaps." Convenient.',
        humor_style: 'sarcastic',
        source: 'Nature; Smithsonian',
      },
      {
        claim: 'CAME FROM MONKEYS?',
        verdict: 'MISLEADING',
        fact: 'Humans and apes share a common ancestor — nobody said we "came from monkeys"',
        humor: 'CREDIBILITY: misunderstanding a family tree as a ladder',
        humor_style: 'rating',
        source: 'Genetics 101; Nature, 2005',
      },
    ],
  },

  // ============================================================
  // 20. RFK / MAHA (72/93 streams)
  // ============================================================
  {
    id: 'rfk_maha',
    triggers: ['rfk', 'robert kennedy', 'make america healthy', 'maha', 'kennedy vaccines', 'rfk jr'],
    cards: [
      {
        claim: 'RFK KNOWS THE TRUTH',
        verdict: 'MISLEADING',
        fact: 'RFK Jr has no medical or scientific credentials — he is an environmental lawyer',
        humor: 'CREDIBILITY: getting medical advice from a lawyer',
        humor_style: 'rating',
        source: 'Public Record',
      },
      {
        claim: 'MAHA WILL FIX HEALTH',
        verdict: 'MISLEADING',
        fact: 'RFK Jr opposes vaccines that prevent millions of deaths annually',
        humor: 'Making America Healthy by... removing the thing that prevents disease?',
        humor_style: 'sarcastic',
        source: 'WHO; CDC Data, 2024',
      },
    ],
  },

  // ============================================================
  // 21. DNA CONTAMINATION / PLASMIDS (14/93 streams)
  // ============================================================
  {
    id: 'dna_contamination',
    triggers: ['dna contamination', 'plasmid', 'sv40', 'dna fragments', 'contaminated vaccine'],
    cards: [
      {
        claim: 'DNA CONTAMINATION IN VACCINES',
        verdict: 'MISLEADING',
        fact: 'Residual DNA fragments are far below safety thresholds set by regulators',
        humor: 'You eat more foreign DNA in a salad than in a vaccine',
        humor_style: 'sarcastic',
        source: 'FDA; EMA Guidance, 2023',
      },
    ],
  },

  // ============================================================
  // 22. ALUMINUM IN VACCINES (13/93 streams)
  // ============================================================
  {
    id: 'aluminum',
    triggers: ['aluminum', 'aluminium', 'adjuvant', 'heavy metals in vaccines', 'mercury in vaccines', 'thimerosal'],
    cards: [
      {
        claim: 'ALUMINUM IN VACCINES',
        verdict: 'MISLEADING',
        fact: 'Breast milk has more aluminum than all childhood vaccines combined',
        humor: 'Wait till they hear about aluminum in antacids',
        humor_style: 'sarcastic',
        source: 'Pediatrics, 2011; FDA',
      },
      {
        claim: 'MERCURY IN VACCINES',
        verdict: 'DEBUNKED',
        fact: 'Thimerosal removed from childhood vaccines in 2001 — and was never harmful',
        humor: 'Removed 24 years ago. Time to update the talking points.',
        humor_style: 'sarcastic',
        source: 'FDA; IOM Report, 2004',
      },
    ],
  },

  // ============================================================
  // 23. PHARMA LIABILITY / CAN'T SUE (12/93 streams)
  // ============================================================
  {
    id: 'pharma_liability',
    triggers: ["can't sue", 'cant sue', 'no liability', 'vaccine court', 'national childhood vaccine injury act', 'immune from lawsuits'],
    cards: [
      {
        claim: "CAN'T SUE PHARMA",
        verdict: 'MISLEADING',
        fact: 'Vaccine Court exists specifically to compensate injuries — faster than regular courts',
        humor: 'There is literally a court for this. It has paid out $4.7 billion.',
        humor_style: 'sarcastic',
        source: 'HRSA VICP Data, 2024',
      },
    ],
  },

  // ============================================================
  // 24. LOCKDOWNS / COVID RESTRICTIONS (27/93 streams)
  // ============================================================
  {
    id: 'lockdowns',
    triggers: ['lockdown', 'lockdowns', 'shut down the economy', 'stay home order', 'quarantine camps'],
    cards: [
      {
        claim: 'LOCKDOWNS DID NOTHING',
        verdict: 'MISLEADING',
        fact: 'Early lockdowns reduced transmission 60-80% — bought time for hospitals',
        humor: 'Seatbelts are inconvenient too. We still use them.',
        humor_style: 'sarcastic',
        source: 'Nature, 2020; Lancet, 2021',
      },
    ],
  },

  // ============================================================
  // 25. FOOD DYES / PROCESSED FOOD (13/93 streams)
  // ============================================================
  {
    id: 'food_dyes',
    triggers: ['food dye', 'food dyes', 'red 40', 'yellow 5', 'seed oil', 'seed oils', 'processed food poison', 'food is poison'],
    cards: [
      {
        claim: 'FOOD DYES ARE POISON',
        verdict: 'MISLEADING',
        fact: 'FDA-approved dyes tested extensively — amounts in food are well below any risk threshold',
        humor: 'If the dose makes the poison, a Skittle is not it',
        humor_style: 'sarcastic',
        source: 'FDA; EFSA Reviews',
      },
    ],
  },

  // ============================================================
  // 26. PCR TESTS (11/93 streams)
  // ============================================================
  {
    id: 'pcr_tests',
    triggers: ['pcr test', 'pcr tests', 'cycle threshold', 'false positive pcr', 'kary mullis'],
    cards: [
      {
        claim: 'PCR TESTS ARE FAKE',
        verdict: 'FALSE',
        fact: 'PCR is the gold standard of molecular diagnostics — used for decades',
        humor: 'PCR literally won the Nobel Prize but sure, it does not work',
        humor_style: 'sarcastic',
        source: 'Nobel Prize, 1993; WHO',
      },
    ],
  },

  // ============================================================
  // 27. BILL GATES (11/93 streams)
  // ============================================================
  {
    id: 'bill_gates',
    triggers: ['bill gates', 'gates foundation', 'gates depopulation', 'microchip', 'microchips in vaccines'],
    cards: [
      {
        claim: 'BILL GATES MICROCHIPS',
        verdict: 'FALSE',
        fact: 'No microchip exists small enough to fit through a vaccine needle',
        humor: 'Your phone already tracks you. For free. You bought it yourself.',
        humor_style: 'sarcastic',
        source: 'Physics; Engineering',
      },
    ],
  },

  // ============================================================
  // 28. 5G (5/93 streams)
  // ============================================================
  {
    id: 'five_g',
    triggers: ['5g', '5g causes', '5g covid', '5g radiation', '5g towers'],
    cards: [
      {
        claim: '5G CAUSES COVID',
        verdict: 'FALSE',
        fact: 'Viruses cannot travel on radio waves — they are completely different things',
        humor: 'CREDIBILITY: blaming WiFi for a sneeze',
        humor_style: 'rating',
        source: 'Physics 101; WHO, 2020',
      },
    ],
  },

  // ============================================================
  // 29. CENSORSHIP META-ARGUMENT (42/93 streams)
  // ============================================================
  {
    id: 'censorship',
    triggers: ['they censor', 'being censored', 'silenced', 'they silence', 'banned for speaking truth', 'suppressing the truth', 'mainstream media lies', 'media lies'],
    cards: [
      {
        claim: 'TRUTH IS BEING CENSORED',
        verdict: 'MISLEADING',
        fact: 'Misinformation moderation is not censorship — you are literally saying this on a live stream right now',
        humor: '"I AM BEING SILENCED" they scream, into a microphone, to thousands of people',
        humor_style: 'sarcastic',
        source: '1st Amendment; Logic',
      },
    ],
  },

  // ============================================================
  // 30. "DO YOUR OWN RESEARCH" (7/93 streams)
  // ============================================================
  {
    id: 'do_your_research',
    triggers: ['do your own research', 'do your research', 'look it up', 'just google it', 'research it yourself'],
    cards: [
      {
        claim: 'DO YOUR OWN RESEARCH',
        verdict: 'MISLEADING',
        fact: 'Watching videos is not research — real research requires methodology and peer review',
        humor: 'CREDIBILITY: 20 min on social media vs a PhD program',
        humor_style: 'rating',
        source: 'Scientific Method 101',
      },
    ],
  },

  // ============================================================
  // 31. VACCINATED VS UNVACCINATED STUDY (24/93 streams)
  // ============================================================
  {
    id: 'vaxxed_unvaxxed',
    triggers: ['vaccinated vs unvaccinated', 'unvaccinated study', 'no control group', 'double blind placebo', 'no placebo study', 'saline placebo'],
    cards: [
      {
        claim: 'NO VAXXED VS UNVAXXED STUDY',
        verdict: 'FALSE',
        fact: 'Multiple large studies compare vaccinated and unvaccinated populations',
        humor: 'They exist. You just have not read them.',
        humor_style: 'sarcastic',
        source: 'NEJM; JAMA; Pediatrics',
      },
      {
        claim: 'NO PLACEBO CONTROLLED TRIAL',
        verdict: 'FALSE',
        fact: 'COVID vaccine trials had 44,000 participants with saline placebo groups',
        humor: 'CREDIBILITY: claiming studies do not exist without checking if they exist',
        humor_style: 'rating',
        source: 'NEJM, 2020 (Pfizer trial)',
      },
    ],
  },

  // ============================================================
  // 32. TURBO CANCER (8/93 streams)
  // ============================================================
  {
    id: 'turbo_cancer',
    triggers: ['turbo cancer', 'cancer from vaccine', 'cancer rates up', 'vaccines cause cancer'],
    cards: [
      {
        claim: 'TURBO CANCER FROM VACCINES',
        verdict: 'FALSE',
        fact: 'No mechanism exists — cancer rates trends unchanged post-vaccination',
        humor: '"Turbo cancer" is not a medical term. It is a social media term.',
        humor_style: 'sarcastic',
        source: 'ACS; NCI Data, 2024',
      },
    ],
  },

  // ============================================================
  // 33. GRAPHENE OXIDE (10/93 streams)
  // ============================================================
  {
    id: 'graphene_oxide',
    triggers: ['graphene oxide', 'graphene in vaccine', 'nanoparticles in vaccine'],
    cards: [
      {
        claim: 'GRAPHENE OXIDE IN VACCINES',
        verdict: 'FALSE',
        fact: 'Independent labs worldwide found zero graphene oxide in any approved vaccine',
        humor: 'BOSS DEFEATED: Professor Nanoparticle — debunked by mass spectrometry',
        humor_style: 'boss_battle',
        source: 'AP Fact Check; FDA, 2021',
      },
    ],
  },

  // ============================================================
  // 34. VACCINE SHEDDING (3/93 streams)
  // ============================================================
  {
    id: 'vaccine_shedding',
    triggers: ['vaccine shedding', 'shedding spike', 'vaccinated people shed'],
    cards: [
      {
        claim: 'VACCINES CAUSE SHEDDING',
        verdict: 'FALSE',
        fact: 'mRNA vaccines contain no live virus — shedding is physically impossible',
        humor: 'Cannot shed what is not there. Basic logic.',
        humor_style: 'sarcastic',
        source: 'CDC; Immunology 101',
      },
    ],
  },

  // ============================================================
  // 35. MOON LANDING (10/93 streams)
  // ============================================================
  {
    id: 'moon_landing',
    triggers: ['moon landing', 'moon landing fake', 'never went to moon', 'moon hoax'],
    cards: [
      {
        claim: 'MOON LANDING WAS FAKED',
        verdict: 'FALSE',
        fact: 'Retroreflectors left on the moon are used by scientists daily — still there',
        humor: '400,000 people worked on Apollo. Nobody talked. Worst conspiracy ever.',
        humor_style: 'sarcastic',
        source: 'NASA; Independent verification',
      },
    ],
  },
];

// ============================================================
// MATCHING ENGINE
// ============================================================

/**
 * Find the best matching cached claim for a transcript.
 * Returns null if no match (falls through to live LLM).
 *
 * Uses a scoring system:
 * - Each trigger phrase match = 1 point
 * - Multiple matches in the same category = higher confidence
 * - Returns the highest-scoring category
 */
function findCachedCard(transcript, recentTopics) {
  const lower = transcript.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of CACHED_CLAIMS) {
    let score = 0;
    const matchedTriggers = [];

    for (const trigger of entry.triggers) {
      if (lower.includes(trigger)) {
        score++;
        matchedTriggers.push(trigger);
      }
    }

    if (score > bestScore) {
      // Check if this claim was already recently covered
      const alreadyCovered = recentTopics && recentTopics.some(t => {
        const tLower = (t || '').toLowerCase();
        return entry.cards.some(c => tLower.includes(c.claim.toLowerCase().substring(0, 10)));
      });

      if (!alreadyCovered) {
        bestScore = score;
        bestMatch = { entry, matchedTriggers, score };
      }
    }
  }

  // Require at least 1 trigger match
  if (!bestMatch || bestScore < 1) {
    return null;
  }

  // Pick a random card variant for variety
  const cards = bestMatch.entry.cards;
  const card = cards[Math.floor(Math.random() * cards.length)];

  return {
    ...card,
    found: true,
    _cached: true,
    _cacheId: bestMatch.entry.id,
    _triggers: bestMatch.matchedTriggers,
    _score: bestMatch.score,
  };
}

/**
 * Get all cached claim IDs (for stats/debugging).
 */
function getCacheStats() {
  return {
    totalClaims: CACHED_CLAIMS.length,
    totalCards: CACHED_CLAIMS.reduce((sum, c) => sum + c.cards.length, 0),
    claims: CACHED_CLAIMS.map(c => ({
      id: c.id,
      triggers: c.triggers.length,
      variants: c.cards.length,
    })),
  };
}

module.exports = { findCachedCard, getCacheStats, CACHED_CLAIMS };
