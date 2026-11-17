// Bonus content (level designer #2):
//  1. VICTORY STAIRS finale: after the boss dies (or at the end of a gold run) the army runs up a
//     ramp of 10 coloured steps labelled ×1.2 … ×5. Every step "spends" a few soldiers who stay
//     behind on it; the last step reached multiplies the level's coin reward.
//  2. ALTIN KOŞUSU (gold run) bonus level: every level whose number ends in 5 (5, 15, 25, 35 …)
//     replaces the normal layout. save.level numbering is unchanged (level 5 IS the bonus level).
//     No enemies / walls / saws / boss: coin lines, blue (always positive) gates, gems worth 10.
//     It ends at the finish line and the stairs multiply the coins collected.
// main.js calls in through small hooks marked `// BONUS:`. Everything here is allocated once;
// the per-frame functions only write into preallocated arrays / objects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, mulberry32, makeCanvas, canvasTex, strokeText } from './util.js';
import { box, addRim } from './models.js';
import { themeFor } from './world.js';

export const isBonusLevel = (L) => L % 10 === 5;

// ============================================================ shared context from main.js
let C = null; // { scene, S, squad, getLV, MAT, burst, confetti, sfx, toast, floatText, updateCoinsHud, dims, vibrate, pulse }

// ============================================================ stairs geometry (built once)
const NST = 10;
export const MULTS = [1.2, 1.4, 1.6, 1.8, 2, 2.4, 2.8, 3.2, 4, 5];
// soldiers needed to REACH step i (cumulative); the difference is what each step keeps
const NEED = [1, 4, 8, 14, 22, 34, 50, 75, 110, 160];
const COLORS = [0xff4f5e, 0xff7a3a, 0xffa63a, 0xffd23a, 0xa6e04a, 0x3bd16f, 0x2fd3c0, 0x2f8cff, 0x7a5cff, 0xd04fff];
const SD = 1.8, SH = 0.7, SW = 11.2, TOPD = 5.2;
const stepDepth = (i) => (i === NST - 1 ? TOPD : SD);
const stepCenter = (i) => i * SD + (i === NST - 1 ? 1.4 : SD / 2); // local z where the head "lands"
const multText = (m) => '×' + (Number.isInteger(m) ? m : m.toFixed(1));

const ST = {
  group: null, hi: null, active: false, phase: 'off', T: 0, rise: 0, z0: 0, head: 0, target: 0,
  N: 1, V0: 0, rem: 0, next: 0, reached: -1, mult: 1, endT: 0, stayers: [], perStep: new Int16Array(NST), hiT: 0,
};
const CAM = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 };
const POSE = { y: 0, sw: 0, ry: 0 };

