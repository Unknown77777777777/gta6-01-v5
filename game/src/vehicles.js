// vehicles.js — car classes, driving physics, traffic AI, police pursuit.
import { WORLD_W, WORLD_H, AVENUES_X, STREETS_Y, WATER_EAST_X, WATER_SOUTH_Y, isCircleBlockedAt, nearestFreePoint, nearestRoadPoint, inWater, clamp, angleDiff, dist } from './city.js';

export const CLASSES = {
  compact: { topSpeed: 470, accel: 380, turnRate: 3.1, mass: 0.9, w: 34, h: 62, label: 'Compact' },
  sedan: { topSpeed: 560, accel: 420, turnRate: 2.6, mass: 1.2, w: 38, h: 70, label: 'Sedan' },
  sports: { topSpeed: 700, accel: 560, turnRate: 3.3, mass: 1.0, w: 36, h: 66, label: 'Sports' },
  police: { topSpeed: 700, accel: 540, turnRate: 3.0, mass: 1.5, w: 40, h: 72, label: 'Police' },
  motorcycle: { topSpeed: 640, accel: 620, turnRate: 3.8, mass: 0.5, w: 18, h: 52, label: 'Motorcycle' },
  truck: { topSpeed: 420, accel: 280, turnRate: 2.0, mass: 2.2, w: 46, h: 96, label: 'Truck' },
  van: { topSpeed: 500, accel: 340, turnRate: 2.3, mass: 1.8, w: 44, h: 84, label: 'Van' },
  ambulance: { topSpeed: 620, accel: 460, turnRate: 2.7, mass: 1.6, w: 42, h: 80, label: 'Ambulance' },
  taxi: { topSpeed: 540, accel: 420, turnRate: 2.7, mass: 1.1, w: 38, h: 70, label: 'Taxi' },
  limo: { topSpeed: 520, accel: 360, turnRate: 2.1, mass: 1.9, w: 40, h: 110, label: 'Limo' },
};
const PAINT = ['#c23a3a', '#3a6bc2', '#e0a32a', '#3aa655', '#8a4ac2', '#dfe3e8', '#22262e', '#c26a2a', '#2ab2c2', '#b23a7a'];
let carSeq = 1;
export function makeCar(city, x, y, cls, opts = {}) {
  const c = CLASSES[cls] || CLASSES.sedan;
  const free = nearestFreePoint(city, x, y, 26);
  const car = {
    id: carSeq++, cls, x: free.x, y: free.y,
    angle: opts.angle ?? (Math.random() * Math.PI * 2),
    speed: 0, hp: 100, color: opts.color || PAINT[Math.floor(Math.random() * PAINT.length)],
    parked: !!opts.parked, police: cls === 'police', mission: opts.mission || null,
    target: opts.target || null, driver: opts.driver || null,
    cruise: 0.45 + Math.random() * 0.2, node: null, stuckT: 0, lastX: free.x, lastY: free.y,
    smokeT: 0, dead: false, siren: 0, ramCooldown: 0, honkT: 0,
  };
  return car;
}
export function carDims(car) { const c = CLASSES[car.cls]; return { w: c.w, h: c.h }; }
export function classLabel(cls) { return (CLASSES[cls] || CLASSES.sedan).label; }

