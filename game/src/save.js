// save.js — localStorage save/load, version 4 schema.
export const SAVE_KEY = 'costa-sol-save-v4';
export const SAVE_VERSION = 4;
export function buildSave(s) {
  return {
    version: SAVE_VERSION,
    money: s.player.money, debt: s.player.debt, debtPaid: s.player.debtPaid,
    hp: s.player.hp, x: s.player.x, y: s.player.y,
    missionIdx: s.missions.idx, completedIds: s.missions.completedIds,
    weapons: s.player.arsenal,
    clock: s.clock.minutes, station: s.audio.station,
    packagesTaken: s.side.packagesTaken, taxiFares: s.side.taxiFares, jumpsDone: s.side.jumpsDone,
    districts: s.districts.controlled,
    dialogSeen: s.dialog.seen,
    savedAt: Date.now(),
  };
}
export function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave(s))); return true; }
  catch (e) { return false; }
}
export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.version !== SAVE_VERSION) return null;
    return d;
  } catch (e) { return null; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
export function saveSummary(d) {
  if (!d) return 'No save yet';
  return `Save: $${d.money}, debt $${d.debt}, missions done: ${(d.completedIds || []).length}`;
}
