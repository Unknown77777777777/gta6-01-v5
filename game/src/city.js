// city.js — Costa Sol map data: roads, blocks, buildings, water, landmarks.
// All geometry is generated here from a seed; no art assets, everything procedural.
export const WORLD_W = 4800;
export const WORLD_H = 3600;
export const ROAD_HALF = 58;

// Avenue / street centre lines. Intersections of these form the drivable grid.
export const AVENUES_X = [400, 1000, 1600, 2200, 2800, 3400, 4000, 4500];
export const STREETS_Y = [400, 1000, 1600, 2200, 2800, 3200];

export const WATER_EAST_X = 4620;   // sea east of here
export const SAND_Y = 3260;         // beach sand starts
export const WATER_SOUTH_Y = 3430;  // sea south of here

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ['#3a4a6b', '#2e3d5c', '#46587a'], // downtown blue-grey
  ['#6b4a3a', '#5c4030', '#7a5a46'], // brick
  ['#4a6b4a', '#3d5c40', '#587a58'], // green tint
  ['#6b5a8a', '#5c4d78', '#7a6a9a'], // purple neon district
  ['#8a6b4a', '#785c3d', '#9a7a58'], // sandstone
];

export function buildCity(seed = 7) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const plazas = [];
  const streetlamps = [];
  // Blocks: cells between neighbouring avenues/streets.
  const xs = [60, ...AVENUES_X, WORLD_W - 60];
  const ys = [60, ...STREETS_Y, WORLD_H - 60];
  let bi = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + ROAD_HALF + 14, x1 = xs[i + 1] - ROAD_HALF - 14;
      const y0 = ys[j] + ROAD_HALF + 14, y1 = ys[j + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 120 || y1 - y0 < 120) continue;
      if (x0 > WATER_EAST_X - 100) continue;      // sea strip has no blocks
      if (y0 > SAND_Y - 40) continue;             // beach has no blocks
      const roll = rng();
      if (roll < 0.12) { // park
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: 4 + Math.floor(rng() * 5) });
        continue;
      }
      if (roll < 0.17) { // plaza
        plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const pal = PALETTES[Math.floor(rng() * PALETTES.length)];
      const twin = rng() < 0.3;
      const bw = (x1 - x0) * (twin ? 0.44 : 0.8);
      const bh = (y1 - y0) * (twin ? 0.44 : 0.72);
      const mk = (bx, by) => {
        const hgt = 26 + Math.floor(rng() * 46);
        const col = pal[Math.floor(rng() * pal.length)];
        buildings.push({
          x: bx, y: by, w: bw, h: bh, hgt,
          cx: bx + bw / 2, cy: by + bh / 2,
          color: col, seed: Math.floor(rng() * 10000),
          neon: rng() < 0.25, helipad: hgt >= 58 && rng() < 0.4,
          id: bi++,
        });
      };
      if (twin) {
        mk(x0, y0);
        mk(x1 - bw, y1 - bh);
      } else {
        mk(x0 + (x1 - x0 - bw) / 2, y0 + (y1 - y0 - bh) / 2);
      }
    }
  }
  // Street lamps along the main avenues.
  for (const ax of AVENUES_X) {
    for (const sy of STREETS_Y) {
      if (rng() < 0.7) streetlamps.push({ x: ax + ROAD_HALF + 12, y: sy + 30 });
      if (rng() < 0.7) streetlamps.push({ x: ax - ROAD_HALF - 12, y: sy - 30 });
    }
  }
  // Named landmarks (all on or next to roads, verified free by nearestFreePoint at use).
  const landmarks = {
    spawn: { x: 500, y: 500 },
    solGarage: { x: 3400, y: 2400 },      // hideout / Sol's garage (near intersection 3400,2200+)
    hideout: { x: 3400, y: 2400 },
    policeStation: { x: 1400, y: 400 },
    warehouse: { x: 4500, y: 1800 },
    lawyerOffice: { x: 4500, y: 600 },
    hospital: { x: 1000, y: 2800 },
    store: { x: 1800, y: 1600 },
    marina: { x: 4500, y: 3000 },
    plaza: { x: 2200, y: 1600 },
    raceStart: { x: 1000, y: 400 },
    taxiStandA: { x: 600, y: 1000 },
    taxiStandB: { x: 4000, y: 2200 },
    taxiStandC: { x: 1600, y: 3200 },
  };
  const packageSpots = [
    { x: 700, y: 1000 }, { x: 2500, y: 1000 }, { x: 4100, y: 1000 },
    { x: 1300, y: 2200 }, { x: 3100, y: 3200 }, { x: 4300, y: 2200 },
    { x: 1900, y: 3200 }, { x: 3700, y: 1000 },
  ].map((p) => ({ ...p, taken: false }));
  const jumpRamps = [
    { x: 1600, y: 1000, dir: 0 }, { x: 3400, y: 1600, dir: 0 }, { x: 2200, y: 2800, dir: 0 },
  ];
  const weaponPickups = [
    { x: 1200, y: 1000, kind: 'shotgun', taken: false },
    { x: 2800, y: 2200, kind: 'smg', taken: false },
    { x: 4000, y: 1000, kind: 'rifle', taken: false },
    { x: 2200, y: 2800, kind: 'shotgun', taken: false },
  ];
  return { buildings, parks, plazas, streetlamps, landmarks, packageSpots, jumpRamps, weaponPickups, rng };
}

