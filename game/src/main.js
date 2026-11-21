// main.js — Costa Sol: game loop, input, mission runner, police, combat, save.
import { buildCity, nearestFreePoint, nearestRoadPoint, isCircleBlockedAt, inWater, dist, clamp, angleTo, WORLD_W, WORLD_H } from './city.js';
import { buildStaticLayer, makeSprites, drawWorld, drawCar, drawPed, drawBullets, drawFloats, drawLighting, drawMarkers, drawMinimap } from './render.js';
import { makePlayer, moveOnFoot, resolveStuckOnFoot, addMoney, hurtPlayer, healPlayer } from './player.js';
import { makeCar, driveCar, separateCars, updateTrafficCar, updatePoliceCar, damageCar, classLabel } from './vehicles.js';
import { makePed, createWaitingPed, updatePed, damagePed } from './pedestrians.js';
import { makeWanted, addHeat, clearWanted, updateWanted, ensureBarriers, hitSpike } from './wanted.js';
import { MISSION_DEFS, makeMissionState, resetMissionClean } from './missions.js';
import { MISSION2_DEFS, finalPointFor, makeMarcoSedan, updateMarcoSedan, ramMarco } from './missions2.js';
import { makeParticles, spawnBurst, spawnSmoke, spawnFlame, spawnMuzzle, spawnImpact, spawnConfetti, spawnCashSparkle, updateParticles, drawParticles } from './particles.js';
import { makeArsenal, currentWeapon, giveWeapon, switchWeapon, tryFire, tickArsenal, weaponSummary } from './weapons.js';
import { makeClock, tickClock, clockText, clockPhase } from './daynight.js';
import { districtAt, makeDistrictState, updateDistricts, claimDistrict, districtBonus } from './districts.js';
import { makeDialog, queueDialog, tickDialog, advanceDialog, dialogText, dialogDone, SPEAKERS } from './cutscenes.js';
import { makeAudio, ensureAudio, sfx, setEngine, setRadio, cycleStation, tickRadio, STATIONS } from './audio.js';
import { makeHudCache, updateHud, collectHudEls } from './hud.js';
import { writeSave, readSave, clearSave } from './save.js';
import { makeSide, tryStartTaxi, updateSide, checkPackages, checkJump, sideStatusText, taxiStands } from './side.js';
import { makeMinigames, startRace, updateRace, startVigilante, vigilanteHit, updateVigilante, startParamedic, updateParamedic, minigameText } from './minigames.js';

const ALL_MISSIONS = [...MISSION_DEFS, ...MISSION2_DEFS];
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
const els = collectHudEls(document);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || null;
const SEED = parseInt(params.get('seed') || '7', 10);

const city = buildCity(SEED);
const rng = mulberry32(SEED * 13 + 5);

function makeState() {
  const spawn = nearestFreePoint(city, city.landmarks.spawn.x, city.landmarks.spawn.y, 16);
  return {
    city, rng, time: 0, running: false, complete: false, frozen: false,
    player: makePlayer(spawn.x, spawn.y),
    cars: [], peds: [], bullets: [], floats: [], skids: [],
    wanted: makeWanted(),
    missions: makeMissionState(),
    clock: makeClock(),
    districts: makeDistrictState(),
    dialog: makeDialog(),
    audio: makeAudio(),
    particles: makeParticles(),
    side: makeSide(),
    minigames: makeMinigames(),
    tiles: null, sprites: makeSprites(),
    cam: { x: 0, y: 0, w: canvas.width, h: canvas.height, shake: 0 },
    keys: {}, mouse: { x: 0, y: 0, down: false },
    missionTarget: null, missionTimer: 0, missionTimerMax: 0,
    marco: null, targetCar: null, marcoWrecked: false,
    bannerText: '', bannerT: 0, radioName: '', radioBannerT: 0,
    fps: 60, fpsAcc: 0, fpsN: 0, fpsT: 0,
    saveT: 0, policeT: 0, bustedAcc: 0, wasted: false,
    hudCache: makeHudCache(),
    startedAt: performance.now(),
    missionStartT: performance.now(),
    missionTimes: {},
    bustedCount: 0, wastedCount: 0,
    phaseName: 'day', clockText: '08:00',
  };
}
let S = makeState();
S.tiles = buildStaticLayer(city);

function banner(text, secs = 3) { S.bannerText = text; S.bannerT = secs; }
function addFloat(x, y, text, color = '#ffd23a', size = 18) {
  S.floats.push({ x, y, text, color, size, life: 1.4, max: 1.4 });
  if (S.floats.length > 24) S.floats.shift();
}
function addSkid(x1, y1, x2, y2) {
  S.skids.push({ x1, y1, x2, y2 });
  if (S.skids.length > 120) S.skids.shift();
}

