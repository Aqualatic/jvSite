// Reproducible original synthesizer sketches. No recordings or samples are used.
// Run: node scripts/generate-demo.cjs
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '../assets/demo');
const sampleRate = 22050;
const tau = 2 * Math.PI;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const tracks = [
  { name: 'first-light', bpm: 92, seed: 11, chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 57, 62]], melody: [76, 79, 74, 71, 72, 76, 69, 67], drums: 0.7 },
  { name: 'after-hours', bpm: 82, seed: 29, chords: [[50, 57, 60, 65], [46, 53, 57, 62], [53, 60, 64, 69], [48, 55, 62, 67]], melody: [77, 72, 69, 76, 74, 72, 65, 69], drums: 1 },
  { name: 'slow-orbit', bpm: 70, seed: 43, chords: [[45, 52, 59, 64], [41, 48, 55, 60], [48, 55, 62, 67], [43, 50, 57, 62]], melody: [76, 71, 79, 74, 72, 67, 76, 69], drums: 0.3 },
];

function render(track) {
  const beat = 60 / track.bpm;
  const duration = 12 * 4 * beat + 2;
  const mix = new Float64Array(Math.ceil(duration * sampleRate));
  const echoes = new Float64Array(mix.length);
  let seed = track.seed;
  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  }
  function note(start, length, midi, level, voice) {
    const offset = Math.floor(start * sampleRate);
    const count = Math.floor(length * sampleRate);
    const hz = frequency(midi);
    for (let i = 0; i < count && offset + i < mix.length; i++) {
      const t = i / sampleRate;
      const end = Math.min(1, (length - t) / 0.12);
      const attack = Math.min(1, t / (voice === 'pad' ? 0.3 : 0.008));
      const phase = tau * hz * t;
      const envelope = attack * end * (voice === 'pad' ? 0.7 : Math.exp(-t * (voice === 'bass' ? 3 : 4.5)));
      const wave = voice === 'pad'
        ? (Math.sin(phase) + 0.3 * Math.sin(phase * 1.002) + 0.12 * Math.sin(phase * 2)) / 1.42
        : (Math.sin(phase) + 0.22 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 3)) / 1.3;
      const sample = wave * envelope * level;
      mix[offset + i] += sample;
      if (voice === 'pluck') echoes[offset + i] += sample;
    }
  }
  function percussion(start, kind, level) {
    const offset = Math.floor(start * sampleRate);
    const length = kind === 'kick' ? 0.32 : kind === 'snare' ? 0.16 : 0.055;
    let previousNoise = 0;
    for (let i = 0; i < length * sampleRate && offset + i < mix.length; i++) {
      const t = i / sampleRate;
      const random = noise();
      const wave = kind === 'kick' ? Math.sin(tau * (46 * t + 2.6 * (1 - Math.exp(-t * 28))))
        : kind === 'snare' ? 0.65 * random + 0.35 * Math.sin(tau * 170 * t)
          : (random - previousNoise) * 0.5;
      mix[offset + i] += wave * Math.exp(-t * (kind === 'kick' ? 16 : kind === 'snare' ? 30 : 85)) * level;
      previousNoise = random;
    }
  }

  for (let bar = 0; bar < 12; bar++) {
    const chord = track.chords[bar % track.chords.length];
    const start = bar * 4 * beat;
    chord.forEach(midi => note(start, 4.3 * beat, midi + 12, 0.065, 'pad'));
    [0, 2.5].forEach(step => note(start + step * beat, 1.4 * beat, chord[0] - 12, 0.18, 'bass'));
    for (let step = 0; step < 8; step++) {
      note(start + step * beat / 2, 0.8 * beat, chord[(step * 3 + bar) % 4] + 24, 0.075, 'pluck');
      percussion(start + step * beat / 2, 'hat', (step % 2 ? 0.025 : 0.04) * track.drums);
    }
    note(start + 0.75 * beat, 1.8 * beat, track.melody[(bar * 2) % 8], 0.1, 'pluck');
    note(start + 2.75 * beat, 1.3 * beat, track.melody[(bar * 2 + 1) % 8], 0.085, 'pluck');
    [0, 2].forEach(step => percussion(start + step * beat, 'kick', 0.24 * track.drums));
    [1, 3].forEach(step => percussion(start + step * beat, 'snare', 0.075 * track.drums));
  }
  [0.75 * beat, 1.5 * beat, 2.25 * beat].forEach((delay, index) => {
    const shift = Math.floor(delay * sampleRate);
    for (let i = shift; i < mix.length; i++) mix[i] += echoes[i - shift] * 0.22 ** (index + 1);
  });
  let peak = 0;
  for (let i = 0; i < mix.length; i++) {
    mix[i] *= Math.min(1, i / (sampleRate * 0.25), (mix.length - i) / (sampleRate * 2.5));
    peak = Math.max(peak, Math.abs(mix[i]));
  }
  const wav = Buffer.alloc(44 + mix.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(mix.length * 2, 40);
  for (let i = 0; i < mix.length; i++) wav.writeInt16LE(Math.round(mix[i] / peak * 26000), 44 + i * 2);
  fs.writeFileSync(path.join(output, track.name + '.wav'), wav);
  console.log(`${track.name}: ${duration.toFixed(1)}s, ${(wav.length / 1024 / 1024).toFixed(2)} MB`);
}

fs.mkdirSync(output, { recursive: true });
tracks.forEach(render);
