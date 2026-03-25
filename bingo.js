/**
 * Conspiracy Bingo
 *
 * 5x5 bingo card that fills in as conspiracy claims are detected.
 * Center square is FREE. When a row/column/diagonal is complete, BINGO!
 *
 * Uses the top 24 conspiracy topics from the 93-stream analysis
 * (plus FREE center = 25 squares).
 */

const ALL_TOPICS = [
  { id: 'rfk_maha', label: 'RFK / MAHA', triggers: ['rfk', 'maha', 'make america healthy', 'robert kennedy'] },
  { id: 'flat_earth', label: 'FLAT EARTH', triggers: ['flat earth', 'earth is flat', 'globe lie'] },
  { id: 'lab_leak', label: 'LAB LEAK', triggers: ['lab leak', 'wuhan lab', 'made in a lab', 'bioweapon'] },
  { id: 'censorship', label: 'CENSORSHIP', triggers: ['censorship', 'they silence', 'banned', 'suppressed'] },
  { id: 'gene_therapy', label: 'GENE THERAPY', triggers: ['gene therapy', 'mrna changes dna', 'modifies your genes'] },
  { id: 'vaccine_injury', label: 'VACCINE INJURY', triggers: ['vaccine injury', 'vaccines are poison', 'vaccine damage'] },
  { id: 'myocarditis', label: 'MYOCARDITIS', triggers: ['myocarditis', 'heart inflammation', 'heart problems vaccine'] },
  { id: 'big_pharma', label: 'BIG PHARMA', triggers: ['big pharma', 'pharmaceutical companies', 'pharma profits'] },
  { id: 'vaccine_schedule', label: 'TOO MANY VACCINES', triggers: ['too many vaccines', 'vaccine schedule', 'overloaded'] },
  { id: 'mandates', label: 'MANDATES', triggers: ['mandate', 'forced vaccination', 'medical freedom', 'my body'] },
  { id: 'lockdowns', label: 'LOCKDOWNS', triggers: ['lockdown', 'masks don\'t work', 'covid restrictions'] },
  { id: 'terrain_theory', label: 'TERRAIN THEORY', triggers: ['terrain theory', 'germ theory is wrong', 'germs don\'t cause'] },
  { id: 'gmo', label: 'GMO FEARS', triggers: ['gmo', 'genetically modified', 'frankenfood'] },
  { id: 'spike_protein', label: 'SPIKE PROTEIN', triggers: ['spike protein', 'spike damage', 'toxic spike'] },
  { id: 'ivermectin', label: 'IVERMECTIN', triggers: ['ivermectin', 'horse paste', 'dewormer'] },
  { id: 'vaxxed_unvaxxed', label: 'VAXXED VS UNVAXXED', triggers: ['vaccinated vs unvaccinated', 'vaxxed vs unvaxxed', 'never been sick'] },
  { id: 'autism', label: 'VACCINES = AUTISM', triggers: ['autism', 'wakefield', 'vaccines cause autism'] },
  { id: 'creationism', label: 'YOUNG EARTH', triggers: ['young earth', '6000 years', 'creationism', 'god created'] },
  { id: 'natural_immunity', label: 'NATURAL IMMUNITY', triggers: ['natural immunity', 'immune system is enough', 'god-given immune'] },
  { id: 'illuminati', label: 'ILLUMINATI', triggers: ['illuminati', 'new world order', 'secret society', 'deep state'] },
  { id: 'fluoride', label: 'FLUORIDE', triggers: ['fluoride', 'fluoride in water', 'calcify pineal'] },
  { id: 'vaers', label: 'VAERS MISUSE', triggers: ['vaers', 'adverse events', 'reported deaths'] },
  { id: 'evolution', label: 'EVOLUTION DENIAL', triggers: ['evolution is just a theory', 'macro evolution', 'missing link'] },
  { id: 'bill_gates', label: 'BILL GATES', triggers: ['bill gates', 'gates foundation', 'microchip'] },
];

let board = [];    // 5x5 array of { topic, hit }
let bingoCount = 0;
let totalHits = 0;

/**
 * Generate a new random bingo board.
 */
function newBoard() {
  // Shuffle and pick 24 topics
  const shuffled = [...ALL_TOPICS].sort(() => Math.random() - 0.5).slice(0, 24);

  board = [];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    const r = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        r.push({ id: 'free', label: 'FREE', hit: true, triggers: [] });
      } else {
        r.push({ ...shuffled[idx], hit: false });
        idx++;
      }
    }
    board.push(r);
  }

  bingoCount = 0;
  totalHits = 1; // FREE square counts
  console.log('[Bingo] New board generated');
  return board;
}

/**
 * Check transcript against bingo board. Returns hit info if match found.
 */
function checkTranscript(text) {
  if (board.length === 0) return null;
  const lower = text.toLowerCase();

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cell = board[row][col];
      if (cell.hit) continue;
      if (cell.triggers && cell.triggers.some(t => lower.includes(t))) {
        cell.hit = true;
        totalHits++;

        const bingo = checkForBingo();
        console.log(`[Bingo] HIT: ${cell.label} (${totalHits}/25${bingo ? ' — BINGO!' : ''})`);

        return {
          row, col,
          topic: cell.label,
          id: cell.id,
          totalHits,
          isBingo: bingo,
          bingoCount,
        };
      }
    }
  }
  return null;
}

/**
 * Check all rows, columns, and diagonals for bingo.
 */
function checkForBingo() {
  let foundNew = false;

  // Rows
  for (let r = 0; r < 5; r++) {
    if (board[r].every(c => c.hit)) {
      foundNew = true;
    }
  }

  // Columns
  for (let c = 0; c < 5; c++) {
    if (board.every(r => r[c].hit)) {
      foundNew = true;
    }
  }

  // Diagonals
  if ([0,1,2,3,4].every(i => board[i][i].hit)) foundNew = true;
  if ([0,1,2,3,4].every(i => board[i][4-i].hit)) foundNew = true;

  if (foundNew) bingoCount++;
  return foundNew;
}

/**
 * Get current board state for display.
 */
function getBoard() {
  return {
    board,
    totalHits,
    bingoCount,
  };
}

// Generate initial board
newBoard();

module.exports = { newBoard, checkTranscript, getBoard };