// ---- world population ----
function spawnTraffic() {
  const kinds = ['compact', 'sedan', 'sports', 'taxi', 'truck', 'van', 'motorcycle', 'limo', 'ambulance'];
  for (let i = 0; i < 22; i++) {
    const ax = [400, 1000, 1600, 2200, 2800, 3400, 4000][i % 7];
    const sy = [400, 1000, 1600, 2200, 2800, 3200][Math.floor(i / 7) % 6];
    const cls = kinds[i % kinds.length];
    const car = makeCar(city, ax + (rng() - 0.5) * 60, sy + (rng() - 0.5) * 60, cls);
    car.angle = rng() < 0.5 ? 0 : Math.PI / 2;
    S.cars.push(car);
  }
  // Parked cars, one guaranteed near spawn.
  const starter = makeCar(city, 560, 470, 'sedan', { parked: true, color: '#c23a3a' });
  S.cars.push(starter);
  for (let i = 0; i < 10; i++) {
    const ax = [1000, 1600, 2200, 2800, 3400, 4000][i % 6];
    const sy = [1000, 1600, 2200, 2800][i % 4];
    S.cars.push(makeCar(city, ax + 70, sy + 70, ['compact', 'sedan', 'sports'][i % 3], { parked: true }));
  }
  // One taxi guaranteed near spawn.
  S.cars.push(makeCar(city, 640, 560, 'taxi', { parked: true, color: '#e0c22a' }));
}
function spawnPeds() {
  for (let i = 0; i < 26; i++) {
    const beach = i < 5;
    const x = beach ? 300 + rng() * 4000 : 300 + rng() * 4200;
    const y = beach ? 3300 + rng() * 100 : 300 + rng() * 2900;
    S.peds.push(makePed(city, x, y, beach ? 'beach' : 'walker'));
  }
  // Taxi waiters at the stands.
  for (const st of taxiStands(city)) {
    S.peds.push(createWaitingPed(city, st.x + 20, st.y + 20, st.id));
  }
}
spawnTraffic();
spawnPeds();

function currentMissionDef() { return ALL_MISSIONS[S.missions.idx] || null; }
function currentStepDef() {
  const m = currentMissionDef();
  return m ? m.steps[S.missions.stepIdx] : null;
}
function ensureTargetCar(step) {
  if (!step || step.type !== 'steal') return;
  const existing = S.cars.find((c) => c.mission === 'target' && !c.dead);
  if (existing) { S.targetCar = existing; return; }
  const color = step.carKind === 'sports' ? '#c22a2a' : step.carKind === 'van' ? '#e8e8e8' : '#3a6bc2';
  const car = makeCar(city, step.x, step.y, step.carKind, { parked: true, color, mission: 'target' });
  S.cars.push(car);
  S.targetCar = car;
}
function ensureMarco() {
  if (S.marco || S.marcoWrecked) return;
  const pos = makeMarcoSedan(city, S.player.x, S.player.y);
  const car = makeCar(city, pos.x, pos.y, 'sports', { color: '#ff2a5a', mission: 'marco' });
  car.hp = pos.hp; car.maxHp = pos.hp;
  S.cars.push(car);
  S.marco = car;
}
function startMissionStep() {
  const step = currentStepDef();
  const m = currentMissionDef();
  if (!m) return;
  S.missionTimer = m.timeLimit || 0;
  S.missionTimerMax = m.timeLimit || 0;
  if (step && step.type === 'steal') ensureTargetCar(step);
  if (step && step.type === 'ram') ensureMarco();
  if (step && step.type === 'final') {
    const fp = finalPointFor(city);
    step.x = fp.x; step.y = fp.y;
  }
  S.missionTarget = step && step.x !== undefined ? { x: step.x, y: step.y, label: step.label } : null;
  if (step && step.type === 'steal') S.missionTarget = { x: step.x, y: step.y, label: step.label };
}
function missionStepPos(step) {
  if (step.type === 'steal' && S.targetCar) return { x: S.targetCar.x, y: S.targetCar.y };
  return { x: step.x, y: step.y };
}
function completeMission(m) {
  const p = S.player;
  const bonus = districtBonus(S.districts, districtAt(p.x, p.y).name);
  const night = S.clock.nightBonus > 1 ? Math.round(m.reward * 0.25) : 0;
  const total = m.reward + bonus + night;
  addMoney(p, total);
  claimDistrict(S.districts, districtAt(p.x, p.y).name);
  addFloat(p.x, p.y - 30, '+$' + total, '#7dff6a', 22);
  spawnCashSparkle(S.particles, p.x, p.y);
  spawnConfetti(S.particles, p.x, p.y);
  sfx(S.audio, 'cash'); sfx(S.audio, 'mission');
  banner('MISSION COMPLETE — ' + m.name + '  +$' + total, 3.5);
  addFloat(p.x, p.y - 60, 'MISSION COMPLETE', '#ffd23a', 24);
  S.missionTimes[m.id] = (performance.now() - S.missionStartT) / 1000;
  S.missionStartT = performance.now();
  queueDialog(S.dialog, m.id, 'debrief');
  const next = ALL_MISSIONS[S.missions.idx + 1];
  if (next) queueDialog(S.dialog, next.id, 'brief');
  writeSave(S);
}
function failMission(reason) {
  banner('MISSION FAILED — ' + reason, 3);
  sfx(S.audio, 'fail');
  clearWanted(S.wanted);
  resetMissionClean(S.missions);
  // Respawn clean at a free point near the garage; target cars re-ensured.
  const free = nearestFreePoint(city, city.landmarks.solGarage.x, city.landmarks.solGarage.y, 20);
  S.player.x = free.x; S.player.y = free.y;
  S.player.inCar = null;
  S.targetCar = null;
  S.marco = null;
  S.marcoWrecked = false;
  S.cars = S.cars.filter((c) => c.mission !== 'target' && c.mission !== 'marco' && !c.dead);
  startMissionStep();
}
function respawnClean(kind) {
  if (kind === 'wasted') S.wastedCount++; else S.bustedCount++;
  banner(kind === 'wasted' ? 'WASTED — you wake up at the hospital' : 'BUSTED — the cops let you off at the garage', 3);
  sfx(S.audio, 'fail');
  clearWanted(S.wanted);
  resetMissionClean(S.missions);
  const base = kind === 'wasted' ? city.landmarks.hospital : city.landmarks.solGarage;
  const free = nearestFreePoint(city, base.x, base.y, 20);
  const p = S.player;
  p.x = free.x; p.y = free.y; p.hp = 100; p.inCar = null;
  p.arsenal = makeArsenal();
  S.targetCar = null; S.marco = null; S.marcoWrecked = false;
  S.cars = S.cars.filter((c) => !c.police && c.mission !== 'target' && c.mission !== 'marco' && !c.dead);
  // A fresh car nearby so the player is never stranded on foot.
  S.cars.push(makeCar(city, free.x + 60, free.y, 'sedan', { parked: true }));
  S.bustedAcc = 0;
  startMissionStep();
}
function advanceMissionStep() {
  const m = currentMissionDef();
  const step = currentStepDef();
  // A stolen target car stops being "the target" once its steal step is done,
  // so the next steal mission spawns a fresh vehicle instead of reusing it.
  if (step && step.type === 'steal' && S.targetCar) {
    S.targetCar.mission = 'delivered';
    S.targetCar = null;
  }
  S.missions.stepIdx++;
  S.missions.holdT = 0;
  if (S.missions.stepIdx >= m.steps.length) {
    S.missions.completedIds.push(m.id);
    completeMission(m);
    S.missions.idx++;
    S.missions.stepIdx = 0;
    S.missions.timer = 0;
    if (S.missions.idx >= ALL_MISSIONS.length) {
      S.complete = true;
      banner('COSTA SOL COMPLETE', 6);
      writeSave(S);
      return;
    }
    const nm = currentMissionDef();
    if (nm) queueDialog(S.dialog, nm.id, 'brief');
  }
  S.missions.holdT = 0;
  startMissionStep();
}

