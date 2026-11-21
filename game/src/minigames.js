// minigames.js — street race, vigilante, paramedic. All optional, all paid.
import { dist } from './city.js';

export function makeMinigames() {
  return {
    race: null,      // {cp, cps, rivals, t, entry, pos}
    vigilante: null, // {combo, t}
    paramedic: null, // {stage, t, patient}
  };
}
const RACE_CPS = [
  { x: 2200, y: 400 }, { x: 4000, y: 1000 }, { x: 4000, y: 2200 },
  { x: 2200, y: 2800 }, { x: 1000, y: 400 },
];
export function startRace(mg, px, py) {
  if (mg.race) return null;
  mg.race = { cp: 0, cps: RACE_CPS, t: 180, entry: 50, rivals: [0, 0, 0], falseStart: false, pos: 4 };
  return mg.race;
}
export function updateRace(mg, dt, px, py, inCar) {
  const r = mg.race;
  if (!r) return null;
  r.t -= dt;
  if (r.t <= 0) { mg.race = null; return { type: 'race-lost' }; }
  // Rivals creep along the checkpoint line.
  for (let i = 0; i < r.rivals.length; i++) r.rivals[i] += dt * (26 + i * 2);
  const target = r.cps[r.cp];
  if (dist(px, py, target.x, target.y) < 110) {
    r.cp++;
    if (r.cp >= r.cps.length) {
      const ahead = r.rivals.filter((v) => v > 5 * 60).length;
      const place = 1 + ahead;
      const prize = place === 1 ? 300 : 100;
      mg.race = null;
      return { type: 'race-done', place, prize };
    }
    return { type: 'race-cp', cp: r.cp, total: r.cps.length };
  }
  return null;
}
export function raceText(mg) {
  const r = mg.race;
  if (!r) return '';
  return `RACE CP ${r.cp}/${r.cps.length} · ${Math.ceil(r.t)}s`;
}
export function startVigilante(mg) {
  if (mg.vigilante) return null;
  mg.vigilante = { combo: 0, t: 120 };
  return mg.vigilante;
}
export function vigilanteHit(mg) {
  if (!mg.vigilante) return 0;
  mg.vigilante.combo++;
  mg.vigilante.t = 120;
  return 150 + (mg.vigilante.combo - 1) * 50;
}
export function updateVigilante(mg, dt) {
  if (!mg.vigilante) return;
  mg.vigilante.t -= dt;
  if (mg.vigilante.t <= 0) mg.vigilante = null;
}
export function startParamedic(mg, px, py) {
  if (mg.paramedic) return null;
  mg.paramedic = { stage: 'pickup', t: 90, x: 2800, y: 1000 };
  return mg.paramedic;
}
export function updateParamedic(mg, dt, px, py, hospital) {
  const pm = mg.paramedic;
  if (!pm) return null;
  pm.t -= dt;
  if (pm.t <= 0) { mg.paramedic = null; return { type: 'medic-lost' }; }
  if (pm.stage === 'pickup' && dist(px, py, pm.x, pm.y) < 90) {
    pm.stage = 'deliver'; pm.t = 90;
    return { type: 'medic-picked' };
  }
  if (pm.stage === 'deliver' && dist(px, py, hospital.x, hospital.y) < 110) {
    mg.paramedic = null;
    return { type: 'medic-done', prize: 120 };
  }
  return null;
}
export function minigameText(mg) {
  if (mg.race) return raceText(mg);
  if (mg.vigilante) return `VIGILANTE x${mg.vigilante.combo} · ${Math.ceil(mg.vigilante.t)}s`;
  if (mg.paramedic) return `PARAMEDIC ${mg.paramedic.stage === 'pickup' ? 'pick up patient' : 'to hospital'} · ${Math.ceil(mg.paramedic.t)}s`;
  return '';
}
