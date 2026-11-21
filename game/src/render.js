// render.js — 2.5D neo-noir renderer: baked static tiles, extruded roofs, lighting.
import { WORLD_W, WORLD_H, AVENUES_X, STREETS_Y, WATER_EAST_X, SAND_Y, WATER_SOUTH_Y, ROAD_HALF, dist } from './city.js';
import { CLASSES } from './vehicles.js';

const TILE = 600;
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
function makeGlowSprite(color, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
// Bake ground/roads/blocks/parks into offscreen tiles once at init.
export function buildStaticLayer(city) {
  const cols = Math.ceil(WORLD_W / TILE), rows = Math.ceil(WORLD_H / TILE);
  const tiles = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const c = document.createElement('canvas');
      c.width = TILE; c.height = TILE;
      const g = c.getContext('2d');
      const ox = tx * TILE, oy = ty * TILE;
      g.fillStyle = '#2c2f38'; g.fillRect(0, 0, TILE, TILE);
      // Sand + sea
      g.fillStyle = '#c2a878';
      g.fillRect(Math.max(0, -ox), Math.max(0, SAND_Y - oy), TILE, TILE);
      g.fillStyle = '#1d4a6b';
      if (WATER_SOUTH_Y - oy < TILE) g.fillRect(0, Math.max(0, WATER_SOUTH_Y - oy), TILE, Math.min(TILE, TILE - Math.max(0, WATER_SOUTH_Y - oy)));
      if (WATER_EAST_X - ox < TILE) g.fillRect(Math.max(0, WATER_EAST_X - ox), 0, TILE, TILE);
      // Asphalt texture speckles
      g.fillStyle = 'rgba(255,255,255,0.03)';
      let seed = tx * 31 + ty * 17;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < 90; i++) g.fillRect(rnd() * TILE, rnd() * TILE, 3, 3);
      // Parks and plazas
      for (const p of city.parks) {
        g.fillStyle = '#2e5a34';
        g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
      }
      for (const p of city.plazas) {
        g.fillStyle = '#4a4a52';
        g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
      }
      // Roads
      g.fillStyle = '#3d4048';
      for (const ax of AVENUES_X) g.fillRect(ax - ROAD_HALF - ox, -oy, ROAD_HALF * 2, TILE);
      for (const sy of STREETS_Y) g.fillRect(-ox, sy - ROAD_HALF - oy, TILE, ROAD_HALF * 2);
      // Centre dashes
      g.fillStyle = '#d8c25a';
      for (const ax of AVENUES_X) {
        for (let y = 0; y < TILE; y += 46) g.fillRect(ax - 2 - ox, y - oy, 4, 24);
      }
      for (const sy of STREETS_Y) {
        for (let x = 0; x < TILE; x += 46) g.fillRect(x - ox, sy - 2 - oy, 24, 4);
      }
      // Zebra crossings at intersections
      g.fillStyle = 'rgba(230,230,230,0.75)';
      for (const ax of AVENUES_X) for (const sy of STREETS_Y) {
        for (let i = -3; i <= 3; i++) g.fillRect(ax + i * 14 - 5 - ox, sy - ROAD_HALF + 6 - oy, 8, 16);
      }
      // Sidewalk kerbs
      g.strokeStyle = 'rgba(200,200,200,0.25)'; g.lineWidth = 3;
      for (const ax of AVENUES_X) {
        g.beginPath(); g.moveTo(ax - ROAD_HALF - ox, -oy); g.lineTo(ax - ROAD_HALF - ox, TILE - oy); g.stroke();
        g.beginPath(); g.moveTo(ax + ROAD_HALF - ox, -oy); g.lineTo(ax + ROAD_HALF - ox, TILE - oy); g.stroke();
      }
      tiles.push({ x: ox, y: oy, canvas: c });
    }
  }
  return tiles;
}
export function makeSprites() {
  return {
    glowWhite: makeGlowSprite('rgba(255,240,200,0.55)'),
    glowRed: makeGlowSprite('rgba(255,40,60,0.7)'),
    glowBlue: makeGlowSprite('rgba(40,90,255,0.7)'),
    glowWarm: makeGlowSprite('rgba(255,180,90,0.5)'),
  };
}
export function drawWorld(ctx, s, cam, vw, vh) {
  const city = s.city;
  // Static tiles
  const tx0 = Math.max(0, Math.floor(cam.x / TILE)), tx1 = Math.min(Math.ceil(WORLD_W / TILE) - 1, Math.floor((cam.x + vw) / TILE));
  const ty0 = Math.max(0, Math.floor(cam.y / TILE)), ty1 = Math.min(Math.ceil(WORLD_H / TILE) - 1, Math.floor((cam.y + vh) / TILE));
  const cols = Math.ceil(WORLD_W / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = s.tiles[ty * cols + tx];
      if (t) ctx.drawImage(t.canvas, t.x - cam.x, t.y - cam.y);
    }
  }
  // Animated surf line on the beach
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  const waveY = WATER_SOUTH_Y - 6 + Math.sin(s.time * 1.4) * 4;
  ctx.beginPath(); ctx.moveTo(-cam.x, waveY - cam.y); ctx.lineTo(WORLD_W - cam.x, waveY - cam.y); ctx.stroke();
  // Buildings: 2.5D extruded roofs, parallax from camera centre. Frustum-culled.
  const ccx = cam.x + vw / 2, ccy = cam.y + vh / 2;
  const PF = 0.14;
  for (const b of city.buildings) {
    if (b.x + b.w < cam.x - 300 || b.x > cam.x + vw + 300 || b.y + b.h < cam.y - 300 || b.y > cam.y + vh + 300) continue;
    const rx = b.x + (b.cx - ccx) * PF, ry = b.y + (b.cy - ccy) * PF;
    const rw = b.w, rh = b.h;
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x - cam.x + 6, b.y - cam.y + 8, b.w, b.h);
    // Walls: connect base corners to roof corners with dark gradients
    ctx.fillStyle = shade(b.color, -38);
    ctx.beginPath();
    ctx.moveTo(b.x - cam.x, b.y + b.h - cam.y);
    ctx.lineTo(rx - cam.x, ry + rh - cam.y);
    ctx.lineTo(rx + rw - cam.x, ry + rh - cam.y);
    ctx.lineTo(b.x + b.w - cam.x, b.y + b.h - cam.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(b.color, -22);
    ctx.beginPath();
    ctx.moveTo(b.x + b.w - cam.x, b.y - cam.y);
    ctx.lineTo(rx + rw - cam.x, ry - cam.y);
    ctx.lineTo(rx + rw - cam.x, ry + rh - cam.y);
    ctx.lineTo(b.x + b.w - cam.x, b.y + b.h - cam.y);
    ctx.closePath(); ctx.fill();
    // Roof
    ctx.fillStyle = b.color;
    ctx.fillRect(rx - cam.x, ry - cam.y, rw, rh);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    ctx.strokeRect(rx - cam.x, ry - cam.y, rw, rh);
    // Procedural roof detail: AC units, skylights, helipad, neon strip
    const sd = b.seed;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(rx - cam.x + 10 + (sd % 30), ry - cam.y + 10 + (sd % 20), 18, 12);
    ctx.fillRect(rx - cam.x + rw - 34, ry - cam.y + rh - 26, 20, 12);
    if (b.helipad) {
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx - cam.x + rw / 2, ry - cam.y + rh / 2, Math.min(rw, rh) / 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('H', rx - cam.x + rw / 2, ry - cam.y + rh / 2 + 6);
    }
    if (b.neon) {
      ctx.fillStyle = '#ff5ad2';
      ctx.fillRect(rx - cam.x + 6, ry - cam.y + rh - 8, rw - 12, 4);
    }
  }
  // Trees in parks
  ctx.fillStyle = '#2e7a3a';
  for (const p of city.parks) {
    if (p.x > cam.x + vw + 100 || p.x + p.w < cam.x - 100 || p.y > cam.y + vh + 100 || p.y + p.h < cam.y - 100) continue;
    for (let i = 0; i < p.trees; i++) {
      const txp = p.x + ((i * 67) % Math.max(40, p.w - 20)) + 10;
      const typ = p.y + ((i * 43) % Math.max(40, p.h - 20)) + 10;
      ctx.beginPath(); ctx.arc(txp - cam.x, typ - cam.y, 12, 0, Math.PI * 2); ctx.fill();
    }
  }
}
export function drawCar(ctx, car, cam, sprites, phase, time) {
  const c = CLASSES[car.cls];
  const sx = car.x - cam.x, sy = car.y - cam.y;
  if (sx < -120 || sy < -120 || sx > cam.w + 120 || sy > cam.h + 120) return;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx + 4, sy + 6, c.w * 0.62, c.h * 0.42, car.angle, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(car.angle);
  const w = c.w, h = c.h;
  ctx.fillStyle = car.police ? '#e8e8e8' : car.color;
  ctx.beginPath();
  if (car.cls === 'motorcycle') { ctx.ellipse(0, 0, h / 2, w / 2, 0, 0, Math.PI * 2); }
  else { ctx.roundRect(-h / 2, -w / 2, h, w, 9); }
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.fillRect(-h * 0.18, -w * 0.36, h * 0.28, w * 0.72);
  ctx.fillStyle = 'rgba(255,255,220,0.9)';
  ctx.fillRect(h / 2 - 4, -w / 2 + 4, 4, 8);
  ctx.fillRect(h / 2 - 4, w / 2 - 12, 4, 8);
  ctx.fillStyle = 'rgba(255,60,60,0.9)';
  ctx.fillRect(-h / 2, -w / 2 + 4, 4, 8);
  ctx.fillRect(-h / 2, w / 2 - 12, 4, 8);
  if (car.police) {
    ctx.fillStyle = '#1a3a8a';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (car.cls === 'ambulance') { ctx.fillStyle = '#c22'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('+', 0, 4); }
  if (car.cls === 'van') { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('VAN', 0, 4); }
  if (car.cls === 'taxi') { ctx.fillStyle = '#111'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('TAXI', 0, 3); }
  ctx.restore();
  // Damage smoke / fire
  if (car.hp < 60 && !car.dead) {
    ctx.globalAlpha = 0.6;
    ctx.drawImage(sprites.glowWhite, sx - 14, sy - 14, 28, 28);
    ctx.globalAlpha = 1;
  }
  // Police siren glow
  if (car.police && car.siren > 0) {
    const spr = Math.sin(car.siren) > 0 ? sprites.glowRed : sprites.glowBlue;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(spr, sx - 46, sy - 46, 92, 92);
    ctx.globalAlpha = 1;
  }
}
export function drawPed(ctx, p, cam, time) {
  const sx = p.x - cam.x, sy = p.y - cam.y;
  if (sx < -30 || sy < -30 || sx > cam.w + 30 || sy > cam.h + 30) return;
  if (p.dead) {
    ctx.fillStyle = 'rgba(120,20,20,0.8)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 12, 6, p.angle, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const bob = Math.sin(p.pace * 6) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(sx + 2, sy + 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(sx, sy + bob, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(sx, sy - 9 + bob, 5, 0, Math.PI * 2); ctx.fill();
  if (p.tag) {
    ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.tag, sx, sy - 18);
  }
  if (p.kind === 'waiting') {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 8, sy - 16 + Math.sin(time * 5) * 3); ctx.stroke();
  }
}
export function drawBullets(ctx, bullets, cam) {
  ctx.lineWidth = 2;
  for (const b of bullets) {
    ctx.strokeStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.x - cam.x - Math.cos(b.angle) * 18, b.y - cam.y - Math.sin(b.angle) * 18);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
  }
}
export function drawFloats(ctx, floats, cam) {
  ctx.textAlign = 'center';
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.color;
    ctx.font = 'bold ' + f.size + 'px sans-serif';
    ctx.fillText(f.text, f.x - cam.x, f.y - cam.y - (1 - f.life / f.max) * 40);
  }
  ctx.globalAlpha = 1;
}
export function drawLighting(ctx, s, cam, vw, vh, phase) {
  // Day/night tint
  ctx.fillStyle = phase.tint;
  ctx.fillRect(0, 0, vw, vh);
  if (phase.lamp < 0.4) return;
  // Additive glows, limited to things near the player.
  ctx.globalCompositeOperation = 'lighter';
  const px = s.player.x, py = s.player.y;
  const cars = s.cars;
  let n = 0;
  for (const car of cars) {
    if (n > 14) break;
    if (car.parked || car.dead) continue;
    if (dist(car.x, car.y, px, py) > 750 && car !== s.player.inCar) continue;
    const sx = car.x - cam.x + Math.cos(car.angle) * 46, sy = car.y - cam.y + Math.sin(car.angle) * 46;
    ctx.globalAlpha = 0.5 * phase.lamp;
    ctx.drawImage(s.sprites.glowWhite, sx - 40, sy - 40, 80, 80);
    n++;
  }
  for (const lamp of s.city.streetlamps) {
    if (dist(lamp.x, lamp.y, px, py) > 700) continue;
    ctx.globalAlpha = 0.45 * phase.lamp;
    ctx.drawImage(s.sprites.glowWarm, lamp.x - cam.x - 34, lamp.y - cam.y - 34, 68, 68);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Vignette
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.45, vw / 2, vh / 2, vh * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);
}
export function drawMarkers(ctx, s, cam, vw, vh) {
  const px = s.player.x, py = s.player.y;
  // Mission target marker + GPS arrow ring ~75px around the player
  const t = s.missionTarget;
  if (t) {
    const wx = t.x - cam.x, wy = t.y - cam.y;
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(wx, wy, 22 + Math.sin(s.time * 4) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(wx, wy - 34); ctx.lineTo(wx - 8, wy - 20); ctx.lineTo(wx + 8, wy - 20); ctx.closePath(); ctx.fill();
    const ang = Math.atan2(t.y - py, t.x - px);
    const ax = vw / 2 + Math.cos(ang) * 75, ay = vh / 2 + Math.sin(ang) * 75;
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(Math.round(dist(px, py, t.x, t.y) / 10) + 'm', ax, ay + 26);
  }
  // Package spots (gold diamonds), weapon pickups, taxi stands
  for (const spot of s.city.packageSpots) {
    if (spot.taken) continue;
    const sx = spot.x - cam.x, sy = spot.y - cam.y;
    if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20) continue;
    ctx.fillStyle = '#ffd23a';
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14); ctx.restore();
  }
  for (const w of s.city.weaponPickups) {
    if (w.taken) continue;
    const sx = w.x - cam.x, sy = w.y - cam.y;
    if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20) continue;
    ctx.fillStyle = '#ff9a2a';
    ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(w.kind === 'shotgun' ? 'SG' : w.kind === 'smg' ? 'SMG' : 'RF', sx, sy + 3);
  }
  // Roadblocks and spikes
  for (const b of s.wanted.roadblocks) {
    ctx.fillStyle = '#ff5a3a';
    ctx.fillRect(b.x - cam.x - 30, b.y - cam.y - 8, 60, 16);
  }
  for (const sp of s.wanted.spikes) {
    const sx = sp.x - cam.x, sy = sp.y - cam.y;
    ctx.fillStyle = '#c8c8c8';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * 12, sy - 6);
      ctx.lineTo(sx + i * 12 + 6, sy + 6);
      ctx.lineTo(sx + i * 12 + 12, sy - 6);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Marco's sedan
  if (s.marco) {
    const sx = s.marco.x - cam.x, sy = s.marco.y - cam.y;
    ctx.fillStyle = '#ff5a7a';
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('MARCO ' + Math.round(s.marco.hp) + ' HP', sx, sy - 44);
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - 26, sy - 40, 52, 5);
    ctx.fillStyle = '#ff5a7a';
    ctx.fillRect(sx - 26, sy - 40, 52 * (s.marco.hp / s.marco.maxHp), 5);
  }
  // Skid marks
  ctx.strokeStyle = 'rgba(10,10,10,0.45)';
  ctx.lineWidth = 5;
  for (const m of s.skids) {
    ctx.beginPath();
    ctx.moveTo(m.x1 - cam.x, m.y1 - cam.y);
    ctx.lineTo(m.x2 - cam.x, m.y2 - cam.y);
    ctx.stroke();
  }
}
export function drawMinimap(ctx, s, mm) {
  const W = mm.width, H = mm.height;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3d4048';
  for (const ax of AVENUES_X) ctx.fillRect(ax * sx - 1, 0, 2, H);
  for (const st of STREETS_Y) ctx.fillRect(0, st * sy - 1, W, 2);
  ctx.fillStyle = '#1d4a6b';
  ctx.fillRect(WATER_EAST_X * sx, 0, W - WATER_EAST_X * sx, H);
  ctx.fillRect(0, WATER_SOUTH_Y * sy, W, H - WATER_SOUTH_Y * sy);
  for (const b of s.city.buildings) {
    ctx.fillStyle = '#5a6a8a';
    ctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  if (s.missionTarget) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(s.missionTarget.x * sx, s.missionTarget.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const spot of s.city.packageSpots) {
    if (spot.taken) continue;
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(spot.x * sx - 1, spot.y * sy - 1, 3, 3);
  }
  ctx.fillStyle = '#ff5a7a';
  for (const c of s.cars) if (c.police && !c.dead) ctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(s.player.x * sx, s.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);
}