// ---- entering / exiting cars ----
function nearestCar(px, py, maxD) {
  let best = null, bd = maxD;
  for (const c of S.cars) {
    if (c.dead) continue;
    const d = dist(px, py, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function tryEnterCar() {
  const p = S.player;
  const car = nearestCar(p.x, p.y, 78);
  if (!car) return false;
  p.inCar = car;
  car.parked = false;
  car.driver = 'player';
  p.x = car.x; p.y = car.y;
  setRadio(S.audio, true);
  S.radioName = STATIONS[S.audio.station].name;
  S.radioBannerT = 2.5;
  sfx(S.audio, 'door');
  const policeNear = S.cars.some((c) => c.police && dist(c.x, c.y, p.x, p.y) < 600);
  if (policeNear) { if (addHeat(S.wanted, 10, S.time)) addFloat(p.x, p.y - 40, 'WANTED ★', '#ff5a7a', 20); }
  return true;
}
function tryExitCar() {
  const p = S.player;
  const car = p.inCar;
  if (!car) return;
  // Eject MUST land on a free point — nearestFreePoint with a true circle test.
  const side = car.angle + Math.PI / 2;
  const cand = { x: car.x + Math.cos(side) * 46, y: car.y + Math.sin(side) * 46 };
  const free = nearestFreePoint(city, cand.x, cand.y, 14);
  p.x = free.x; p.y = free.y;
  p.inCar = null;
  car.driver = null;
  setRadio(S.audio, false);
  sfx(S.audio, 'door');
}

// ---- combat ----
function fireGuns() {
  const p = S.player;
  const res = tryFire(p.arsenal, 0);
  if (!res) return;
  if (res.dry) { sfx(S.audio, 'dryFire'); return; }
  const w = res.def;
  const aimX = S.mouse.x + S.cam.x, aimY = S.mouse.y + S.cam.y;
  const baseAng = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = baseAng;
  for (let i = 0; i < w.pellets; i++) {
    const ang = baseAng + (Math.random() - 0.5) * w.spread * 2;
    S.bullets.push({
      x: p.x + Math.cos(ang) * 22, y: p.y + Math.sin(ang) * 22,
      vx: Math.cos(ang) * w.bulletSpeed, vy: Math.sin(ang) * w.bulletSpeed,
      life: w.range / w.bulletSpeed, angle: ang, damage: w.damage, color: w.tracer,
    });
  }
  spawnMuzzle(S.particles, p.x + Math.cos(baseAng) * 26, p.y + Math.sin(baseAng) * 26, baseAng);
  sfx(S.audio, w.name === 'SHOTGUN' ? 'shotgun' : w.name === 'SMG' ? 'smg' : w.name === 'RIFLE' ? 'rifle' : 'shot');
}
function updateBullets(dt) {
  for (const b of S.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    if (isCircleBlockedAt(city, b.x, b.y, 2)) { spawnImpact(S.particles, b.x, b.y); b.life = 0; continue; }
    for (const ped of S.peds) {
      if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
        damagePed(ped, b.damage);
        spawnImpact(S.particles, b.x, b.y);
        b.life = 0;
        addHeat(S.wanted, 6, S.time);
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of S.cars) {
      if (car.dead) continue;
      const dx = b.x - car.x, dy = b.y - car.y;
      const ca = Math.cos(-car.angle), sa = Math.sin(-car.angle);
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      if (Math.abs(lx) < 40 && Math.abs(ly) < 24) {
        damageCar(car, b.damage);
        spawnImpact(S.particles, b.x, b.y);
        b.life = 0;
        if (car.police || car.mission === 'marco') addHeat(S.wanted, 8, S.time);
        if (car.dead) explodeCar(car);
        break;
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
}
function explodeCar(car) {
  spawnBurst(S.particles, car.x, car.y, 26, '#ff9a2a', 260, 0.9, 4);
  spawnBurst(S.particles, car.x, car.y, 14, '#444', 120, 1.2, 6);
  S.cam.shake = 14;
  sfx(S.audio, 'explosion');
  const p = S.player;
  if (p.inCar === car) {
    const free = nearestFreePoint(city, car.x + 50, car.y, 14);
    p.x = free.x; p.y = free.y; p.inCar = null;
    hurtPlayer(p, 20);
    setRadio(S.audio, false);
  }
  S.cars = S.cars.filter((c) => c !== car);
  if (car.mission === 'target') { car.dead = true; S.targetCar = null; }
  if (car.mission === 'marco') { S.marco = null; S.marcoWrecked = true; }
}

// ---- police ----
function maintainPolice(dt) {
  const want = S.wanted.stars;
  const cops = S.cars.filter((c) => c.police && !c.dead);
  if (want > 0 && cops.length < want) {
    S.policeT -= dt;
    if (S.policeT <= 0) {
      S.policeT = 1.2;
      const rp = nearestRoadPoint(S.player.x + (rng() < 0.5 ? -500 : 500), S.player.y + (rng() < 0.5 ? -400 : 400));
      const cop = makeCar(city, rp.x, rp.y, 'police', {});
      S.cars.push(cop);
      sfx(S.audio, 'siren');
    }
  }
  if (want === 0 && cops.length > 0) {
    // Cruisers drift off; remove the far ones.
    for (const c of cops) if (dist(c.x, c.y, S.player.x, S.player.y) > 900) S.cars = S.cars.filter((x) => x !== c);
  }
  if (want >= 3) ensureBarriers(S.wanted, S.player.x, S.player.y, S.player.inCar ? S.player.inCar.angle : S.player.angle, rng);
}

// ---- input ----
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'hand' };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  ensureAudio(S.audio);
  const k = KEYMAP[e.code];
  if (k) S.keys[k] = true;
  if (e.repeat) return;
  if (e.code === 'KeyE') onPressE();
  if (e.code === 'KeyF') { if (!S.player.inCar) fireGuns(); }
  if (e.code === 'KeyR') {
    if (S.player.inCar) {
      S.radioName = cycleStation(S.audio);
      S.radioBannerT = 2.5;
    }
  }
  if (e.code === 'KeyV') {
    if (S.player.inCar && S.wanted.stars === 0) {
      if (startVigilante(S.minigames)) banner('VIGILANTE — ram the marked cars', 3);
    }
  }
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    const kinds = ['pistol', 'shotgun', 'smg', 'rifle'];
    switchWeapon(S.player.arsenal, kinds[parseInt(e.code.slice(5), 10) - 1]);
  }
  if (e.code === 'KeyM') { S.audio.muted = !S.audio.muted; }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) S.keys[k] = false; });
canvas.addEventListener('mousemove', (e) => { S.mouse.x = e.clientX; S.mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  S.mouse.down = true;
  ensureAudio(S.audio);
  if (!S.player.inCar && S.running) fireGuns();
});
window.addEventListener('mouseup', () => { S.mouse.down = false; });

function onPressE() {
  if (!S.running || S.complete) return;
  if (S.dialog.active) { advanceDialog(S.dialog); return; }
  const p = S.player;
  const step = currentStepDef();
  if (step && step.type === 'final' && !p.inCar) {
    const fp = { x: step.x, y: step.y };
    if (dist(p.x, p.y, fp.x, fp.y) < step.r) { advanceMissionStep(); return; }
  }
  if (step && step.type === 'hold' && !p.inCar) return; // hold uses held E — but only on foot; in a car, E must still exit
  // Taxi: E near a waiting ped while in a car starts a fare.
  if (p.inCar) {
    for (const ped of S.peds) {
      if (ped.kind === 'waiting' && !ped.dead && dist(ped.x, p.y, p.x, p.y) < 90) {
        const fare = tryStartTaxi(S.side, ped, p.x, p.y, city, S.clock.nightBonus);
        if (fare) { banner('TAXI FARE — take them to stand ' + fare.dest.id + '  $' + fare.fare, 3); sfx(S.audio, 'taxiBlip'); ped.kind = 'rider'; ped.tag = null; }
        return;
      }
    }
  }
  if (p.inCar) tryExitCar();
  else tryEnterCar();
}

// ---- mission step evaluation ----
function evalMissionStep(dt) {
  const m = currentMissionDef();
  const step = currentStepDef();
  if (!m || !step) return;
  const p = S.player;
  if (m.timeLimit) {
    S.missionTimer -= dt;
    if (S.missionTimer <= 0) { failMission(m.name + ' — time up'); return; }
  }
  const pos = p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
  switch (step.type) {
    case 'enterCar':
      if (p.inCar) advanceMissionStep();
      break;
    case 'steal': {
      ensureTargetCar(step);
      if (p.inCar === S.targetCar) advanceMissionStep();
      else if (S.targetCar) S.missionTarget = { x: S.targetCar.x, y: S.targetCar.y, label: step.label };
      break;
    }
    case 'goto':
    case 'deliver': {
      const useCar = step.needCar;
      const at = useCar ? p.inCar : true;
      if (at && dist(pos.x, pos.y, step.x, step.y) < step.r) advanceMissionStep();
      break;
    }
    case 'pickup':
      if (!p.inCar && dist(p.x, p.y, step.x, step.y) < step.r) {
        if (m.id === 'M3') { if (addHeat(S.wanted, 25, S.time)) addFloat(p.x, p.y - 40, 'WANTED ★★', '#ff5a7a', 20); }
        advanceMissionStep();
      }
      break;
    case 'hold': {
      if (dist(p.x, p.y, step.x, step.y) < step.r && S.keys['e'] !== false) {
        // E held: track via keydown state — keys map has no 'e'; use mouse-free hold flag below.
      }
      break;
    }
    case 'escape': {
      const inHide = dist(pos.x, pos.y, city.landmarks.hideout.x, city.landmarks.hideout.y) < step.r;
      if (inHide && S.wanted.stars === 0) advanceMissionStep();
      break;
    }
    case 'ram': {
      if (S.marcoWrecked || (S.marco && S.marco.hp <= 0)) {
        S.marcoWrecked = false; S.marco = null;
        advanceMissionStep();
      } else ensureMarco();
      break;
    }
    case 'final':
      // Completed by pressing E at the point (onPressE).
      break;
    default: break;
  }
}
// Hold steps need the E key held: track separately.
let eHeld = false;
window.addEventListener('keydown', (e) => { if (e.code === 'KeyE') eHeld = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'KeyE') eHeld = false; });
function evalHoldStep(dt) {
  const step = currentStepDef();
  if (!step || step.type !== 'hold') return;
  const p = S.player;
  const m = currentMissionDef();
  if (!p.inCar && dist(p.x, p.y, step.x, step.y) < step.r && eHeld) {
    S.missions.holdT += dt;
    if (S.missions.holdT >= step.secs) {
      if (m.id === 'M5') { if (addHeat(S.wanted, 45, S.time)) addFloat(p.x, p.y - 40, 'WANTED ★★★', '#ff5a7a', 20); }
      if (m.id === 'M8') { if (addHeat(S.wanted, 45, S.time)) addFloat(p.x, p.y - 40, 'LOCKDOWN ★★★', '#ff5a7a', 20); }
      advanceMissionStep();
    }
  } else {
    S.missions.holdT = Math.max(0, S.missions.holdT - dt * 2);
  }
}