function buildStairs() {
  const parts = [];
  for (let i = 0; i < NST; i++) {
    const h = (i + 1) * SH, d = stepDepth(i);
    parts.push(box(SW, h, d, 0, h / 2, i * SD + d / 2, COLORS[i]));
    parts.push(box(SW + 0.04, 0.08, 0.14, 0, h + 0.03, i * SD + 0.07, 0xffffff)); // white lip
    parts.push(box(0.3, h + 0.12, d, -SW / 2 + 0.15, (h + 0.12) / 2, i * SD + d / 2, 0xffffff)); // side rails
    parts.push(box(0.3, h + 0.12, d, SW / 2 - 0.15, (h + 0.12) / 2, i * SD + d / 2, 0xffffff));
  }
  const steps = new THREE.Mesh(mergeGeometries(parts), C.MAT.decor);
  for (const p of parts) p.dispose();

  // one canvas atlas for all 10 labels, one merged mesh of riser planes
  const cw = 512, ch = 1024, cell = ch / NST;
  const cv = makeCanvas(cw, ch), x = cv.getContext('2d');
  for (let i = 0; i < NST; i++) {
    const cy = cell * i + cell / 2;
    const dark = '#' + new THREE.Color(COLORS[i]).multiplyScalar(0.55).getHexString();
    strokeText(x, multText(MULTS[i]), cw / 2, cy + 4, 84, '#ffffff', dark, 14);
  }
  const tex = canvasTex(cv);
  const lp = [];
  for (let i = 0; i < NST; i++) {
    const g = new THREE.PlaneGeometry(3.5, 3.5 / 5);
    const uv = g.attributes.uv, v0 = 1 - (i + 1) / NST, v1 = 1 - i / NST;
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? v1 : v0);
    g.rotateY(Math.PI);
    g.translate(0, i * SH + SH / 2 - 0.02, i * SD - 0.015);
    lp.push(g);
  }
  const labels = new THREE.Mesh(mergeGeometries(lp), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  for (const p of lp) p.dispose();
  labels.renderOrder = 2;

  const hiGeo = new THREE.PlaneGeometry(SW - 0.6, SD - 0.12).rotateX(-Math.PI / 2);
  ST.hi = new THREE.Mesh(hiGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  ST.hi.visible = false;

  const grp = new THREE.Group();
  grp.add(steps, labels, ST.hi);
  grp.visible = false;
  grp.traverse((o) => { o.frustumCulled = false; });
  C.scene.add(grp);
  ST.group = grp;
}

function stairTop(z) { // world z -> height of the step surface under it
  const lz = z - ST.z0;
  if (lz < 0 || lz > (NST - 1) * SD + TOPD) return 0;
  const i = Math.min(NST - 1, Math.floor(lz / SD));
  return Math.max(0, (i + 1) * SH + ST.group.position.y);
}

// ============================================================ gems (bonus level)
const GEM_MAX = 16;
let gemGeo = null, gemMat = null;
const GEMS = { mesh: null, n: 0, x: new Float32Array(GEM_MAX), z: new Float32Array(GEM_MAX), taken: new Uint8Array(GEM_MAX), spark: 0 };

export function initBonus(ctx) {
  C = ctx;
  buildStairs();
  gemGeo = new THREE.OctahedronGeometry(0.36, 0).scale(1, 1.35, 1);
  gemMat = addRim(new THREE.MeshLambertMaterial({ color: 0xff5ad8, emissive: 0x7a1a66, flatShading: true }), 0.7);
  const s = document.querySelector('#splash small');
  if (s) splashDefault = s.textContent;
}
let splashDefault = 'YENİ BÖLÜM';

// ============================================================ bonus level layout
export function bonusSpec(L) {
  const th = themeFor(L);
  const rnd = mulberry32(L * 104729 + 3);
  const R = (a, b) => a + (b - a) * rnd();
  const spec = { th, gates: [], blocks: [], enemies: [], saws: [], coins: [], hammers: [], spikes: [], rollers: [], patterns: ['gold'], gems: [], bonus: true };
  const coin = (x, z) => spec.coins.push({ x: clamp(x, -4, 4), z });
  const gem = (x, z) => { if (spec.gems.length < GEM_MAX) spec.gems.push({ x: clamp(x, -4, 4), z }); };
  const good = () => ({ good: true, mul: rnd() < 0.5, r: rnd(), r2: rnd() });
  const plan = ['snake', 'gate', 'rows', 'lanes', 'gate', 'arc', 'snake', 'gate', 'rows'];
  let z = 12;
  for (const t of plan) {
    if (t === 'gate') { spec.gates.push({ z: z + 2, defs: [good(), good()] }); z += 10; continue; }
    if (t === 'snake') {
      const ph = R(0, 6.28), amp = R(2.2, 3.4);
      for (let k = 0; k < 14; k++) coin(Math.sin(k * 0.42 + ph) * amp, z + k * 1.1);
      gem(Math.sin(14 * 0.42 + ph) * amp, z + 16.2);
      z += 20;
    } else if (t === 'rows') {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) coin(-3.2 + c * 1.6, z + r * 2.2);
      gem(R(-3.6, 3.6), z + 9.6);
      z += 13;
    } else if (t === 'lanes') {
      const g = rnd() < 0.5 ? -1 : 1;
      for (let k = 0; k < 9; k++) { coin(-2.7, z + k * 1.15); coin(2.7, z + k * 1.15); }
      gem(g * 2.7, z + 11); gem(g * 2.7, z + 12.6);
      z += 16;
    } else if (t === 'arc') {
      for (let k = 0; k < 5; k++) gem(-3.6 + k * 1.8, z + Math.abs(k - 2) * -1.6 + 3.4);
      for (let k = 0; k < 8; k++) coin(0, z + 5.5 + k * 1.1);
      z += 16;
    }
  }
  spec.end = z;
  spec.bossLine = z + 4;
  spec.bossZ = spec.bossLine + 24;
  spec.speed = 10.4;
  spec.hpMul = 1;
  return spec;
}

