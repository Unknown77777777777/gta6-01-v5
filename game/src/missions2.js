// missions2.js — story M7–M9: van heist, police-station evidence run, Marco showdown.
import { nearestFreePoint, nearestRoadPoint, dist, isCircleBlockedAt, AVENUES_X, STREETS_Y } from './city.js';

export const MISSION2_DEFS = [
  {
    id: 'M7', name: 'The Big Score', reward: 400, timeLimit: 240,
    brief: 'A van full of goods sits at the warehouse. Steal it and bring it to Sol’s garage.',
    steps: [
      { type: 'steal', carKind: 'van', x: 4500, y: 1800, label: 'Steal the warehouse van' },
      { type: 'deliver', x: 3400, y: 2400, r: 120, label: 'Deliver the van to Sol’s Garage' },
    ],
  },
  {
    id: 'M8', name: 'Heat Wave', reward: 600, timeLimit: 150,
    brief: 'Evidence against Marco sits in the police station. Grab it during the lockdown and take it to the lawyer.',
    steps: [
      { type: 'hold', x: 1400, y: 400, r: 90, secs: 5, label: 'Hold E at the station to grab the evidence' },
      { type: 'deliver', x: 4500, y: 600, r: 120, needCar: false, label: 'Take the evidence to the lawyer' },
    ],
  },
  {
    id: 'M9', name: 'King of Costa Sol', reward: 1000, timeLimit: 120,
    brief: 'Marco himself. Ram his sedan until it burns, then walk to the plaza point and press E to end it.',
    steps: [
      { type: 'ram', label: 'Ram Marco’s sedan until it is wrecked' },
      { type: 'final', x: 2200, y: 1600, r: 90, label: 'Walk to the plaza point and press E' },
    ],
  },
];
export function allMissions(m1) { return [...m1, ...MISSION2_DEFS]; }
export function totalStoryRewardAll() {
  return 190 + 200 + 300 + 350 + 500 + 800 + 400 + 600 + 1000;
}
// M9: the final walk-up point MUST be clamped to a spot reachable on foot.
// The sedan may die on a map margin strip or inside a block; the final point
// is therefore snapped to the nearest road point, then to a free circle.
export function finalPointFor(city) {
  const road = nearestRoadPoint(2200, 1600);
  return nearestFreePoint(city, road.x, road.y, 16);
}
export function makeMarcoSedan(city, px, py) {
  // Spawn Marco's sedan on the road near the player, never inside a block.
  const road = nearestRoadPoint(px + 300, py);
  const free = nearestFreePoint(city, road.x, road.y, 26);
  return { x: free.x, y: free.y, hp: 80, maxHp: 80, cooldown: 0 };
}
export function updateMarcoSedan(city, sedan, px, py, dt, rng) {
  // Rubber-band: too far away it closes in, too close it pulls away a little.
  // The sedan stays on land: it never enters buildings, water, or the map
  // margin strips (otherwise the player cannot reach it to ram it).
  const d = dist(sedan.x, sedan.y, px, py);
  const want = Math.atan2(py - sedan.y, px - sedan.x);
  let speed = 0;
  if (d > 560) speed = 430;
  else if (d > 380) speed = 300;
  else speed = 140;
  const dir = d > 420 ? 1 : -0.4;
  const nx = sedan.x + Math.cos(want) * speed * dt * dir;
  const ny = sedan.y + Math.sin(want) * speed * dt * dir;
  const cx = Math.max(400, Math.min(4000, nx));
  const cy = Math.max(400, Math.min(3000, ny));
  // Marco stays on the road network: if the move would leave him deep inside
  // a block (where the player cannot manoeuvre to ram him), snap to the
  // nearest road point instead.
  let mx = cx, my = cy;
  const nearAve = AVENUES_X.reduce((a, b) => Math.abs(b - cx) < Math.abs(a - cx) ? b : a);
  const nearSt = STREETS_Y.reduce((a, b) => Math.abs(b - cy) < Math.abs(a - cy) ? b : a);
  if (Math.abs(nearAve - cx) > 90 && Math.abs(nearSt - cy) > 90) {
    const rp = nearestRoadPoint(cx, cy);
    mx = rp.x; my = rp.y;
  }
  // Slide along walls instead of freezing: try the full move, then each axis.
  if (!isCircleBlockedAt(city, mx, my, 24)) { sedan.x = mx; sedan.y = my; }
  else if (!isCircleBlockedAt(city, mx, sedan.y, 24)) { sedan.x = mx; }
  else if (!isCircleBlockedAt(city, sedan.x, my, 24)) { sedan.y = my; }
  sedan.cooldown -= dt;
  return d;
}
export function ramMarco(sedan, carSpeed) {
  if (sedan.cooldown > 0) return 0;
  if (carSpeed < 100) return 0;
  sedan.cooldown = 0.6;
  const dmg = 12;
  sedan.hp = Math.max(0, sedan.hp - dmg);
  return dmg;
}