// ---- collision helpers (true circle tests; rect test alone misjudges corners) ----
export function inWater(x, y) {
  return x > WATER_EAST_X || y > WATER_SOUTH_Y;
}
export function inSand(x, y) {
  return y >= SAND_Y && y <= WATER_SOUTH_Y && x <= WATER_EAST_X;
}
function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}
export function isCircleBlockedAt(city, x, y, r) {
  if (x < 40 + r || y < 40 + r || x > WORLD_W - 40 - r || y > WORLD_H - 40 - r) return true;
  if (inWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + r < b.x - 4 || x - r > b.x + b.w + 4 || y + r < b.y - 4 || y - r > b.y + b.h + 4) continue;
    if (circleHitsRect(x, y, r, b)) return true;
  }
  return false;
}
// Old-style point test kept for cheap checks (cars on roads etc).
export function isBlockedAt(city, x, y) {
  if (x < 40 || y < 40 || x > WORLD_W - 40 || y > WORLD_H - 40) return true;
  if (inWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}
// Find the nearest point that is free for a circle of radius r. Spiral search.
export function nearestFreePoint(city, x, y, r = 16) {
  if (!isCircleBlockedAt(city, x, y, r)) return { x, y };
  for (let dist = 24; dist <= 900; dist += 24) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = x + Math.cos(ang) * dist, py = y + Math.sin(ang) * dist;
      if (!isCircleBlockedAt(city, px, py, r)) return { x: px, y: py };
    }
  }
  // Last resort: nearest road point (roads are always free).
  return nearestRoadPoint(x, y);
}
export function nearestRoadPoint(x, y) {
  let bx = AVENUES_X[0], bd = Infinity;
  for (const ax of AVENUES_X) { const d = Math.abs(ax - x); if (d < bd) { bd = d; bx = ax; } }
  let by = STREETS_Y[0], bd2 = Infinity;
  for (const sy of STREETS_Y) { const d = Math.abs(sy - y); if (d < bd2) { bd2 = d; by = sy; } }
  if (bd <= bd2) return { x: bx, y: Math.max(80, Math.min(WORLD_H - 80, y)) };
  return { x: Math.max(80, Math.min(WORLD_W - 80, x)), y: by };
}
export function nearestLandmark(city, x, y, name) {
  const l = city.landmarks[name];
  if (!l) return { x, y };
  return nearestFreePoint(city, l.x, l.y, 18);
}
export function onRoad(x, y) {
  for (const ax of AVENUES_X) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const sy of STREETS_Y) if (Math.abs(y - sy) <= ROAD_HALF) return true;
  return false;
}
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