// ---- per-frame world update ----
function stepWorld(dt) {
  const p = S.player;
  const inCar = !!p.inCar;
  // Clock + districts
  const phase = tickClock(S.clock, dt);
  S.phaseName = phase.name;
  S.clockText = clockText(S.clock);
  const dNow = updateDistricts(S.districts, p.x, p.y, dt, (d) => {
    banner(d.name + ' — ' + d.blurb, 2.5);
    sfx(S.audio, 'districtChime');
  });
  // Player movement
  if (inCar) {
    const car = p.inCar;
    const prevX = car.x, prevY = car.y;
    const skid = driveCar(city, car, { up: S.keys.up, down: S.keys.down, left: S.keys.left, right: S.keys.right, hand: S.keys.hand }, dt);
    if (skid) addSkid(prevX, prevY, car.x, car.y);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Spike strips pop tyres: heavy slowdown + damage.
    if (hitSpike(car.x, car.y, S.wanted)) { car.speed *= 0.4; damageCar(car, 4); }
    if (car.hp < 60 && Math.random() < dt * 8) spawnSmoke(S.particles, car.x, car.y, car.hp < 30);
    if (car.hp < 30 && Math.random() < dt * 6) spawnFlame(S.particles, car.x, car.y);
    if (car.hp <= 0) explodeCar(car);
    // Ram Marco?
    if (S.marco && S.marco !== car) {
      const md = dist(car.x, car.y, S.marco.x, S.marco.y);
      if (md < 80) {
        const dmg = ramMarco(S.marco, Math.abs(car.speed));
        if (dmg > 0) {
          damageCar(S.marco, dmg);
          spawnBurst(S.particles, S.marco.x, S.marco.y, 10, '#ffd23a', 160, 0.4, 3);
          S.cam.shake = 8;
          sfx(S.audio, 'crash');
          addFloat(S.marco.x, S.marco.y - 40, '-' + dmg + ' HP', '#ff5a7a', 18);
          if (S.marco.hp <= 0) { explodeCar(S.marco); }
        }
        car.speed *= 0.55;
      }
    }
    // Stunt jumps
    const jump = checkJump(S.side, car.x, car.y, car.speed, city);
    if (jump) {
      addMoney(p, jump.amount);
      addFloat(car.x, car.y - 40, 'STUNT +$' + jump.amount, '#7dff6a', 20);
      sfx(S.audio, 'jumpWhoosh');
      S.cam.shake = 6;
    }
    // Vigilante: ram a police-marked criminal car — any non-player traffic car counts when active.
    if (S.minigames.vigilante) {
      for (const c of S.cars) {
        if (c !== car && !c.police && !c.dead && c.cls !== 'taxi' && dist(c.x, c.y, car.x, car.y) < 60 && Math.abs(car.speed) > 200) {
          const pay = vigilanteHit(S.minigames);
          addMoney(p, pay);
          addFloat(c.x, c.y - 30, 'VIGILANTE +$' + pay, '#7dff6a', 18);
          damageCar(c, 40);
          sfx(S.audio, 'vigilanteBlip');
        }
      }
    }
  } else {
    moveOnFoot(city, p, { up: S.keys.up, down: S.keys.down, left: S.keys.left, right: S.keys.right, run: S.keys.run }, dt);
    const pkg = checkPackages(S.side, city, p.x, p.y);
    if (pkg) {
      addMoney(p, pkg.amount);
      addFloat(pkg.x, pkg.y - 20, '+$25 PACKAGE', '#ffd23a', 16);
      sfx(S.audio, 'pickup');
    }
    for (const w of city.weaponPickups) {
      if (!w.taken && dist(p.x, p.y, w.x, w.y) < 44) {
        w.taken = true;
        giveWeapon(p.arsenal, w.kind);
        banner('Picked up ' + w.kind.toUpperCase() + ' — press ' + ({ shotgun: 2, smg: 3, rifle: 4 }[w.kind]) + ' to equip', 3);
        sfx(S.audio, 'pickup');
      }
    }
  }
  // Weapon cooldown tick (never fires on its own).
  tickArsenal(p.arsenal, dt);
  if (S.mouse.down && !inCar && S.running) { /* held fire handled by mousedown; allow autofire */ }
  // Traffic + peds
  for (const car of [...S.cars]) {
    if (car.dead) continue;
    if (car === p.inCar) continue;
    if (car.mission === 'marco') {
      updateMarcoSedan(city, car, p.x, p.y, dt, rng);
      continue;
    }
    if (car.police) {
      const dmg = updatePoliceCar(city, car, p.x, p.y, S.wanted.stars, dt, rng);
      if (dmg > 0) {
        if (inCar) { damageCar(p.inCar, dmg); if (p.inCar.hp <= 0) explodeCar(p.inCar); }
        else if (hurtPlayer(p, dmg)) { respawnClean('wasted'); return; }
        S.cam.shake = 6;
        sfx(S.audio, 'crash');
      }
      continue;
    }
    updateTrafficCar(city, car, dt, rng);
  }
  separateCars(S.cars);
  const danger = { x: p.x, y: p.y };
  for (const ped of S.peds) updatePed(city, ped, dt, rng, danger);
  updateBullets(dt);
  updateParticles(S.particles, dt);
  for (const f of S.floats) f.life -= dt;
  S.floats = S.floats.filter((f) => f.life > 0);
  // Wanted
  const inHide = dist(p.x, p.y, city.landmarks.hideout.x, city.landmarks.hideout.y) < 130;
  const policeNear = S.cars.some((c) => c.police && dist(c.x, c.y, p.x, p.y) < 500);
  updateWanted(S.wanted, dt, S.time, p.x, p.y, inHide, policeNear);
  maintainPolice(dt);
  // Busted: police on foot contact while wanted.
  if (!inCar && S.wanted.stars > 0) {
    const nearCop = S.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 55);
    if (nearCop) {
      S.bustedAcc += dt;
      if (S.bustedAcc > 1.5) { respawnClean('busted'); return; }
    } else S.bustedAcc = 0;
  }
  // Race / paramedic / vigilante timers
  const raceEv = updateRace(S.minigames, dt, p.x, p.y, inCar);
  if (raceEv) {
    if (raceEv.type === 'race-done') { addMoney(p, raceEv.prize); banner('RACE — place ' + raceEv.place + '  +$' + raceEv.prize, 3); sfx(S.audio, 'raceWin'); }
    if (raceEv.type === 'race-cp') sfx(S.audio, 'raceBeep');
    if (raceEv.type === 'race-lost') banner('RACE — out of time', 3);
  }
  updateVigilante(S.minigames, dt);
  const medEv = updateParamedic(S.minigames, dt, p.x, p.y, city.landmarks.hospital);
  if (medEv) {
    if (medEv.type === 'medic-done') { addMoney(p, medEv.prize); banner('PARAMEDIC +$' + medEv.prize, 3); sfx(S.audio, 'raceWin'); }
    if (medEv.type === 'medic-picked') banner('Patient aboard — to the hospital!', 3);
    if (medEv.type === 'medic-lost') banner('PARAMEDIC — patient lost', 3);
  }
  const taxiEv = updateSide(S.side, dt, p.x, p.y, inCar, null);
  if (taxiEv && taxiEv.type === 'taxi-done') {
    addMoney(p, taxiEv.fare);
    addFloat(p.x, p.y - 30, 'FARE +$' + taxiEv.fare, '#7dff6a', 18);
    sfx(S.audio, 'cash');
  }
  if (taxiEv && taxiEv.type === 'taxi-timeout') banner('Taxi fare cancelled — too slow', 3);
  // Mission steps
  evalMissionStep(dt);
  evalHoldStep(dt);
  // Mission target refresh (steal target moves)
  const step = currentStepDef();
  if (step) {
    if (step.type === 'steal' && S.targetCar) S.missionTarget = { x: S.targetCar.x, y: S.targetCar.y, label: step.label };
    else if (step.x !== undefined) S.missionTarget = { x: step.x, y: step.y, label: step.label };
    else S.missionTarget = null;
  } else S.missionTarget = null;
  // Race start: drive over the start line in a car with no mission? Trigger via R key is enough; also auto-start near race line.
  if (!S.minigames.race && inCar && dist(p.x, p.y, city.landmarks.raceStart.x, city.landmarks.raceStart.y) < 70 && S.wanted.stars === 0) {
    // Only offer, don't auto-start: handled by banner hint below.
  }
  // Audio
  setEngine(S.audio, p.inCar ? p.inCar.speed : 0, !!p.inCar);
  tickRadio(S.audio, dt);
  // Autosave
  S.saveT += dt;
  if (S.saveT > 30) { S.saveT = 0; writeSave(S); }
  // Camera
  const vw = canvas.width, vh = canvas.height;
  S.cam.w = vw; S.cam.h = vh;
  const tx = clamp(p.x - vw / 2, 0, WORLD_W - vw);
  const ty = clamp(p.y - vh / 2, 0, WORLD_H - vh);
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 6);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 6);
  if (S.cam.shake > 0) {
    S.cam.x += (Math.random() - 0.5) * S.cam.shake;
    S.cam.y += (Math.random() - 0.5) * S.cam.shake;
    S.cam.shake *= Math.pow(0.02, dt);
    if (S.cam.shake < 0.4) S.cam.shake = 0;
  }
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.radioBannerT > 0) S.radioBannerT -= dt;
}

