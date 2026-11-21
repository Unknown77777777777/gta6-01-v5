// player.js — Lena Cruz on foot: movement, collision pre-resolve, combat state.
import { isCircleBlockedAt, nearestFreePoint, clamp } from './city.js';
import { makeArsenal } from './weapons.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, hp: 100, maxHp: 100,
    money: 75, debt: 2000, debtPaid: 0,
    inCar: null, speed: 0, aiming: false,
    arsenal: makeArsenal(),
    bustedT: 0, wastedT: 0, runT: 0,
    lastSafeX: x, lastSafeY: y,
  };
}
// If the player starts a frame inside a building or water, snap to the nearest
// free point BEFORE moving — otherwise per-axis retry re-collides forever.
export function resolveStuckOnFoot(city, p) {
  if (isCircleBlockedAt(city, p.x, p.y, 14)) {
    const free = nearestFreePoint(city, p.x, p.y, 14);
    p.x = free.x; p.y = free.y;
    return true;
  }
  return false;
}
export function moveOnFoot(city, p, inp, dt) {
  resolveStuckOnFoot(city, p);
  const spd = inp.run ? 235 : 165;
  let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  if (mx === 0 && my === 0) { p.speed = 0; return; }
  const len = Math.hypot(mx, my);
  mx /= len; my /= len;
  p.speed = spd;
  p.angle = Math.atan2(my, mx);
  const step = spd * dt;
  const nx = p.x + mx * step, ny = p.y + my * step;
  // Try full move, then each axis; the pre-resolve above guarantees progress.
  if (!isCircleBlockedAt(city, nx, ny, 14)) { p.x = nx; p.y = ny; }
  else if (!isCircleBlockedAt(city, nx, p.y, 14)) { p.x = nx; }
  else if (!isCircleBlockedAt(city, p.x, ny, 14)) { p.y = ny; }
  p.x = clamp(p.x, 50, 4750); p.y = clamp(p.y, 50, 3550);
  if (!isCircleBlockedAt(city, p.x, p.y, 14)) { p.lastSafeX = p.x; p.lastSafeY = p.y; }
}
export function resetPlayerTimers(p) {
  p.bustedT = 0; p.wastedT = 0;
}
export function resetPlayerCombat(p) {
  p.arsenal = makeArsenal();
  p.aiming = false;
}
export function playerIsAiming(p, mouseDown) {
  return mouseDown && !p.inCar;
}
export function addMoney(p, amount) {
  p.money += amount;
  if (p.debt > 0) {
    const pay = Math.min(p.debt, amount);
    p.debt -= pay; p.debtPaid += pay;
  }
  return p.money;
}
export function hurtPlayer(p, amount) {
  p.hp -= amount;
  if (p.hp <= 0) { p.hp = 0; return true; }
  return false;
}
export function healPlayer(p, amount) {
  p.hp = Math.min(p.maxHp, p.hp + amount);
}
