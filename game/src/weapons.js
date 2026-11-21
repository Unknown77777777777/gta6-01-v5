// weapons.js — four guns: pistol, shotgun, SMG, rifle. Pickups on the map.
export const WEAPONS = {
  pistol: { name: 'PISTOL', damage: 12, range: 420, fireRate: 0.28, spread: 0.05, pellets: 1, ammoMax: 12, reloadTime: 0.9, bulletSpeed: 900, tracer: '#ffe08a', label: 'Pistol' },
  shotgun: { name: 'SHOTGUN', damage: 9, range: 300, fireRate: 0.8, spread: 0.28, pellets: 6, ammoMax: 6, reloadTime: 1.6, bulletSpeed: 750, tracer: '#ff9a2a', label: 'Shotgun' },
  smg: { name: 'SMG', damage: 8, range: 380, fireRate: 0.11, spread: 0.12, pellets: 1, ammoMax: 30, reloadTime: 1.2, bulletSpeed: 1000, tracer: '#7dd8ff', label: 'SMG' },
  rifle: { name: 'RIFLE', damage: 26, range: 620, fireRate: 0.5, spread: 0.02, pellets: 1, ammoMax: 8, reloadTime: 1.8, bulletSpeed: 1300, tracer: '#ff5a7a', label: 'Rifle' },
};
export function makeArsenal() {
  return {
    owned: { pistol: true, shotgun: false, smg: false, rifle: false },
    current: 'pistol',
    ammo: { pistol: 12, shotgun: 0, smg: 0, rifle: 0 },
    cooldown: 0, reloading: 0,
  };
}
export function currentWeapon(a) { return WEAPONS[a.current]; }
export function giveWeapon(a, kind) {
  a.owned[kind] = true;
  a.ammo[kind] = WEAPONS[kind].ammoMax;
  a.current = kind;
}
export function switchWeapon(a, kind) {
  if (!a.owned[kind]) return false;
  a.current = kind; a.reloading = 0;
  return true;
}
// Tick cooldowns/reload timers only — never fires. Call this every frame;
// tryFire is only for an actual trigger pull.
export function tickArsenal(a, dt) {
  if (a.cooldown > 0) a.cooldown -= dt;
  if (a.reloading > 0) {
    a.reloading -= dt;
    if (a.reloading <= 0) a.ammo[a.current] = WEAPONS[a.current].ammoMax;
  }
}
// Returns a shot description or null (cooling down / reloading / empty).
export function tryFire(a, dt) {
  if (a.cooldown > 0) return null;
  if (a.reloading > 0) return null;
  const w = WEAPONS[a.current];
  if (a.ammo[a.current] <= 0) {
    if (a.current !== 'pistol') { a.current = 'pistol'; a.ammo.pistol = WEAPONS.pistol.ammoMax; }
    else { a.reloading = w.reloadTime; }
    return { dry: true };
  }
  a.ammo[a.current]--;
  a.cooldown = w.fireRate;
  if (a.ammo[a.current] === 0) a.reloading = w.reloadTime;
  return { weapon: a.current, def: w };
}
export function weaponSummary(a) {
  return { current: a.current, ammo: a.ammo[a.current], max: WEAPONS[a.current].ammoMax, reloading: a.reloading > 0 };
}
