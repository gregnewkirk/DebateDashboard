/**
 * Server-Side Mic Capture + Whisper Transcription
 *
 * Receives audio over the network from the Windows PC via UDP stream,
 * records fixed-length chunks, transcribes with Whisper, and feeds
 * into the transcript pipeline. Safari is display-only.
 *
 * WINDOWS PC runs:
 *   ffmpeg -f dshow -i audio="YOUR_MIC_DEVICE" -ac 1 -ar 16000 -f mpegts udp://192.168.1.49:9999
 *
 * Or to find device names:
 *   ffmpeg -list_devices true -f dshow -i dummy
 */

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const WHISPER = '/opt/homebrew/bin/whisper';
const CHUNK_DIR = path.join(__dirname, 'public', 'tts');
const CHUNK_SECONDS = 4; // shorter chunks = faster response
const LISTEN_PORT = 9999;

let recording = false;
let chunkCounter = 0;
let onTranscript = null;
let lastTranscript = '';
let lastTranscriptTime = 0;
let transcriptCount = 0;
let ffmpegProcess = null;
let muted = false;  // Mute mic while Marie is speaking (prevent feedback loop)

/**
 * Start listening for audio from the network stream.
 * @param {function} callback - Called with (transcriptText) for each chunk
 */
function startMicListener(callback) {
  if (recording) {
    console.warn('[Mic] Already recording');
    return;
  }
  onTranscript = callback;
  recording = true;
  console.log(`[Mic] Listening for audio stream on UDP port ${LISTEN_PORT}...`);
  console.log('[Mic] Windows PC should run: ffmpeg -f dshow -i audio="YOUR_MIC" -ac 1 -ar 16000 -f mpegts udp://192.168.1.49:9999');
  recordNextChunk();
}

function stopMicListener() {
  recording = false;
  onTranscript = null;
  if (ffmpegProcess) {
    ffmpegProcess.kill();
    ffmpegProcess = null;
  }
  console.log('[Mic] Stopped');
}