// ---- render frame ----
function render() {
  const vw = canvas.width, vh = canvas.height;
  const phase = clockPhase(S.clock);
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, vw, vh);
  const cam = { x: S.cam.x, y: S.cam.y, w: vw, h: vh };
  drawWorld(ctx, S, cam, vw, vh);
  // Cars sorted by y for a little depth
  const cars = [...S.cars].filter((c) => !c.dead).sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(ctx, car, cam, S.sprites, phase, S.time);
  for (const ped of S.peds) drawPed(ctx, ped, cam, S.time);
  // Player on foot
  const p = S.player;
  if (!p.inCar) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(sx + 2, sy + 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(sx + Math.cos(p.angle) * 4, sy + Math.sin(p.angle) * 4 - 4, 5, 0, Math.PI * 2); ctx.fill();
    // Gun barrel
    if (p.aiming || S.mouse.down) {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(p.angle) * 20, sy + Math.sin(p.angle) * 20); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('LENA', sx, sy - 16);
  }
  drawBullets(ctx, S.bullets, cam);
  drawParticles(ctx, S.particles, cam);
  drawFloats(ctx, S.floats, cam);
  drawMarkers(ctx, S, cam, vw, vh);
  drawLighting(ctx, S, cam, vw, vh, phase);
  // Fireflies at night over parks
  if (phase.name === 'night') {
    ctx.fillStyle = '#d8ff7a';
    for (let i = 0; i < 12; i++) {
      const fx = 1200 + ((i * 173) % 1800) + Math.sin(S.time * 0.7 + i) * 30 - cam.x;
      const fy = 1400 + ((i * 97) % 800) + Math.cos(S.time * 0.9 + i) * 20 - cam.y;
      if (fx > 0 && fx < vw && fy > 0 && fy < vh) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(S.time * 3 + i); ctx.fillRect(fx, fy, 3, 3); }
    }
    ctx.globalAlpha = 1;
  }
  // Letterbox during dialog
  if (S.dialog.letterbox) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, 46);
    ctx.fillRect(0, vh - 46, vw, 46);
  }
  drawMinimap(mmCtx, S, mmCanvas);
}

