// particles.js — pre-allocated particle pool: zero allocation per frame in the hot loop.
export const POOL_SIZE = 320;
export function makeParticles() {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', kind: 0, grav: 0 });
  }
  return { pool, cursor: 0 };
}
export function spawnParticle(P, x, y, vx, vy, life, size, color, kind = 0, grav = 0) {
  const p = P.pool[P.cursor];
  P.cursor = (P.cursor + 1) % POOL_SIZE;
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = life; p.max = life; p.size = size; p.color = color; p.kind = kind; p.grav = grav;
}
export function spawnBurst(P, x, y, n, color, speed = 160, life = 0.6, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    spawnParticle(P, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), color, 0);
  }
}
export function spawnSmoke(P, x, y, dark) {
  spawnParticle(P, x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14,
    (Math.random() - 0.5) * 20, -30 - Math.random() * 25, 1.1, 7 + Math.random() * 6,
    dark ? '#222' : '#ddd', 1);
}
export function spawnFlame(P, x, y) {
  spawnParticle(P, x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12,
    (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.35, 5 + Math.random() * 5,
    Math.random() < 0.5 ? '#ff9a2a' : '#ffd23a', 2);
}
export function spawnMuzzle(P, x, y, ang) {
  for (let i = 0; i < 4; i++) {
    const a = ang + (Math.random() - 0.5) * 0.9;
    spawnParticle(P, x, y, Math.cos(a) * (180 + Math.random() * 120), Math.sin(a) * (180 + Math.random() * 120), 0.12, 2.5, '#ffe08a', 2);
  }
}
export function spawnImpact(P, x, y) {
  spawnBurst(P, x, y, 6, '#ffd23a', 120, 0.3, 2);
}
export function spawnConfetti(P, x, y) {
  const cols = ['#ffd23a', '#ff5a7a', '#4ad2ff', '#7dff6a'];
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 200;
    spawnParticle(P, x, y, Math.cos(a) * s, Math.sin(a) * s - 60, 1.2, 3, cols[i % 4], 0, 120);
  }
}
export function spawnCashSparkle(P, x, y) {
  for (let i = 0; i < 8; i++) {
    spawnParticle(P, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30,
      0, -40 - Math.random() * 30, 0.8, 3, '#7dff6a', 2);
  }
}
export function updateParticles(P, dt) {
  for (const p of P.pool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= 0.98; p.vy *= 0.98;
  }
}
export function drawParticles(ctx, P, cam) {
  for (const p of P.pool) {
    if (p.life <= 0) continue;
    const sx = p.x - cam.x, sy = p.y - cam.y;
    if (sx < -20 || sy < -20 || sx > cam.w + 20 || sy > cam.h + 20) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = p.kind === 1 ? a * 0.55 : a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size * (p.kind === 1 ? 1 + (1 - a) * 1.6 : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
