// missions.js — story M1–M6 and the generic step runner.
// Steps: goto | enterCar | steal | deliver | pickup | hold | escape
export const MISSION_DEFS = [
  {
    id: 'M1', name: 'First Fare', reward: 190, timeLimit: 0,
    brief: 'Lena needs wheels. Steal a car, pick up the fare at the taxi stand, drop them downtown.',
    steps: [
      { type: 'enterCar', label: 'Steal any car (walk up and press E)' },
      { type: 'goto', x: 600, y: 1000, r: 90, needCar: true, label: 'Drive to the taxi stand' },
      { type: 'goto', x: 2200, y: 1600, r: 110, needCar: true, label: 'Drop the fare at the Plaza' },
    ],
  },
  {
    id: 'M2', name: 'Borrowed Wheels', reward: 200, timeLimit: 0,
    brief: 'Marco wants a sports coupe. Take the red coupe parked near the Marina road and bring it to Sol’s garage.',
    steps: [
      { type: 'steal', carKind: 'sports', x: 4000, y: 1000, label: 'Steal the red sports coupe' },
      { type: 'deliver', x: 3400, y: 2400, r: 120, label: 'Deliver the coupe to Sol’s Garage' },
    ],
  },
  {
    id: 'M3', name: 'Heat Run', reward: 300, timeLimit: 0,
    brief: 'A package is waiting west. Grab it, run it east across town, then lose the heat at the hideout.',
    steps: [
      { type: 'pickup', x: 1000, y: 1800, r: 70, label: 'Pick up the package (walk over it)' },
      { type: 'deliver', x: 4000, y: 1800, r: 120, needCar: false, label: 'Deliver the package east' },
      { type: 'escape', x: 3400, y: 2400, r: 130, label: 'Lose the heat at Sol’s Garage' },
    ],
  },
  {
    id: 'M4', name: 'Hot Package', reward: 350, timeLimit: 0,
    brief: 'A hot parcel sits by the Market store. Grab it on foot, then drive it to the Harbour.',
    steps: [
      { type: 'pickup', x: 1800, y: 1600, r: 70, label: 'Grab the parcel at the Market store' },
      { type: 'deliver', x: 4500, y: 3000, r: 130, needCar: false, label: 'Deliver to the Harbour marina' },
    ],
  },
  {
    id: 'M5', name: 'Quick Score', reward: 500, timeLimit: 0,
    brief: 'The Market store keeps cash in the back. Hold E at the door to crack it, then vanish.',
    steps: [
      { type: 'hold', x: 1800, y: 1600, r: 80, secs: 3, label: 'Hold E at the store to rob it' },
      { type: 'escape', x: 3400, y: 2400, r: 130, label: 'Escape to Sol’s Garage and lose the heat' },
    ],
  },
  {
    id: 'M6', name: 'The Last Getaway', reward: 800, timeLimit: 0,
    brief: 'One last run. Drive to the Docks, shake the cruisers, and bring the debt to zero.',
    steps: [
      { type: 'enterCar', label: 'Get in a car' },
      { type: 'goto', x: 4000, y: 3000, r: 120, needCar: true, label: 'Drive to the Docks' },
      { type: 'escape', x: 3400, y: 2400, r: 130, label: 'Lose the heat at Sol’s Garage — debt cleared' },
    ],
  },
];
export function missionById(id) { return MISSION_DEFS.find((m) => m.id === id); }
export function totalStoryReward() { return MISSION_DEFS.reduce((s, m) => s + m.reward, 0); }
export function makeMissionState() {
  return { idx: 0, stepIdx: 0, timer: 0, holdT: 0, targetCarId: null, failed: false, done: false, completedIds: [], startedAt: 0 };
}
export function currentMission(ms) { return MISSION_DEFS[ms.idx] || null; }
export function currentStep(ms) {
  const m = currentMission(ms);
  return m ? m.steps[ms.stepIdx] : null;
}
export function missionTargetFor(ms) {
  const s = currentStep(ms);
  if (!s) return null;
  if (s.type === 'steal') return { x: s.x, y: s.y, label: s.label };
  if (s.x !== undefined) return { x: s.x, y: s.y, label: s.label };
  return null;
}
export function missionProgress(ms) {
  const m = currentMission(ms);
  if (!m) return { done: true, text: 'Story complete' };
  return { done: false, text: `${m.id} · ${m.name} — step ${ms.stepIdx + 1}/${m.steps.length}` };
}
export function missionSummary(ms) {
  const m = currentMission(ms);
  if (!m) return 'All missions complete';
  const s = currentStep(ms);
  return `${m.id} ${m.name}: ${s ? s.label : ''}`;
}
export function debtLeft(player) { return Math.max(0, player.debt); }
// Clean retry after wasted/busted: no duplicated NPCs, cars or timers.
export function resetMissionClean(ms) {
  ms.stepIdx = 0; ms.timer = 0; ms.holdT = 0; ms.targetCarId = null; ms.failed = false;
}
export function advanceStep(ms) {
  const m = currentMission(ms);
  ms.stepIdx++;
  ms.holdT = 0;
  if (ms.stepIdx >= m.steps.length) {
    ms.completedIds.push(m.id);
    ms.idx++;
    ms.stepIdx = 0; ms.timer = 0;
    return { missionDone: true, mission: m };
  }
  return { missionDone: false };
}