function recordNextChunk() {
  if (!recording) return;

  const chunkFile = path.join(CHUNK_DIR, `mic_${String(++chunkCounter).padStart(4, '0')}.wav`);

  // Use ffmpeg to grab CHUNK_SECONDS of audio from the UDP stream
  // -y = overwrite, -t = duration, timeout after 12s if no stream
  ffmpegProcess = spawn('ffmpeg', [
    '-y',
    '-i', `udp://0.0.0.0:${LISTEN_PORT}?timeout=12000000`,  // timeout in microseconds
    '-ac', '1',
    '-ar', '16000',
    '-t', String(CHUNK_SECONDS),
    '-vn',  // no video
    chunkFile,
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderrBuf = '';
  ffmpegProcess.stderr.on('data', (d) => { stderrBuf += d.toString(); });

  ffmpegProcess.on('close', (code) => {
    ffmpegProcess = null;
    if (!recording) return;

    // Check file exists and has content
    try {
      const stat = fs.statSync(chunkFile);
      if (stat.size < 5000) {
        // Too small — no stream or silence
        try { fs.unlinkSync(chunkFile); } catch {}
        // Wait a bit before retrying (stream might not be running yet)
        setTimeout(recordNextChunk, 2000);
        return;
      }
    } catch {
      setTimeout(recordNextChunk, 2000);
      return;
    }

    // Transcribe with Whisper
    transcribeChunk(chunkFile).then((text) => {
      try { fs.unlinkSync(chunkFile); } catch {}

      const cleaned = text.replace(/\[.*?\]/g, '').trim();
      if (muted) {
        // Marie is speaking — discard this chunk to prevent feedback loop
        recordNextChunk();
        return;
      }
      if (cleaned.length > 3 && !isWhisperNoise(cleaned) && onTranscript) {
        console.log(`[Mic] Heard: "${cleaned.substring(0, 80)}"`);
        lastTranscript = cleaned;
        lastTranscriptTime = Date.now();
        transcriptCount++;
        onTranscript(cleaned);
      }

      recordNextChunk();
    }).catch((err) => {
      console.warn('[Mic] Transcription error:', err.message);
      try { fs.unlinkSync(chunkFile); } catch {}
      recordNextChunk();
    });
  });

  ffmpegProcess.on('error', (err) => {
    console.error('[Mic] ffmpeg error:', err.message);
    ffmpegProcess = null;
    setTimeout(recordNextChunk, 3000);
  });
}

/**
 * Filter out Whisper's common hallucinations on near-silence.
 */
function isWhisperNoise(text) {
  const lower = text.toLowerCase().trim();

  // Exact matches — common Whisper hallucinations
  const exactNoise = [
    'you', 'thank you', 'thanks', 'thanks for watching',
    'subscribe', 'bye', 'the end', 'okay',
    'music', 'applause', 'silence', 'laughter',
    'thank you for watching', 'please subscribe',
    'thanks for watching', 'see you next time',
    'like and subscribe', 'ring the bell',
    'do not even hate yourself',
    'so', 'um', 'uh', 'hmm', 'ah', 'oh',
  ];
  if (exactNoise.includes(lower)) return true;

  // Marie's own TTS output feeding back through the mic
  // These are phrases Whisper picks up from Marie speaking
  const marieFeedback = [
    'the ai co-host', 'ai co-host', 'co-host',
    'dr. greg debates live with marie curie',
    'dr greg debates live with marie curie',
    'dr. greg debates', 'marie curie the ai',
    'asterisk checks her radiation badge asterisk',
    'asterisk', 'checks her radiation badge',
    'liberty demands truth', 'patriotism requires vaccines',
  ];
  if (marieFeedback.some(phrase => lower.includes(phrase))) return true;

  // Whisper often parrots the initial_prompt — reject anything that sounds
  // like the dashboard title, subtitle, or Marie's self-description
  if (lower.includes('dr. greg debates') || lower.includes('dr greg debates')) return true;
  if (lower.includes('the ai co') || lower.includes('ai co-host')) return true;

  // Too short to be real speech
  if (lower.split(/\s+/).length < 3) return true;

  // Repeated characters / gibberish
  if (/(.)\1{4,}/.test(lower)) return true;

  return false;
}

async function transcribeChunk(wavPath) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(wavPath);
    const baseName = path.basename(wavPath, '.wav');

    execFile(WHISPER, [
      wavPath,
      '--model', 'base',
      '--language', 'en',
      '--output_format', 'txt',
      '--output_dir', outDir,
      '--fp16', 'False',
      '--initial_prompt', 'Dr. Greg debates live with Marie Curie, the AI co-host. Professor Curie, Marie, Curie. Marie fact-checks vaccines, flat earth, GMOs, evolution, climate change, MAHA, RFK, mRNA, VAERS, ivermectin, myocarditis, and conspiracy theories. Hey Marie. Hey Curie. Professor Curie.',
    ], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) return reject(err);

      const txtPath = path.join(outDir, baseName + '.txt');
      try {
        const text = fs.readFileSync(txtPath, 'utf8');
        try { fs.unlinkSync(txtPath); } catch {}
        resolve(text);
      } catch {
        resolve(stdout || '');
      }
    });
  });
}

/**
 * Mute mic while Marie is speaking to prevent feedback loop.
 * Call muteMic() before TTS plays, unmuteMic() after it finishes.
 */
let muteTimer = null;
function muteMic(durationMs) {
  muted = true;
  if (muteTimer) clearTimeout(muteTimer);
  muteTimer = setTimeout(() => {
    muted = false;
    muteTimer = null;
  }, durationMs);
}

function isMuted() { return muted; }

function getMicStatus() {
  return {
    active: recording,
    mode: 'UDP stream',
    port: LISTEN_PORT,
    chunks: chunkCounter,
    transcripts: transcriptCount,
    lastHeard: lastTranscript.substring(0, 80),
    lastHeardAgo: lastTranscriptTime ? Math.floor((Date.now() - lastTranscriptTime) / 1000) + 's ago' : 'never',
  };
}

module.exports = { startMicListener, stopMicListener, getMicStatus, muteMic, isMuted };
