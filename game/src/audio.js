// audio.js — procedural WebAudio: engine hum, 3 radio stations, SFX. No audio files.
export const STATIONS = [
  { name: 'COSTA SYNTHWAVE', bpm: 116, scale: [0, 3, 5, 7, 10], wave: 'sawtooth', bass: 55 },
  { name: 'HARBOR LO-FI', bpm: 72, scale: [0, 2, 4, 7, 9], wave: 'sine', bass: 65 },
  { name: 'POLICE SCANNER', bpm: 90, scale: [0, 5, 7], wave: 'square', bass: 80 },
];
export function makeAudio() {
  return {
    ctx: null, master: null, radioGain: null, engineOsc: null, engineGain: null,
    station: 0, radioOn: false, nextNoteT: 0, step: 0, muted: false,
  };
}
export function ensureAudio(a) {
  if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    a.ctx = new AC();
    a.master = a.ctx.createGain(); a.master.gain.value = 0.5; a.master.connect(a.ctx.destination);
    a.radioGain = a.ctx.createGain(); a.radioGain.gain.value = 0.12; a.radioGain.connect(a.master);
    a.engineGain = a.ctx.createGain(); a.engineGain.gain.value = 0; a.engineGain.connect(a.master);
    a.engineOsc = a.ctx.createOscillator(); a.engineOsc.type = 'sawtooth'; a.engineOsc.frequency.value = 55;
    a.engineOsc.connect(a.engineGain); a.engineOsc.start();
  } catch (e) { a.ctx = null; }
}
function blip(a, freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(a.master);
  o.start(t); o.stop(t + dur + 0.02);
}
export function sfx(a, name) {
  if (!a.ctx || a.muted) return;
  switch (name) {
    case 'shot': blip(a, 180, 0.12, 'square', 0.3); blip(a, 90, 0.18, 'sawtooth', 0.2); break;
    case 'shotgun': blip(a, 120, 0.25, 'square', 0.35); blip(a, 60, 0.3, 'sawtooth', 0.25); break;
    case 'smg': blip(a, 220, 0.07, 'square', 0.2); break;
    case 'rifle': blip(a, 140, 0.3, 'square', 0.35); break;
    case 'dryFire': blip(a, 900, 0.05, 'square', 0.12); break;
    case 'reload': blip(a, 500, 0.08, 'sine', 0.15); blip(a, 700, 0.08, 'sine', 0.15, 0.12); break;
    case 'cash': blip(a, 880, 0.12, 'sine', 0.2); blip(a, 1320, 0.2, 'sine', 0.2, 0.1); break;
    case 'mission': [523, 659, 784, 1046].forEach((f, i) => blip(a, f, 0.18, 'sine', 0.22, i * 0.12)); break;
    case 'fail': [400, 300, 200].forEach((f, i) => blip(a, f, 0.25, 'sawtooth', 0.15, i * 0.15)); break;
    case 'crash': blip(a, 70, 0.3, 'sawtooth', 0.3); break;
    case 'explosion': blip(a, 50, 0.8, 'sawtooth', 0.4); blip(a, 35, 1.0, 'sine', 0.35, 0.05); break;
    case 'siren': blip(a, 700, 0.4, 'sine', 0.06); blip(a, 950, 0.4, 'sine', 0.06, 0.4); break;
    case 'pickup': blip(a, 660, 0.1, 'sine', 0.2); blip(a, 990, 0.15, 'sine', 0.2, 0.08); break;
    case 'jumpWhoosh': blip(a, 300, 0.4, 'sine', 0.15); break;
    case 'taxiBlip': blip(a, 1100, 0.08, 'square', 0.12); break;
    case 'raceBeep': blip(a, 1000, 0.12, 'square', 0.2); break;
    case 'raceWin': [660, 880, 1100].forEach((f, i) => blip(a, f, 0.2, 'sine', 0.2, i * 0.12)); break;
    case 'phaseSting': blip(a, 440, 0.3, 'triangle', 0.18); blip(a, 554, 0.3, 'triangle', 0.18, 0.15); break;
    case 'vigilanteBlip': blip(a, 1500, 0.06, 'square', 0.12); break;
    case 'dialogBlip': blip(a, 1200, 0.04, 'sine', 0.08); break;
    case 'districtChime': blip(a, 784, 0.2, 'sine', 0.15); blip(a, 1046, 0.25, 'sine', 0.15, 0.1); break;
    case 'ambulanceBlip': blip(a, 800, 0.15, 'sine', 0.12); blip(a, 600, 0.15, 'sine', 0.12, 0.15); break;
    case 'door': blip(a, 200, 0.08, 'square', 0.12); break;
    default: break;
  }
}
export function setEngine(a, speed, inCar) {
  if (!a.ctx) return;
  const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) / 5000) : 0;
  a.engineGain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.1);
  a.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.12, a.ctx.currentTime, 0.1);
}
export function setRadio(a, on, station) {
  a.radioOn = on;
  if (station !== undefined) a.station = station;
  if (a.radioGain) a.radioGain.gain.value = on ? 0.12 : 0;
}
export function cycleStation(a) {
  a.station = (a.station + 1) % STATIONS.length;
  return STATIONS[a.station].name;
}
// Tiny step sequencer: one note per beat subdivision while the radio is on.
export function tickRadio(a, dt) {
  if (!a.ctx || !a.radioOn) return;
  a.nextNoteT -= dt;
  if (a.nextNoteT > 0) return;
  const st = STATIONS[a.station];
  const beat = 60 / st.bpm / 2;
  a.nextNoteT = beat;
  const scale = st.scale;
  const deg = scale[a.step % scale.length] + 12 * Math.floor((a.step % 16) / 8);
  const freq = st.bass * 4 * Math.pow(2, deg / 12);
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = st.wave; o.frequency.value = freq;
  g.gain.setValueAtTime(0.10, a.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + beat * 0.9);
  o.connect(g); g.connect(a.radioGain);
  o.start(); o.stop(a.ctx.currentTime + beat);
  if (a.step % 4 === 0) {
    const b = a.ctx.createOscillator(), bg = a.ctx.createGain();
    b.type = 'sine'; b.frequency.value = st.bass;
    bg.gain.setValueAtTime(0.12, a.ctx.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + beat * 1.8);
    b.connect(bg); bg.connect(a.radioGain);
    b.start(); b.stop(a.ctx.currentTime + beat * 2);
  }
  a.step++;
}
