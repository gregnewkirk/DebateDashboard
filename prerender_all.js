#!/usr/bin/env node
/**
 * Full TTS Pre-Render — Generates WAV for ALL 17,696 responses.
 * Run standalone: node prerender_all.js
 * Takes ~7-8 hours. Saves to public/tts_cache/
 * Safe to interrupt — picks up where it left off on restart.
 */

const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PYTHON = '/opt/homebrew/bin/python3.12';
const TTS_SCRIPT = path.join(__dirname, 'kokoro_tts.py');
const CACHE_DIR = path.join(__dirname, 'public', 'tts_cache');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function textHash(text) {
  return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex').substring(0, 16);
}

function generateWav(text, outPath) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [TTS_SCRIPT, text, outPath], { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

async function main() {
  console.log('=== FULL TTS PRE-RENDER ===');
  console.log(`Cache dir: ${CACHE_DIR}`);

  // Collect ALL texts in priority order
  const allTexts = [];

  // 1. Donations (highest priority)
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_donations.json'), 'utf8'));
    const items = d.donation_responses || d;
    for (const line of items) {
      allTexts.push(line.replace(/\{name\}/g, 'friend').replace(/\{amount\}/g, 'the donation'));
    }
    console.log(`  Donations: ${items.length}`);
  } catch (e) { console.warn('  Donations: FAILED', e.message); }

  // 2. General responses
  try {
    const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_responses.json'), 'utf8'));
    let count = 0;
    for (const items of Object.values(r)) {
      allTexts.push(...items);
      count += items.length;
    }
    console.log(`  General responses: ${count}`);
  } catch (e) { console.warn('  General: FAILED', e.message); }

  // 3. Conversations
  try {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_conversations.json'), 'utf8'));
    const groups = c.conversations || c;
    let count = 0;
    for (const g of groups) {
      allTexts.push(...g.responses);
      count += g.responses.length;
    }
    console.log(`  Conversations: ${count}`);
  } catch (e) { console.warn('  Conversations: FAILED', e.message); }

  // 4. Science-derived responses
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_science_responses.json'), 'utf8'));
    const sr = s.science_responses || s;
    let count = 0;
    for (const items of Object.values(sr)) {
      allTexts.push(...items);
      count += items.length;
    }
    console.log(`  Science responses: ${count}`);
  } catch (e) { console.warn('  Science: FAILED', e.message); }

  // 5. Debate prompts
  const prompts = ["Patriotism requires vaccines.", "GMOs feed the world.", "Trump is anti-science.", "Climate change is real.", "Evolution produced humans."];
  allTexts.push(...prompts);

  console.log(`\n  TOTAL: ${allTexts.length} texts to render`);

  // Check existing cache
  const existing = new Set(fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.wav')).map(f => f.replace('.wav', '')));
  const toGenerate = allTexts.filter(t => !existing.has(textHash(t)));

  console.log(`  Already cached: ${allTexts.length - toGenerate.length}`);
  console.log(`  To generate: ${toGenerate.length}`);
  console.log(`  Estimated time: ${Math.round(toGenerate.length * 1.8 / 60)} minutes`);
  console.log('\n  Starting...\n');

  let done = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const text of toGenerate) {
    const hash = textHash(text);
    const wavPath = path.join(CACHE_DIR, `${hash}.wav`);

    try {
      const result = await generateWav(text, wavPath);
      done++;

      if (done % 25 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = done / elapsed;
        const remaining = (toGenerate.length - done) / rate;
        const pct = Math.round((done / toGenerate.length) * 100);
        const cachedTotal = existing.size + done;
        console.log(`  [${pct}%] ${done}/${toGenerate.length} generated | ${cachedTotal} total cached | ${Math.round(remaining / 60)}min remaining | ${errors} errors`);
      }
    } catch (err) {
      errors++;
      if (errors % 10 === 0) console.warn(`  ⚠️  ${errors} errors so far`);
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  const totalCached = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.wav')).length;
  console.log(`\n=== PRE-RENDER COMPLETE ===`);
  console.log(`  Generated: ${done}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total cached: ${totalCached}`);
  console.log(`  Time: ${totalTime} minutes`);
  console.log(`  Disk usage: ${Math.round(totalCached * 50 / 1024)}MB estimated`);
}

main().catch(console.error);