// called at the end of buildLevel for EVERY level: resets the stairs, builds gems for gold runs
export function bonusBuild(LV) {
  const spec = LV.spec;
  LV.bonus = !!spec.bonus;
  ST.active = false; ST.phase = 'off'; ST.mult = 1; ST.reached = -1; ST.stayers.length = 0;
  ST.group.visible = false; ST.hi.visible = false;
  GEMS.mesh = null; GEMS.n = 0;
  if (!LV.bonus) return;
  LV.boss.group.visible = false;
  // the stairs already stand at the end of a gold run, as the goal you run towards
  ST.z0 = LV.bossLine + 3;
  ST.group.position.set(0, 0, ST.z0);
  ST.group.visible = true;
  const n = Math.min(GEM_MAX, spec.gems.length);
  GEMS.n = n;
  for (let i = 0; i < n; i++) { GEMS.x[i] = spec.gems[i].x; GEMS.z[i] = spec.gems[i].z; GEMS.taken[i] = 0; }
  if (n) {
    const m = new THREE.InstancedMesh(gemGeo, gemMat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    LV.grp.add(m); LV.own.push(m);
    GEMS.mesh = m;
  }
}

function writeRy(a, o, c, s, x, y, z, k) {
  a[o] = c * k; a[o + 1] = 0; a[o + 2] = -s * k; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = k; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = s * k; a[o + 9] = 0; a[o + 10] = c * k; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}

// every frame: gem spin + pickup (gold run only)
export function bonusTick(dt) {
  if (!GEMS.mesh) return;
  const S = C.S, q = C.squad, t = S.t;
  if (S.state === 'play') {
    const d = C.dims(S.count), back = q.z - d.depth - 0.5;
    for (let i = 0; i < GEMS.n; i++) {
      if (GEMS.taken[i] || GEMS.z[i] > q.z + 0.5 || GEMS.z[i] < back - 0.3) continue;
      if (Math.abs(GEMS.x[i] - q.x) < d.hw + 0.3) {
        GEMS.taken[i] = 1; S.runCoins += 10; S.collected++;
        C.burst(GEMS.x[i], 0.9, GEMS.z[i], 0xff5ad8, 10, 3.5, 0.6, 8, 5);
        C.floatText('+10', 'gold');
        C.sfx.play('coin'); C.vibrate(12);
        C.updateCoinsHud();
      }
    }
  }
  const a = GEMS.mesh.instanceMatrix.array, c = Math.cos(t * 2.6), s = Math.sin(t * 2.6);
  let n = 0;
  for (let i = 0; i < GEMS.n; i++) {
    if (GEMS.taken[i]) continue;
    const dz = GEMS.z[i] - q.z;
    if (dz < -16 || dz > 80) continue;
    writeRy(a, n++ * 16, c, s, GEMS.x[i], 0.75 + Math.sin(t * 3 + i) * 0.12, GEMS.z[i], 1);
  }
  GEMS.mesh.count = n;
  GEMS.mesh.instanceMatrix.needsUpdate = true;
  GEMS.spark += dt;
  if (GEMS.spark > 0.22 && n) {
    GEMS.spark = 0;
    const i = (Math.random() * GEMS.n) | 0;
    if (!GEMS.taken[i] && Math.abs(GEMS.z[i] - q.z) < 40) C.burst(GEMS.x[i], 1.0, GEMS.z[i], 0xffffff, 1, 1.2, 0.35, -1, 1);
  }
}

// ============================================================ stairs finale
export const stairsActive = () => ST.active;
export const stairsMult = () => ST.mult;

function startStairs() {
  const S = C.S, q = C.squad, LV = C.getLV();
  ST.active = true; ST.T = 0; ST.endT = 0; ST.next = 0; ST.reached = -1; ST.mult = 1; ST.hiT = 0;
  ST.stayers.length = 0; ST.perStep.fill(0);
  ST.N = Math.max(1, S.count); ST.rem = ST.N; ST.V0 = q.sold.length;
  if (LV.bonus) { ST.rise = 1; ST.phase = 'run'; }
  else {
    // rise out of the road just beyond where the boss fell
    ST.z0 = q.z + clamp(LV.boss.z - q.z + 2.5, 7, 12);
    ST.rise = 0; ST.phase = 'wait';
    ST.group.position.set(0, -(NST * SH + 1), ST.z0);
    ST.group.visible = true;
  }
  ST.head = q.z;
  ST.target = ST.z0 + stepCenter(NST - 1);
  for (const s of q.sold) { s.sy = 0; s.ry = 0; s.arr = 0; }
  if (!ST.V0) { ST.phase = 'end'; }
}

function layoutStep(i, from, n) { // place stayers [from, from+n) on step i
  const cols = Math.min(n, 14), rows = Math.ceil(n / Math.max(1, cols));
  const dx = Math.min(0.62, 8.8 / Math.max(1, cols)), d = stepDepth(i) - 0.5;
  const dz = rows > 1 ? Math.min(0.46, d / (rows - 1)) : 0;
  const zc = ST.z0 + i * SD + (i === NST - 1 ? 0.35 + ((rows - 1) * dz) / 2 : stepDepth(i) / 2);
  for (let k = 0; k < n; k++) {
    const s = ST.stayers[from + k], r = (k / cols) | 0, c = k - r * cols, inRow = Math.min(cols, n - r * cols);
    s.tx = (c - (inRow - 1) / 2) * dx + (Math.random() - 0.5) * 0.08;
    s.tz = zc + (r - (rows - 1) / 2) * dz + (Math.random() - 0.5) * 0.06;
    s.arr = 0;
  }
}

function reachStep(i) {
  const q = C.squad;
  const keep = i === NST - 1 ? ST.rem : Math.min(ST.rem, NEED[i + 1] - NEED[i]);
  ST.rem -= keep;
  const cur = q.sold.length;
  const visAfter = ST.rem > 0 ? Math.max(1, Math.min(cur, Math.ceil((ST.rem * ST.V0) / ST.N))) : 0;
  const nStay = cur - visAfter, from = ST.stayers.length;
  for (let k = 0; k < nStay; k++) ST.stayers.push(q.sold.pop()); // the rear rows drop out
  ST.perStep[i] = nStay;
  if (nStay) layoutStep(i, from, nStay);
  ST.reached = i; ST.mult = MULTS[i];
  const wz = ST.z0 + i * SD;
  ST.hi.position.set(0, (i + 1) * SH + 0.03, i * SD + SD / 2); ST.hi.visible = true; ST.hiT = 1;
  ST.hi.material.color.setHex(0xffffff);
  C.burst(0, (i + 1) * SH + 0.3, wz + 0.3, COLORS[i], 12, 5, 0.7, 12, 4);
  C.sfx.play('pop'); C.vibrate(10);
  if (ST.rem <= 0) {
    C.floatText(multText(MULTS[i]), 'gold');
    ST.phase = 'end'; ST.endT = 0; ST.target = ST.z0 + stepCenter(i);
    const top = i === NST - 1;
    C.confetti(0, wz + 1, top ? 160 : 90);
    C.sfx.play(top ? 'upgrade' : 'good');
    if (top) { C.toast('MAKSİMUM ' + multText(MULTS[i]) + '!'); C.pulse('good'); }
  }
}

// returns true once the finale is over and the win panel should open
export function stairsUpdate(dt) {
  const S = C.S, q = C.squad, LV = C.getLV();
  if (!ST.active) startStairs();
  ST.T += dt;
  const b = LV.boss;
  if (!LV.bonus) {
    // the fallen boss shrinks away so it does not lie across the steps
    if (b.state === 'dead' && b.t > 0.8) b.group.scale.setScalar(b.s * Math.max(0.001, 1 - (b.t - 0.8) * 2.6));
    if (ST.rise < 1 && ST.T > 0.4) {
      if (ST.rise === 0) { S.shake = Math.max(S.shake, 0.35); C.sfx.play('break'); }
      ST.rise = Math.min(1, ST.rise + dt / 0.5);
      const r = ST.rise, k = 1 + 2.2 * Math.pow(r - 1, 3) + 1.2 * Math.pow(r - 1, 2); // ease-out-back
      ST.group.position.y = -(1 - k) * (NST * SH + 1);
    }
    if (ST.phase === 'wait' && ST.T > 0.75) ST.phase = 'run';
  }
  if (ST.phase === 'run') {
    const v = ST.head < ST.z0 ? 15 : 10;
    ST.head = Math.min(ST.target, ST.head + v * dt);
    while (ST.phase === 'run' && ST.next < NST && ST.head >= ST.z0 + stepCenter(ST.next) - 0.25) reachStep(ST.next++);
  } else if (ST.phase === 'end') {
    ST.endT += dt;
    ST.head += (ST.target - ST.head) * Math.min(1, dt * 6);
  }
  q.z = ST.head; q.tx = 0; q.x += (0 - q.x) * Math.min(1, dt * 5);
  if (ST.hiT > 0) { ST.hiT = Math.max(0, ST.hiT - dt * 2.2); ST.hi.material.opacity = ST.hiT * 0.65; ST.hi.visible = ST.hiT > 0; }
  // heights + stayers walking to their spots
  const ky = Math.min(1, dt * 16), kp = Math.min(1, dt * 7);
  for (const s of q.sold) s.sy += (stairTop(s.z) - s.sy) * ky;
  for (const s of ST.stayers) {
    s.x += (s.tx - s.x) * kp; s.z += (s.tz - s.z) * kp;
    s.sy += (stairTop(s.z) - s.sy) * ky;
    if (!s.arr && Math.abs(s.tz - s.z) < 0.12 && Math.abs(s.tx - s.x) < 0.12) s.arr = 1;
    if (s.arr) s.ry += (Math.PI - s.ry) * Math.min(1, dt * 6);
  }
  return ST.phase === 'end' && ST.endT > 0.95;
}

// pose of a climbing soldier (squad.sold) while the finale runs; result in POSE
export function stairsPose(s, t) {
  if (ST.phase === 'wait') { POSE.y = s.sy || 0; POSE.sw = 0; POSE.ry = 0; return POSE; }
  const p = Math.sin(t * 14 + s.ph);
  POSE.y = (s.sy || 0) + Math.abs(p) * 0.08; POSE.sw = p * 0.7; POSE.ry = 0;
  return POSE;
}
export function stairsDrawStayers(troop, t) {
  for (const s of ST.stayers) {
    if (s.arr) troop.push(s.x, s.sy + Math.abs(Math.sin(t * 7 + s.ph)) * 0.45, s.z, s.ry, 0.3, s.k);
    else { const p = Math.sin(t * 14 + s.ph); troop.push(s.x, s.sy + Math.abs(p) * 0.08, s.z, 0, p * 0.7, s.k); }
  }
}
export function stairsLabel(label) {
  label.sprite.visible = ST.rem > 0 && C.squad.sold.length > 0;
  if (!label.sprite.visible) return;
  label.set(ST.rem);
  label.sprite.position.set(C.squad.x, 2.0 + stairTop(C.squad.z), C.squad.z);
}
// camera targets while the finale runs (fills CAM, returns it)
export function stairsCam() {
  const q = C.squad, d = C.dims(Math.max(1, q.sold.length)), depth = ST.phase === 'end' ? 0 : Math.min(d.depth, 8);
  const h = Math.max(0, ST.group.position.y + (ST.reached + 1) * SH);
  CAM.px = 0; CAM.py = h + 7.4 + depth * 0.35; CAM.pz = ST.head - 9 - depth * 0.6;
  CAM.lx = 0; CAM.ly = h + 0.6; CAM.lz = ST.head + 6;
  if (ST.phase === 'end') { const n = Math.min(1, ST.perStep[ST.reached] / 60); CAM.py += 1.5 + n * 2; CAM.pz -= 3 + n * 3; CAM.lz -= 3; }
  return CAM;
}

// ============================================================ reward / UI
// the coin reward: normal levels are multiplied, gold runs pay their coins (+ a little) times the step
export function bonusReward(base, L) {
  const LV = C.getLV();
  const raw = LV && LV.bonus ? C.S.runCoins + 15 + L * 2 : base;
  return Math.round(raw * ST.mult);
}
export function bonusWinCard(L) {
  const LV = C.getLV(), el = document.getElementById('wMult');
  if (el) {
    el.classList.toggle('hidden', ST.reached < 0);
    el.querySelector('b').textContent = multText(ST.mult);
  }
  if (LV && LV.bonus) {
    document.getElementById('winSub').textContent = 'ALTIN KOŞUSU tamamlandı';
    document.getElementById('wColl').textContent = C.S.runCoins;
  }
}
export function bonusMenu(L) {
  const dots = document.getElementById('dots');
  if (dots && dots.children[4]) dots.children[4].classList.add('gold'); // 5th dot of every world
  if (!isBonusLevel(L)) return;
  document.getElementById('lvlPill').textContent = 'SEVİYE ' + L + ' · ALTIN KOŞUSU';
  document.getElementById('wLv').textContent = 'ALTIN KOŞUSU';
}
// start of a run: gold runs get their own splash; returns true if it handled the intro
export function bonusStart(L) {
  const sp = document.getElementById('splash');
  const small = sp && sp.querySelector('small');
  if (small) small.textContent = isBonusLevel(L) ? 'BONUS SEVİYE' : splashDefault;
  if (!isBonusLevel(L) || !sp) return false;
  sp.querySelector('b').textContent = 'ALTIN KOŞUSU';
  sp.classList.remove('go'); void sp.offsetWidth; sp.classList.add('go');
  C.sfx.play('upgrade');
  return true;
}
