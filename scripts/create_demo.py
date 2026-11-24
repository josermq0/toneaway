"""Optional offline creation of the bundled contaminated-speech demonstration WAV.

Requirements FOR THIS SCRIPT ONLY: Python 3, espeak and ffmpeg on PATH.
ToneAway itself has no TTS or interference-generation functionality.
"""
from array import array
from pathlib import Path
import math
import subprocess
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'audio' / 'entrevista_ruidosa.wav'
TEXT = (
    'Hola. Esta grabación contiene varias interferencias tonales. '
    'ToneAway identifica sus frecuencias y las atenúa usando '
    'el método iterativo de Jacobi. Escuche el resultado.'
)
FREQUENCIES = (620.25, 800.35, 1100.45, 1450.55)
AMPLITUDES = (.045, .060, .048, .039)
FS = 48000
DURATION = 12


def main():
    with tempfile.TemporaryDirectory() as directory:
        raw = Path(directory) / 'voice.wav'
        pcm = Path(directory) / 'voice_48k.wav'
        subprocess.run(['espeak', '-v', 'es-la', '-s', '180', '-a', '145', '-w', str(raw), TEXT], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-ar', str(FS), '-ac', '1', '-c:a', 'pcm_s16le', str(pcm)], check=True)
        with wave.open(str(pcm), 'rb') as audio:
            assert audio.getframerate() == FS and audio.getnchannels() == 1 and audio.getsampwidth() == 2
            voice_bytes = audio.readframes(audio.getnframes())
    voice = array('h')
    voice.frombytes(voice_bytes)
    if sys.byteorder != 'little':
        voice.byteswap()
    output = array('h')
    for i in range(FS * DURATION):
        t = i / FS
        vocal = (voice[i] / 32768 * .53) if i < len(voice) else 0.0
        interference = sum(a * math.sin(2 * math.pi * f * t + .37 * j)
                           for j, (f, a) in enumerate(zip(FREQUENCIES, AMPLITUDES)))
        sample = vocal + interference
        output.append(int(max(-1.0, min(1.0, sample)) * 32767))
    DEST.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(DEST), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(FS)
        if sys.byteorder != 'little':
            output.byteswap()
        out.writeframes(output.tobytes())
    print(f'Wrote {DEST}: {DURATION} s, {FS} Hz, tones {FREQUENCIES}')


if __name__ == '__main__':
    main()
