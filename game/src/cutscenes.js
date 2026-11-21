// cutscenes.js — briefing / debrief dialogue with typewriter delivery.
export const SPEAKERS = {
  LENA: { name: 'LENA CRUZ', color: '#ffd23a' },
  MARCO: { name: 'MARCO VENN', color: '#ff5a7a' },
  SOL: { name: 'SOL', color: '#7ad07a' },
  ADA: { name: 'ADA (LAWYER)', color: '#7dd8ff' },
  DOC: { name: 'DOC', color: '#e0e0e0' },
  RADIO: { name: 'RADIO', color: '#b07ae0' },
};
export const DIALOGS = {
  M1: {
    brief: [
      { who: 'MARCO', text: 'Lena. Two grand. You owe me. First fare pays the interest — move.' },
      { who: 'LENA', text: 'Fine. One fare. Then we talk about the rest.' },
    ],
    debrief: [{ who: 'SOL', text: 'Clean drop. You drive like you mean it, Lena.' }],
  },
  M2: {
    brief: [{ who: 'MARCO', text: 'A red coupe near the Marina road. Bring it to Sol’s garage. Don’t scratch it. Much.' }],
    debrief: [{ who: 'SOL', text: 'Coupe’s in one piece. Marco almost smiled.' }],
  },
  M3: {
    brief: [{ who: 'SOL', text: 'Package west, buyer east. Cops will notice — lose them at my garage.' }],
    debrief: [{ who: 'LENA', text: 'Heat’s off. What’s next, Sol?' }],
  },
  M4: {
    brief: [{ who: 'RADIO', text: '…police warn of a hot parcel moving through the Market district…' }],
    debrief: [{ who: 'SOL', text: 'Harbour drop done. The debt is shrinking.' }],
  },
  M5: {
    brief: [{ who: 'MARCO', text: 'The Market store keeps cash out back. Take it. Quickly.' }],
    debrief: [{ who: 'LENA', text: 'Halfway there. He can’t hold this over me forever.' }],
  },
  M6: {
    brief: [{ who: 'SOL', text: 'Last run, Lena. Docks, then my garage. After this, you’re free.' }],
    debrief: [{ who: 'MARCO', text: '…Debt’s clear. Don’t think this makes us friends.' }],
  },
  M7: {
    brief: [{ who: 'SOL', text: 'Warehouse van, full of goods. Big score, big risk. Bring it home.' }],
    debrief: [{ who: 'SOL', text: 'That van pays for a lot of silence.' }],
  },
  M8: {
    brief: [{ who: 'ADA', text: 'The evidence is in the station. Lockdown or not — get it to me.' }],
    debrief: [{ who: 'ADA', text: 'This ends Marco. You did it, Lena.' }],
  },
  M9: {
    brief: [{ who: 'MARCO', text: 'You think you can end me, Lena? Come and try.' }],
    debrief: [{ who: 'LENA', text: 'Costa Sol is mine now. King of the coast.' }],
  },
};
export function makeDialog() {
  return { queue: [], line: null, shown: 0, seen: {}, active: false, letterbox: false };
}
// Queue a mission's brief (once) then debrief lines.
export function queueDialog(d, missionId, kind) {
  const key = missionId + ':' + kind;
  if (d.seen[key]) return;
  d.seen[key] = true;
  const lines = (DIALOGS[missionId] || {})[kind] || [];
  for (const l of lines) d.queue.push(l);
  if (!d.active && d.queue.length) nextDialogLine(d);
}
export function nextDialogLine(d) {
  d.line = d.queue.shift() || null;
  d.shown = 0;
  d.active = !!d.line;
  d.letterbox = d.active;
  return d.line;
}
export function tickDialog(d, dt) {
  if (!d.line) return;
  d.shown = Math.min(d.line.text.length, d.shown + dt * 40); // 40 chars/sec typewriter
}
export function dialogDone(d) { return d.line && d.shown >= d.line.text.length; }
export function advanceDialog(d) {
  if (!d.line) return false;
  if (!dialogDone(d)) { d.shown = d.line.text.length; return true; }
  return !!nextDialogLine(d);
}
export function dialogText(d) {
  if (!d.line) return '';
  return d.line.text.slice(0, Math.floor(d.shown));
}
