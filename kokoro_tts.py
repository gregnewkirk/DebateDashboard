#!/usr/bin/env python3
"""
Kokoro TTS for Rosalind Franklin — DebateDashboard AI Co-Host
Voice: af_heart | Model: onnx-community/Kokoro-82M-v1.0-ONNX
Usage: python3 kokoro_tts.py "Text to speak" /path/to/output.wav
"""
import sys, os, time
import numpy as np

# Monkey-patch np.load for .npz compatibility
_orig_load = np.load
def _patched_load(f, *a, **kw):
    kw.setdefault('allow_pickle', True)
    return _orig_load(f, *a, **kw)
np.load = _patched_load

import kokoro_onnx
import soundfile as sf

# Fix batch dimension for onnx-community model
def _fixed_create_audio(self, phonemes, voice, speed):
    tokens = np.array(self.tokenizer.tokenize(phonemes), dtype=np.int64)
    if len(tokens) > 510:
        tokens = tokens[:510]
    style = voice[len(tokens)]
    if style.ndim == 1:
        style = style.reshape(1, -1)
    inputs = {
        "input_ids": np.array([[0, *tokens.tolist(), 0]], dtype=np.int64),
        "style": style.astype(np.float32),
        "speed": np.array([speed], dtype=np.float32),
    }
    audio = self.sess.run(None, inputs)[0]
    return audio, 24000

kokoro_onnx.Kokoro._create_audio = _fixed_create_audio

# Paths relative to this script
BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(BASE, 'voices', 'kokoro', 'onnx', 'model.onnx')
VOICES = os.path.join(BASE, 'voices', 'kokoro', 'voices_combined.npz')
VOICE = 'af_heart'

# Load model once
kokoro = kokoro_onnx.Kokoro(MODEL, VOICES)

def speak(text, output_path, speed=1.0):
    t0 = time.time()
    audio, sr = kokoro.create(text, VOICE, speed=speed)
    audio = np.array(audio).flatten().astype(np.float32)
    sf.write(output_path, audio, sr, subtype='PCM_16', format='WAV')
    elapsed = time.time() - t0
    duration = len(audio) / sr
    print(f"{duration:.1f}s audio in {elapsed:.1f}s (RTF: {elapsed/duration:.2f})")
    return duration

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: kokoro_tts.py \"text\" output.wav [speed]")
        sys.exit(1)
    text = sys.argv[1]
    output = sys.argv[2]
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    speak(text, output, speed)