// ---- HUD snapshot for hud.js ----
function hudSnapshot() {
  const p = S.player;
  const ws = weaponSummary(p.arsenal);
  const m = currentMissionDef();
  return {
    player: p, wanted: S.wanted,
    clockText: clockText(S.clock), phaseName: clockPhase(S.clock).name,
    missionText: m ? `${m.id} ${m.name}: ${currentStepDef() ? currentStepDef().label : ''}` + (S.missions.holdT > 0 ? ` (${Math.ceil(S.missions.holdT)}s)` : '') : 'STORY COMPLETE',
    missionTimer: S.missionTimer,
    districtName: S.districts.current,
    districtBonus: districtBonus(S.districts, S.districts.current),
    weaponText: ws.current.toUpperCase() + ' ' + ws.ammo + '/' + ws.max + (ws.reloading ? ' …' : ''),
    fpsText: Math.round(S.fps) + ' FPS',
    sideText: sideStatusText(S.side),
    minigameText: minigameText(S.minigames),
    radioBannerT: S.radioBannerT, radioName: S.radioName,
    dialog: S.dialog.line ? { line: true, whoName: (SPEAKERS[S.dialog.line.who] || {}).name || S.dialog.line.who, whoColor: (SPEAKERS[S.dialog.line.who] || {}).color || '#fff', text: dialogText(S.dialog) } : { line: false },
    bannerT: S.bannerT, bannerText: S.bannerText,
    complete: S.complete,
    showStart: !S.running,
  };
}

