// side.js — optional side work: taxi fares, hidden packages, stunt jumps.
import { dist } from './city.js';

export function makeSide() {
  return {
    packagesTaken: 0, taxiFares: 0, jumpsDone: 0,
    taxi: null, // {ped, destStand, t, fare}
    jumpCooldown: 0, jumpComboT: 0, jumpCombo: 0,
    vip: false,
  };
}
export function taxiStands(city) {
  return [
    { id: 'A', x: city.landmarks.taxiStandA.x, y: city.landmarks.taxiStandA.y },
    { id: 'B', x: city.landmarks.taxiStandB.x, y: city.landmarks.taxiStandB.y },
    { id: 'C', x: city.landmarks.taxiStandC.x, y: city.landmarks.taxiStandC.y },
  ];
}
export function nearestStand(city, x, y) {
  let best = null, bd = Infinity;
  for (const s of taxiStands(city)) {
    const d = dist(x, y, s.x, s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return { stand: best, d: bd };
}
// Called when the player presses E near a waiting taxi ped while in a car.
export function tryStartTaxi(side, ped, px, py, city, nightBonus) {
  if (side.taxi) return null;
  const dests = taxiStands(city).filter((s) => dist(s.x, s.y, px, py) > 300);
  const dest = dests[Math.floor(Math.random() * dests.length)];
  const fare = 60 + Math.round(dist(px, py, dest.x, dest.y) / 40) + (nightBonus > 1 ? 10 : 0);
  side.taxi = { ped, dest, t: 150, fare, vip: Math.random() < 0.15 };
  if (side.taxi.vip) side.taxi.fare *= 2;
  return side.taxi;
}
export function updateSide(side, dt, px, py, inCar, onArrive) {
  if (side.jumpCooldown > 0) side.jumpCooldown -= dt;
  if (side.jumpComboT > 0) { side.jumpComboT -= dt; if (side.jumpComboT <= 0) side.jumpCombo = 0; }
  if (!side.taxi) return null;
  side.taxi.t -= dt;
  if (side.taxi.t <= 0) { const lost = side.taxi; side.taxi = null; return { type: 'taxi-timeout', fare: lost.fare }; }
  if (dist(px, py, side.taxi.dest.x, side.taxi.dest.y) < 90) {
    const fare = side.taxi.fare + (side.taxi.t > 90 ? 20 : 0);
    side.taxi = null; side.taxiFares++;
    if (onArrive) onArrive(fare);
    return { type: 'taxi-done', fare };
  }
  return null;
}
export function checkPackages(side, city, px, py) {
  for (const spot of city.packageSpots) {
    if (!spot.taken && dist(px, py, spot.x, spot.y) < 46) {
      spot.taken = true; side.packagesTaken++;
      return { x: spot.x, y: spot.y, amount: 25 };
    }
  }
  return null;
}
export function checkJump(side, px, py, speed, city) {
  if (side.jumpCooldown > 0) return null;
  for (const ramp of city.jumpRamps) {
    if (dist(px, py, ramp.x, ramp.y) < 60 && Math.abs(speed) > 420) {
      side.jumpCooldown = 6;
      side.jumpCombo++;
      side.jumpComboT = 8;
      const bonus = side.jumpCombo > 1 ? 25 : 0;
      side.jumpsDone++;
      return { amount: 50 + bonus, combo: side.jumpCombo };
    }
  }
  return null;
}
export function sideStatusText(side) {
  const parts = [];
  if (side.packagesTaken) parts.push(`Packages ${side.packagesTaken}/8`);
  if (side.taxiFares) parts.push(`Fares ${side.taxiFares}`);
  if (side.jumpsDone) parts.push(`Jumps ${side.jumpsDone}`);
  if (side.taxi) parts.push(`TAXI ${Math.ceil(side.taxi.t)}s`);
  return parts.join(' · ');
}
