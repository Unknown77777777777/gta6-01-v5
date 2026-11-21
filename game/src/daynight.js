// daynight.js — game clock 08:00 start, dawn/day/sunset/night cycle with sky tint.
export function makeClock() {
  return { minutes: 8 * 60, rate: 0.1, nightBonus: 1 }; // rate: game-minutes per real second * 60? tuned below
}
export const PHASES = [
  { name: 'dawn', from: 300, to: 480, tint: 'rgba(255,150,90,0.16)', sky: '#2a2a4a', lamp: 0.5 },
  { name: 'day', from: 480, to: 1020, tint: 'rgba(255,220,150,0.05)', sky: '#87b5d6', lamp: 0.1 },
  { name: 'sunset', from: 1020, to: 1200, tint: 'rgba(255,110,60,0.22)', sky: '#5a2a3a', lamp: 0.7 },
  { name: 'night', from: 1200, to: 1440, tint: 'rgba(10,10,50,0.34)', sky: '#0a0a22', lamp: 1.0 },
  { name: 'night', from: 0, to: 300, tint: 'rgba(10,10,50,0.34)', sky: '#0a0a22', lamp: 1.0 },
];
export function clockPhase(clock) {
  const m = ((clock.minutes % 1440) + 1440) % 1440;
  for (const p of PHASES) if (m >= p.from && m < p.to) return p;
  return PHASES[1];
}
export function tickClock(clock, dt) {
  // 6 game-minutes per real second → a full day in 4 real minutes.
  clock.minutes = (clock.minutes + dt * 6) % 1440;
  const ph = clockPhase(clock);
  clock.nightBonus = ph.name === 'night' ? 1.25 : 1;
  return ph;
}
export function clockText(clock) {
  const m = Math.floor(((clock.minutes % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