// ---- main loop ----
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  S.time += dt;
  // FPS meter
  S.fpsAcc += dt; S.fpsN++;
  if (S.fpsAcc >= 0.5) { S.fps = S.fpsN / S.fpsAcc; S.fpsAcc = 0; S.fpsN = 0; }
  if (S.running && !S.complete) {
    if (S.dialog.active) {
      tickDialog(S.dialog, dt);
      if (!S.dialog.line) S.dialog.letterbox = false;
    } else if (!S.frozen) {
      stepWorld(dt);
    }
  } else if (S.complete) {
    // Keep the world gently alive behind the complete screen.
    tickClock(S.clock, dt);
  }
  render();
  updateHud(S.hudCache, els, hudSnapshot());
  // Debug snapshot for automated QA (read-only).
  window.__cs = {
    running: S.running, complete: S.complete,
    x: Math.round(S.player.x), y: Math.round(S.player.y),
    angle: S.player.angle,
    money: S.player.money, debt: S.player.debt, hp: Math.round(S.player.hp),
    inCar: !!S.player.inCar, carSpeed: S.player.inCar ? Math.round(S.player.inCar.speed) : 0,
    missionIdx: S.missions.idx, missionId: currentMissionDef() ? currentMissionDef().id : null,
    stepIdx: S.missions.stepIdx, stepType: currentStepDef() ? currentStepDef().type : null,
    target: S.missionTarget ? { x: Math.round(S.missionTarget.x), y: Math.round(S.missionTarget.y) } : null,
    wanted: S.wanted.stars, fps: Math.round(S.fps),
    dialog: !!S.dialog.active, timer: Math.round(S.missionTimer),
    marcoHp: S.marco ? Math.round(S.marco.hp) : null,
    marco: S.marco ? { x: Math.round(S.marco.x), y: Math.round(S.marco.y) } : null,
    cars: S.cars.filter((c) => !c.dead).map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), cls: c.cls, police: c.police, mission: c.mission || null, parked: c.parked })),
    time: Math.round(S.time),
  };
}

