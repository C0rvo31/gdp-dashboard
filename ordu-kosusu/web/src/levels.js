// Level layout + enemy definitions. Numbers (gate values, HP, group size) are
// finalised in main.js when an object comes into view, from the army's real strength.
import { clamp, mulberry32 } from './util.js';
import { themeFor } from './world.js';

// enemy behaviour per type (hp is per soldier, melee = how many of ours one of them takes down)
export const ETYPES = {
  raider: { hp: 1.0, shoots: false, speed: 4.5 },
  gunner: { hp: 1.0, shoots: true, rate: 0.2, bullet: 0xff4a3a, speed: 4 },
  nomad: { hp: 1.3, shoots: false, speed: 5.2 },
  bandit: { hp: 1.2, shoots: true, rate: 0.24, bullet: 0xffb347, speed: 4 },
  knight: { hp: 2.4, shoots: false, speed: 3.8 },
  frost: { hp: 1.5, shoots: true, rate: 0.24, bullet: 0x8fe3ff, speed: 4 },
  skeleton: { hp: 2.0, shoots: false, speed: 5.0 },
  demon: { hp: 2.2, shoots: true, rate: 0.28, bullet: 0xff7a1a, speed: 4 },
};

// ============================================================ level generation (layout only;
// numbers are decided when an object comes into view, from the army you actually have)
export function nice(v) { return v > 20 ? Math.round(v / 5) * 5 : Math.round(v); }
export function niceHp(v) { return v < 20 ? Math.round(v) : v < 100 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10; }
export function applyOp(op, n) {
  switch (op.k) {
    case 'add': return n + op.v;
    case 'sub': return n - op.v;
    case 'mul': return n * op.v;
    case 'div': return Math.ceil(n / op.v);
  }
  return n;
}
export const opText = (op) => ({ add: '+', sub: '−', mul: '×', div: '÷' }[op.k] + op.v);
export const isGood = (op) => op.k === 'add' || op.k === 'mul';
export function makeOp(d, n) {
  if (d.good) {
    if (d.mul && n < 25) return { k: 'mul', v: n < 6 && d.r2 < 0.5 ? 3 : 2 };
    return { k: 'add', v: nice(Math.max(3, n * (0.4 + d.r * 0.6) + 2 + d.r2 * 4)) };
  }
  if (n < 4 || (d.mul && n > 6)) return { k: 'div', v: n > 12 && d.r2 < 0.4 ? 3 : 2 };
  return { k: 'sub', v: Math.max(1, Math.min(Math.floor(n * 0.6), nice(Math.max(2, n * (0.25 + d.r * 0.3))))) };
}

export function genLevel(L) {
  const th = themeFor(L);
  const rnd = mulberry32(L * 7919 + 13);
  const R = (a, b) => a + (b - a) * rnd();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const chance = (p) => rnd() < p;
  const pick = (arr) => arr[RI(0, arr.length - 1)];
  const local = (L - 1) % 10 + 1, world = Math.floor((L - 1) / 10);
  const diff = Math.min(local + world * 2, 14);
  const spec = { th, gates: [], blocks: [], enemies: [], saws: [], coins: [] };

  const nSeg = 8 + Math.min(diff, 12);
  const plan = new Array(nSeg).fill(null);
  plan[0] = 'gate'; plan[1] = 'wcrate'; plan[2] = 'gate'; plan[3] = 'enemy';
  plan[Math.floor(nSeg * 0.55)] = 'wcrate';
  if (L >= 3) plan[Math.floor(nSeg * 0.8)] = 'wcrate';
  plan[nSeg - 2] = 'gate'; plan[nSeg - 1] = 'enemy';
  const pool = ['gate', 'gate', 'gate', 'enemy', 'enemy', 'wall', 'scrate'];
  if (L >= 2) pool.push('saw', 'wall');
  if (L >= 4) pool.push('saw', 'enemy');
  for (let i = 0; i < nSeg; i++) {
    if (plan[i]) continue;
    let t, guard = 0;
    do { t = pick(pool); } while (t === plan[i - 1] && t !== 'gate' && guard++ < 10);
    plan[i] = t;
  }
  const shooterChance = L < 2 ? 0 : Math.min(0.55, 0.3 + local * 0.025 + world * 0.05);

  let gateNo = 0, z = 26;
  for (const t of plan) {
    if (t === 'gate') {
      const mk = (good) => ({ good, mul: chance(0.4), r: rnd(), r2: rnd() });
      const a = mk(true), b = gateNo++ < 2 || chance(0.3) ? mk(true) : mk(false);
      spec.gates.push({ z, defs: chance(0.5) ? [a, b] : [b, a] });
      z += R(22, 27);
    } else if (t === 'enemy') {
      spec.enemies.push({ z: z + 4, xr: R(-1, 1), f: R(0.75, 1.35) * (1 + Math.min(L, 40) * 0.008), type: chance(shooterChance) ? th.shooter : th.melee });
      z += R(26, 30);
    } else if (t === 'wall') {
      const tf = () => R(1.0, 2.4);
      const layout = RI(0, 2);
      if (layout === 0) { const s = chance(0.5) ? -1 : 1; spec.blocks.push({ kind: 'wall', x: s * 2, z, w: 6, tf: tf() }); }
      else if (layout === 1) spec.blocks.push({ kind: 'wall', x: 0, z, w: 4, tf: tf() });
      else { spec.blocks.push({ kind: 'wall', x: -3.35, z, w: 3.3, tf: tf() }); spec.blocks.push({ kind: 'wall', x: 3.35, z, w: 3.3, tf: tf() }); }
      z += R(24, 28);
    } else if (t === 'wcrate' || t === 'scrate') {
      spec.blocks.push({ kind: t === 'wcrate' ? 'weapon' : 'soldier', x: pick([-2.6, 0, 2.6]), z, w: 1.5, tf: R(0.7, 1.25), vf: R(0.3, 0.5) });
      z += R(22, 26);
    } else if (t === 'saw') {
      const n = L >= 5 && chance(0.5) ? 2 : 1;
      for (let j = 0; j < n; j++) spec.saws.push({ z: z + j * 7, amp: 3.4, speed: R(0.9, 1.4) + Math.min(L, 15) * 0.025, ph: R(0, 6.28) });
      z += 22 + (n - 1) * 7;
    }
    if (chance(0.7)) {
      const cz = z - R(9, 12), cx = R(-3, 3), curve = R(-1.5, 1.5);
      for (let k = 0; k < 7; k++) spec.coins.push({ x: clamp(cx + Math.sin(k * 0.6) * curve, -4, 4), z: cz + k * 1.1 });
    }
  }
  spec.end = z;
  spec.bossLine = z + 6;
  spec.bossZ = spec.bossLine + 24;
  spec.speed = 8.6 + diff * 0.12;
  spec.hpMul = 1 + Math.min(L, 40) * 0.012;
  return spec;
}

