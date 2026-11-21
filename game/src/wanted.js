// wanted.js — heat 0–5 stars, police response, roadblocks, spike strips, hideouts.
import { dist } from './city.js';

export function makeWanted() {
  return {
    stars: 0, heat: 0, decayT: 0,
    roadblocks: [], spikes: [],
    hideoutT: 0, lastCrimeT: 0, raidT: 0,
  };
}
export function addHeat(w, amount, now) {
  w.heat = Math.min(100, w.heat + amount);
  w.lastCrimeT = now;
  const stars = w.heat <= 0 ? 0 : w.heat < 18 ? 1 : w.heat < 36 ? 2 : w.heat < 55 ? 3 : w.heat < 78 ? 4 : 5;
  const rose = stars > w.stars;
  w.stars = stars;
  return rose;
}
export function clearWanted(w) {
  w.stars = 0; w.heat = 0; w.roadblocks = []; w.spikes = []; w.hideoutT = 0;
}
export function updateWanted(w, dt, now, px, py, inHideout, policeNear) {
  // Hideout clears heat after 3 s inside even while police still see you.
  if (inHideout && w.stars > 0) {
    w.hideoutT += dt;
    if (w.hideoutT >= 3) { clearWanted(w); return 'cleared'; }
  } else {
    w.hideoutT = 0;
  }
  if (w.stars > 0) {
    // Heat decays slowly when no police is close and no recent crime.
    if (!policeNear && now - w.lastCrimeT > 8) {
      w.decayT += dt;
      const rate = w.stars >= 4 ? 0.5 : w.stars >= 3 ? 0.9 : 1.6;
      if (w.decayT > 2) {
        w.heat = Math.max(0, w.heat - rate * w.decayT);
        w.decayT = 0;
        w.stars = w.heat <= 0 ? 0 : w.heat < 18 ? 1 : w.heat < 36 ? 2 : w.heat < 55 ? 3 : w.heat < 78 ? 4 : 5;
        if (w.stars === 0) { w.roadblocks = []; w.spikes = []; return 'cleared'; }
      }
    } else w.decayT = 0;
  }
  return null;
}
// Roadblocks at >=3 stars, spike strips at >=4: placed ahead on the player's road.
export function ensureBarriers(w, px, py, angle, rng) {
  if (w.stars >= 3 && w.roadblocks.length < 2) {
    const d = 500 + rng() * 300;
    w.roadblocks.push({ x: px + Math.cos(angle) * d, y: py + Math.sin(angle) * d, angle, t: 30 });
  }
  if (w.stars >= 4 && w.spikes.length < 2) {
    const d = 420 + rng() * 260;
    w.spikes.push({ x: px + Math.cos(angle) * d, y: py + Math.sin(angle) * d, angle, t: 25 });
  }
  for (const b of w.roadblocks) b.t -= 1 / 60;
  for (const s of w.spikes) s.t -= 1 / 60;
  w.roadblocks = w.roadblocks.filter((b) => b.t > 0);
  w.spikes = w.spikes.filter((s) => s.t > 0);
}
export function hitSpike(px, py, w) {
  for (const s of w.spikes) {
    if (dist(px, py, s.x, s.y) < 46) return true;
  }
  return false;
}
export function wantedLabel(w) { return '★'.repeat(w.stars) + '☆'.repeat(5 - w.stars); }