// ---- start / continue ----
function newGame() {
  clearSave();
  S = makeState();
  S.tiles = buildStaticLayer(city);
  spawnTraffic();
  spawnPeds();
  S.running = true;
  queueDialog(S.dialog, 'M1', 'brief');
  startMissionStep();
  ensureAudio(S.audio);
}
function continueGame() {
  const d = readSave();
  if (!d) { newGame(); return; }
  S = makeState();
  S.tiles = buildStaticLayer(city);
  spawnTraffic();
  spawnPeds();
  const p = S.player;
  p.money = d.money; p.debt = d.debt; p.debtPaid = d.debtPaid || 0; p.hp = d.hp || 100;
  const free = nearestFreePoint(city, d.x, d.y, 16);
  p.x = free.x; p.y = free.y;
  S.missions.idx = d.missionIdx || 0;
  S.missions.completedIds = d.completedIds || [];
  if (d.weapons) p.arsenal = d.weapons;
  if (d.clock) S.clock.minutes = d.clock;
  if (d.station !== undefined) S.audio.station = d.station;
  S.side.packagesTaken = d.packagesTaken || 0;
  S.side.taxiFares = d.taxiFares || 0;
  S.side.jumpsDone = d.jumpsDone || 0;
  S.districts.controlled = d.districts || {};
  S.dialog.seen = d.dialogSeen || {};
  S.running = true;
  startMissionStep();
  ensureAudio(S.audio);
}
document.getElementById('btn-new').addEventListener('click', () => { newGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { continueGame(); });
if (readSave()) document.getElementById('btn-continue').style.display = 'inline-block';

// ---- screenshot staging (?shot=) ----
function stageShot(kind) {
  newGame();
  // Freeze the simulation for the staged shot: the scene stays exactly as
  // composed (no drifting, no pile-ups) while the frame renders.
  // ?live=1 keeps the world running (used for honest FPS measurements).
  S.frozen = !params.get('live');
  // Clear the M1 briefing the new game queued; each shot stages its own scene.
  S.dialog.queue = []; S.dialog.line = null; S.dialog.shown = 0; S.dialog.active = false; S.dialog.letterbox = false;
  const p = S.player;
  if (kind === 'cover') {
    // Sunset chase: wanted 4, Lena in a sports car, cruisers behind, M9 target.
    S.clock.minutes = 1080;
    S.missions.idx = 8; S.missions.stepIdx = 0;
    const car = makeCar(city, 2200, 1600, 'sports', { color: '#c22a2a' });
    S.cars.push(car);
    p.inCar = car; car.driver = 'player'; p.x = car.x; p.y = car.y;
    car.angle = 0; car.speed = 260;
    addHeat(S.wanted, 70, S.time);
    ensureMarco();
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(city, 2200 - 380 - i * 90, 1600 + (i - 1) * 70, 'police', {});
      S.cars.push(cop);
    }
    startMissionStep();
    banner('M9 — KING OF COSTA SOL', 5);
  } else if (kind === 'driving') {
    S.clock.minutes = 600;
    const car = makeCar(city, 1600, 400, 'sports', { color: '#2a7ac2' });
    S.cars.push(car);
    p.inCar = car; car.driver = 'player'; p.x = car.x; p.y = car.y; car.angle = 0; car.speed = 260;
    startRace(S.minigames, p.x, p.y);
    setRadio(S.audio, true);
    S.radioName = STATIONS[0].name; S.radioBannerT = 2.5;
    startMissionStep();
  } else if (kind === 'mission') {
    // M8 at night, 5 stars, lockdown.
    S.clock.minutes = 1320;
    S.missions.idx = 7; S.missions.stepIdx = 0;
    const free = nearestFreePoint(city, 1400, 400, 16);
    p.x = free.x; p.y = free.y;
    addHeat(S.wanted, 90, S.time);
    for (let i = 0; i < 2; i++) {
      const cop = makeCar(city, 1400 + 200 + i * 80, 400 + (i - 1) * 70, 'police', {});
      S.cars.push(cop);
    }
    startMissionStep();
    banner('M8 — HEAT WAVE · LOCKDOWN', 5);
  } else if (kind === 'foot') {
    // M7 briefing at night, Lena on foot by a shotgun pickup.
    S.clock.minutes = 1260;
    S.missions.idx = 6; S.missions.stepIdx = 0;
    const free = nearestFreePoint(city, 1200, 1000, 16);
    p.x = free.x; p.y = free.y;
    queueDialog(S.dialog, 'M7', 'brief');
    if (S.dialog.line) S.dialog.shown = S.dialog.line.text.length;
    startMissionStep();
  }
  // Centre the camera on the player immediately.
  S.cam.x = clamp(p.x - canvas.width / 2, 0, 4800 - canvas.width);
  S.cam.y = clamp(p.y - canvas.height / 2, 0, 3600 - canvas.height);
}
if (SHOT) {
  stageShot(SHOT);
  // Let the world settle one frame before the screenshot is taken.
  setTimeout(() => { window.__shotReady = true; }, 1200);
} else {
  window.__shotReady = true;
}
requestAnimationFrame(loop);