// Push a circle out of any building it overlaps (true circle-vs-rect resolve).
// Without this, a car that slides into a building corner can never move again:
// every attempted move stays overlapped, so all-or-nothing blocking freezes it.
export function pushOutOfBuildings(city, x, y, r) {
  for (let iter = 0; iter < 4; iter++) {
    let pushed = false;
    for (const b of city.buildings) {
      if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 < 0.01) {
        const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      } else {
        const d = Math.sqrt(d2);
        const push = (r - d) + 0.5;
        x += (dx / d) * push;
        y += (dy / d) * push;
      }
      pushed = true;
    }
    if (inWater(x, y)) {
      if (x > WATER_EAST_X) x = WATER_EAST_X - r - 1;
      if (y > WATER_SOUTH_Y) y = WATER_SOUTH_Y - r - 1;
      pushed = true;
    }
    if (!pushed) break;
  }
  return { x, y };
}
// Player driving: input {up,down,left,right,hand}. Returns skid flag.
export function driveCar(city, car, inp, dt) {
  const c = CLASSES[car.cls];
  const inSea = inWater(car.x, car.y);
  const top = inSea ? 150 : c.topSpeed;
  if (inp.up) car.speed += c.accel * dt;
  if (inp.down) car.speed -= c.accel * 0.9 * dt;
  if (!inp.up && !inp.down) car.speed *= Math.pow(0.35, dt);
  if (inp.hand) car.speed *= Math.pow(0.05, dt);
  car.speed = clamp(car.speed, -top * 0.45, top);
  const steer = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
  // A creeping car can still turn a little — otherwise a car stopped nose-first
  // into a wall can never rotate away (soft-lock).
  const spdF = clamp(0.35 + Math.abs(car.speed) / 250, 0, 1);
  const grip = inp.hand ? 0.45 : 1;
  car.angle += steer * c.turnRate * spdF * grip * dt * (car.speed < 0 ? -1 : 1);
  // Never start a frame overlapped with a building: push out first.
  const free = pushOutOfBuildings(city, car.x, car.y, 22);
  car.x = free.x; car.y = free.y;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // A car already in the water may crawl back out; a dry car may not enter it.
  const blocked = !inSea && isCircleBlockedAt(city, nx, ny, 22);
  let skid = false;
  if (!blocked) {
    car.x = clamp(nx, 50, WORLD_W - 50);
    car.y = clamp(ny, 50, WORLD_H - 50);
    if (inp.hand && Math.abs(car.speed) > 240) skid = true;
    if (Math.abs(steer) === 1 && Math.abs(car.speed) > 420) skid = true;
  } else if (!inSea && !isCircleBlockedAt(city, nx, car.y, 22)) {
    // Slide along the wall on the free axis instead of freezing.
    car.x = clamp(nx, 50, WORLD_W - 50);
    car.speed *= 0.7;
  } else if (!inSea && !isCircleBlockedAt(city, car.x, ny, 22)) {
    car.y = clamp(ny, 50, WORLD_H - 50);
    car.speed *= 0.7;
  } else {
    car.speed *= 0.4;
  }
  return skid;
}
// Simple car-vs-car soft push (keeps traffic from stacking).
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 50 * 50 && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (50 - d) / 2;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push * 0.5; a.y -= uy * push * 0.5;
        b.x += ux * push * 0.5; b.y += uy * push * 0.5;
      }
    }
  }
}
function pickNode(car, rng) {
  // Next intersection on the grid, roughly continuing straight.
  const nearX = AVENUES_X.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
  const nearY = STREETS_Y.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
  const horiz = rng() < 0.5;
  if (horiz) {
    const y = nearY;
    const xs = AVENUES_X.filter((v) => Math.abs(v - car.x) > 150);
    const x = xs[Math.floor(rng() * xs.length)];
    return { x, y };
  }
  const x = nearX;
  const ys = STREETS_Y.filter((v) => Math.abs(v - car.y) > 150);
  const y = ys[Math.floor(rng() * ys.length)];
  return { x, y };
}
export function updateTrafficCar(city, car, dt, rng) {
  if (car.parked || car.police || car.dead) return;
  const c = CLASSES[car.cls];
  if (!car.node || dist(car.x, car.y, car.node.x, car.node.y) < 70) car.node = pickNode(car, rng);
  const want = Math.atan2(car.node.y - car.y, car.node.x - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -c.turnRate * 0.8 * dt, c.turnRate * 0.8 * dt);
  const target = c.topSpeed * car.cruise;
  car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
  const pf = pushOutOfBuildings(city, car.x, car.y, 22);
  car.x = pf.x; car.y = pf.y;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!isCircleBlockedAt(city, nx, ny, 22)) { car.x = nx; car.y = ny; }
  else { car.node = pickNode(car, rng); car.speed *= 0.5; }
  // Stuck detector based on position progress, not speed alone.
  car.stuckT += dt;
  if (car.stuckT > 3) {
    if (dist(car.x, car.y, car.lastX, car.lastY) < 25) {
      car.node = pickNode(car, rng);
      const rp = nearestRoadPoint(car.x, car.y);
      car.x = rp.x; car.y = rp.y;
    }
    car.lastX = car.x; car.lastY = car.y; car.stuckT = 0;
  }
}
// Police pursuit: chase the player, ram at close range. Returns damage dealt to player car.
export function updatePoliceCar(city, car, px, py, wanted, dt, rng) {
  if (car.dead) return 0;
  const c = CLASSES.police;
  car.siren += dt * 6;
  if (wanted <= 0) {
    // Stand down: drive away slowly.
    car.speed += (120 - car.speed) * Math.min(1, dt);
    const want = Math.atan2(600 - car.y, 600 - car.x);
    car.angle += clamp(angleDiff(car.angle, want), -2 * dt, 2 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    return 0;
  }
  const d = dist(car.x, car.y, px, py);
  const aggression = 0.7 + wanted * 0.12;
  const want = Math.atan2(py - car.y, px - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -c.turnRate * aggression * dt, c.turnRate * aggression * dt);
  const top = c.topSpeed * (0.82 + wanted * 0.05);
  car.speed += (top - car.speed) * Math.min(1, dt * 1.1);
  const pf = pushOutOfBuildings(city, car.x, car.y, 22);
  car.x = pf.x; car.y = pf.y;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!isCircleBlockedAt(city, nx, ny, 22)) { car.x = nx; car.y = ny; }
  else { car.speed *= 0.5; car.angle += (rng() < 0.5 ? 1 : -1) * 1.2 * dt; }
  car.ramCooldown -= dt;
  if (d < 70 && car.ramCooldown <= 0) {
    car.ramCooldown = 1.1;
    return 6 + wanted * 2;
  }
  return 0;
}
export function damageCar(car, amount) {
  car.hp -= amount;
  if (car.hp <= 0) { car.hp = 0; car.dead = true; }
  return car.dead;
}
