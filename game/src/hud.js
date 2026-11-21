// hud.js — DOM HUD updates (only writes textContent when the value changed).
export function makeHudCache() { return { last: {} }; }
export function setText(cache, el, value) {
  if (!el) return;
  if (cache.last[el.id] !== value) { cache.last[el.id] = value; el.textContent = value; }
}
export function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
export function updateHud(cache, els, s) {
  const p = s.player, w = s.wanted, ms = s.missions;
  setText(cache, els.money, '$' + p.money);
  setText(cache, els.debt, p.debt > 0 ? 'DEBT $' + p.debt : 'DEBT CLEAR');
  setText(cache, els.health, 'HP ' + Math.round(p.hp));
  setText(cache, els.stars, '★'.repeat(w.stars) + '☆'.repeat(5 - w.stars));
  setText(cache, els.clock, s.clockText + ' · ' + s.phaseName);
  const car = p.inCar;
  setText(cache, els.speed, car ? Math.round(Math.abs(car.speed) * 0.22) + ' km/h' : '');
  const m = s.missionText;
  setText(cache, els.objective, m);
  if (s.missionTimer > 0) setText(cache, els.timer, Math.ceil(s.missionTimer) + 's');
  else setText(cache, els.timer, '');
  setText(cache, els.district, s.districtName + (s.districtBonus ? '  +' + s.districtBonus : ''));
  setText(cache, els.weapons, s.weaponText);
  setText(cache, els.fps, s.fpsText);
  setText(cache, els.side, s.sideText);
  setText(cache, els.minigame, s.minigameText || '');
  show(els.minigameBox, !!s.minigameText);
  show(els.radio, s.radioBannerT > 0);
  if (s.radioBannerT > 0) setText(cache, els.radio, '♪ ' + s.radioName);
  // Dialog box
  const d = s.dialog;
  show(els.dialog, !!d.line);
  if (d.line) {
    setText(cache, els.dialogWho, d.whoName);
    els.dialogWho.style.color = d.whoColor;
    setText(cache, els.dialogText, d.text);
  }
  show(els.banner, s.bannerT > 0);
  if (s.bannerT > 0) setText(cache, els.banner, s.bannerText);
  show(els.complete, s.complete);
  show(els.start, s.showStart);
}
export function collectHudEls(doc) {
  const id = (n) => doc.getElementById(n);
  return {
    money: id('hud-money'), debt: id('hud-debt'), health: id('hud-health'), stars: id('hud-stars'),
    clock: id('hud-clock'), speed: id('hud-speed'), objective: id('hud-objective'), timer: id('hud-timer'),
    district: id('hud-district'), weapons: id('hud-weapons'), fps: id('hud-fps'), side: id('hud-side'),
    minigame: id('hud-minigame'), minigameBox: id('hud-minigame-box'),
    radio: id('hud-radio'), dialog: id('hud-dialog'), dialogWho: id('hud-dialog-who'),
    dialogText: id('hud-dialog-text'), banner: id('hud-banner'), complete: id('screen-complete'),
    start: id('screen-start'),
  };
}
