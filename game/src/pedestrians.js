// pedestrians.js — walkers, beach strollers, taxi waiters, special NPCs.
import { AVENUES_X, STREETS_Y, isCircleBlockedAt, nearestFreePoint, dist, clamp } from './city.js';

const NAMES = ['Rosa', 'Ben', 'Mia', 'Leo', 'Ana', 'Kai', 'Nina', 'Omar', 'Ivy', 'Sam'];
const SHIRTS = ['#e05a5a', '#5aa7e0', '#e0c25a', '#7ad07a', '#b07ae0', '#e08ab0', '#5ad0c0', '#e0e0e0'];
let pedSeq = 1;
export function makePed(city, x, y, kind = 'walker') {
  const free = nearestFreePoint(city, x, y, 12);
  return {
    id: pedSeq++, kind, x: free.x, y: free.y,
    angle: Math.random() * Math.PI * 2, speed: 26 + Math.random() * 30,
    tx: free.x, ty: free.y, wait: 0, hp: 30, dead: false,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    pace: 0, stride: 2 + Math.random() * 2, flee: 0, tag: null,
    stand: null, // taxi stand id when waiting
  };
}
export function createWaitingPed(city, x, y, stand) {
  const p = makePed(city, x, y, 'waiting');
  p.stand = stand; p.speed = 0; p.tag = 'TAXI';
  return p;
}
export function spawnSpecialPeds(city, list) {
  // list: [{kind, x, y, tag}] — racers, gang, lawyer, paramedic...
  return list.map((s) => {
    const p = makePed(city, s.x, s.y, s.kind);
    p.tag = s.tag || null;
    p.speed = s.kind === 'racer' ? 60 : p.speed;
    return p;
  });
}
function pickWanderTarget(p, rng, beach) {
  if (beach) {
    p.tx = 200 + rng() * 4200;
    p.ty = 3300 + rng() * 120; // stay on the sand
    return;
  }
  // Wander along the nearest road, on the sidewalk.
  const nearX = AVENUES_X.reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a);
  const nearY = STREETS_Y.reduce((a, b) => Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a);
  if (rng() < 0.5) { p.tx = clamp(p.x + (rng() - 0.5) * 700, 80, 4600); p.ty = nearY + (rng() < 0.5 ? -70 : 70); }
  else { p.ty = clamp(p.y + (rng() - 0.5) * 700, 80, 3200); p.tx = nearX + (rng() < 0.5 ? -70 : 70); }
}
export function updatePed(city, p, dt, rng, danger) {
  if (p.dead) return;
  p.pace += dt * p.stride;
  if (p.kind === 'waiting') return; // stands and waves
  if (danger && dist(p.x, p.y, danger.x, danger.y) < 260) p.flee = 1.2;
  if (p.flee > 0) {
    p.flee -= dt;
    const away = Math.atan2(p.y - danger.y, p.x - danger.x);
    p.angle = away;
    const nx = p.x + Math.cos(away) * 95 * dt, ny = p.y + Math.sin(away) * 95 * dt;
    if (!isCircleBlockedAt(city, nx, ny, 10)) { p.x = nx; p.y = ny; }
    return;
  }
  if (p.wait > 0) { p.wait -= dt; return; }
  if (dist(p.x, p.y, p.tx, p.ty) < 24) {
    if (rng() < 0.4) { p.wait = 1 + rng() * 4; return; }
    pickWanderTarget(p, rng, p.kind === 'beach');
  }
  const want = Math.atan2(p.ty - p.y, p.tx - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  p.angle += clamp(diff, -4 * dt, 4 * dt);
  const nx = p.x + Math.cos(p.angle) * p.speed * dt;
  const ny = p.y + Math.sin(p.angle) * p.speed * dt;
  if (!isCircleBlockedAt(city, nx, ny, 10)) { p.x = nx; p.y = ny; }
  else pickWanderTarget(p, rng, p.kind === 'beach');
}
export function damagePed(p, amount) {
  p.hp -= amount;
  if (p.hp <= 0) { p.dead = true; p.hp = 0; }
  return p.dead;
}
