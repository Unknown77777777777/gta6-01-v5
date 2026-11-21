// districts.js — 8 named districts of Costa Sol with police presence and bonuses.
export const DISTRICTS = [
  { name: 'Downtown', x: 2000, y: 0, w: 1600, h: 1200, police: 3, bonus: 10, blurb: 'Glass towers, fast money.' },
  { name: 'Beachfront', x: 0, y: 2800, w: 2400, h: 800, police: 1, bonus: 5, blurb: 'Sand, surf and stolen sunsets.' },
  { name: 'Harbour', x: 3600, y: 2800, w: 1200, h: 800, police: 2, bonus: 5, blurb: 'Crates, cranes and quiet deals.' },
  { name: 'Docks', x: 4000, y: 1200, w: 800, h: 1600, police: 2, bonus: 5, blurb: 'Warehouse doors never lock twice.' },
  { name: 'Plaza', x: 1600, y: 1200, w: 1200, h: 1200, police: 2, bonus: 5, blurb: 'Fountains, cafes, pickpockets.' },
  { name: 'Garage Row', x: 2800, y: 2000, w: 1200, h: 1200, police: 1, bonus: 10, blurb: "Sol's turf. Safe-ish." },
  { name: 'Market', x: 0, y: 1200, w: 1600, h: 1600, police: 2, bonus: 5, blurb: 'Stalls by day, scores by night.' },
  { name: 'Marina', x: 3600, y: 0, w: 1200, h: 1200, police: 1, bonus: 10, blurb: 'Yachts worth more than the debt.' },
];
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}
export function makeDistrictState() {
  return { current: 'Downtown', controlled: {}, raid: null, raidCooldown: 0 };
}
export function updateDistricts(ds, x, y, dt, onRaid) {
  const d = districtAt(x, y);
  if (d.name !== ds.current) {
    ds.current = d.name;
    if (onRaid) onRaid(d);
  }
  if (ds.raidCooldown > 0) ds.raidCooldown -= dt;
  if (ds.raid) {
    ds.raid.t -= dt;
    if (ds.raid.t <= 0) ds.raid = null;
  }
  return d;
}
export function claimDistrict(ds, name) { ds.controlled[name] = true; }
export function districtBonus(ds, name) { return ds.controlled[name] ? 5 : 0; }
