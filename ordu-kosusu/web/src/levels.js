// Level layout + enemy definitions. Numbers (gate values, HP, group size) are
// finalised in main.js when an object comes into view, from the army's real strength.
import { clamp, mulberry32 } from './util.js';
import { themeFor } from './world.js';

// enemy behaviour per type (hp is per soldier, melee = how many of ours one of them takes down)
export const ETYPES = {
  raider: { hp: 1.0, shoots: false, speed: 4.5 },
  gunner: { hp: 1.0, shoots: true, rate: 0.2, bullet: 0xff4a3a, speed: 4 },
  nomad: { hp: 1.2, shoots: false, speed: 5.8 },          // desert: fast, light riders
  bandit: { hp: 1.2, shoots: true, rate: 0.26, bullet: 0xffb347, speed: 4 },
  knight: { hp: 2.7, shoots: false, speed: 3.2 },          // snow: slow but very tough
  frost: { hp: 1.5, shoots: true, rate: 0.22, bullet: 0x8fe3ff, speed: 4 },
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
// d: { good, mul, r, r2, h (harshness 0..1 for bad gates), big (tempting gate: × even for bigger armies) }
export function makeOp(d, n) {
  if (d.good) {
    if (d.mul && n < (d.big ? 70 : 25)) return { k: 'mul', v: n < 6 && d.r2 < 0.5 ? 3 : 2 };
    if (d.big) return { k: 'add', v: nice(Math.max(5, n * (0.8 + d.r * 0.3) + 4)) };
    return { k: 'add', v: nice(Math.max(3, n * (0.4 + d.r * 0.6) + 2 + d.r2 * 4)) };
  }
  const h = d.h || 0;
  if (n < 4 || (d.mul && n > 6)) return { k: 'div', v: n > 12 && d.r2 < 0.3 + h * 0.4 ? 3 : 2 };
  return { k: 'sub', v: Math.max(1, Math.min(Math.floor(n * (0.6 + h * 0.15)), nice(Math.max(2, n * (0.25 + d.r * 0.3 + h * 0.2))))) };
}

// ---------- per-world flavour: share of shooters, enemy group size, which traps it likes
export const WORLD_FLAVOUR = [
  { shooter: 0.28, f: 1.0, traps: { saw: 1.0, hammer: 1.0, spikes: 0.5 } },                 // meadow: saws + hammers
  { shooter: 0.52, f: 0.92, traps: { spikes: 1.6, saw: 0.8, hammer: 0.6, roller: 0.5 } },   // desert: spike traps, bandit gunfire
  { shooter: 0.3, f: 1.0, traps: { roller: 1.7, hammer: 0.9, spikes: 0.6, saw: 0.5 } },     // snow: snowballs + tough knights
  { shooter: 0.45, f: 1.0, traps: { roller: 1.1, spikes: 1.1, hammer: 1.1, saw: 1.0 } },   // lava: everything
];
// heat inside each 10-level world: gentle start, spike at x5, breather at x6, showdown at x10
const HEAT = [0, 0, 0.8, 2.2, 3.4, 6.5, 3.6, 5.2, 6.4, 7.4, 9.5];
// when each mechanic first shows up (global level)
export const UNLOCK = { saw: 2, hammer: 4, spikes: 8, roller: 13 };

export function genLevel(L) {
  const th = themeFor(L);
  const rnd = mulberry32(L * 7919 + 13);
  const R = (a, b) => a + (b - a) * rnd();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const chance = (p) => rnd() < p;
  const pick = (arr) => arr[RI(0, arr.length - 1)];
  const local = (L - 1) % 10 + 1, world = Math.floor((L - 1) / 10);
  const W = WORLD_FLAVOUR[Math.min(world, WORLD_FLAVOUR.length - 1)];
  // worlds add a modest offset so the in-world curve (breather at x6, peaks at x5/x10) survives in later worlds
  const diff = Math.min(HEAT[local] + Math.min(world, 3) * 1.5, 15);
  const spec = { th, gates: [], blocks: [], enemies: [], saws: [], coins: [], hammers: [], spikes: [], rollers: [], patterns: [] };
  const has = (m) => L >= UNLOCK[m];
  const harsh = clamp((diff - 3) / 12, 0, 0.75);   // bad gates bite harder later, but one misread is never fatal on its own

  // ---------------------------------------------------------- pieces
  const coinLine = (z, x, n = 7, curve = R(-1.5, 1.5)) => {
    for (let k = 0; k < n; k++) spec.coins.push({ x: clamp(x + Math.sin(k * 0.6) * curve, -4, 4), z: z + k * 1.1 });
  };
  const gdef = (good, extra) => ({ good, mul: chance(0.4), r: rnd(), r2: rnd(), h: harsh, ...extra });
  const gate = (z, mode) => {
    let defs;
    if (mode === 'good') defs = [gdef(true), gdef(true)];
    else if (mode === 'bad') defs = [gdef(false, { mul: chance(0.3 + harsh * 0.4) }), gdef(false)]; // pick the lesser evil
    else defs = [gdef(true), gdef(false, { mul: chance(0.35 + harsh * 0.3) })];
    if (chance(0.5)) defs.reverse();
    spec.gates.push({ z, defs });
    return defs;
  };
  const shooterChance = L < 2 ? 0 : Math.min(0.62, W.shooter + local * 0.02 + world * 0.02);
  const enemy = (z, o = {}) => {
    const type = o.type || (chance(o.shoot ?? shooterChance) ? th.shooter : th.melee);
    const f = R(0.75, 1.3) * (1 + Math.min(L, 40) * 0.008) * W.f * (0.92 + diff * 0.008) * (o.f || 1);
    const early = z < 140 ? 0.72 : z < 230 ? 0.86 : 1;   // the army is still tiny in the opening stretch
    spec.enemies.push({ z, xr: o.xr ?? R(-1, 1), f: f * early, type });
  };
  const wall = (x, z, w, tf = R(1.0, 2.4)) => spec.blocks.push({ kind: 'wall', x, z, w, tf });
  const crate = (kind, x, z) => spec.blocks.push({ kind, x, z, w: 1.5, tf: R(0.7, 1.25), vf: R(0.3, 0.5) });
  const saw = (z, o = {}) => spec.saws.push({ z, amp: o.amp ?? 3.4, cx: o.cx || 0, speed: R(0.9, 1.4) + Math.min(L, 15) * 0.025, ph: o.ph ?? R(0, 6.28) });
  const hammer = (z, o = {}) => spec.hammers.push({ z, cx: o.cx || 0, amp: o.amp ?? R(0.55, 0.66), speed: (o.speed ?? R(1.5, 1.9)) + Math.min(diff, 12) * 0.04, ph: o.ph ?? R(0, 6.28) });
  // spike strip: tiles are 3.2 wide lanes (x = -3.33 / 0 / 3.33); phases are spread so one lane is always safe
  const spikes = (z, o = {}) => {
    const period = o.period ?? R(2.3, 2.6) - Math.min(diff, 12) * 0.015, up = o.up ?? 0.45;
    const lanes = o.lanes || [-3.33, 0, 3.33];
    const base = R(0, period), order = chance(0.5) ? [0, 1, 2] : [2, 1, 0];
    spec.spikes.push({ z, depth: 2.0, period, up, warn: 0.55,
      tiles: lanes.map((x, i) => ({ x, ph: o.ph ?? (base + order[i % 3] * period / 3) % period })) });
  };
  // rolling barrel / snowball / boulder: waits at z, starts rolling at the army when it gets close
  const roller = (x, z, o = {}) => spec.rollers.push({ x, z, speed: o.speed ?? R(4, 5.2) + Math.min(diff, 12) * 0.08, tf: o.tf ?? R(0.5, 1.1) });
  const lane = () => pick([-3.3, -1.65, 0, 1.65, 3.3]);
  const trapW = (m) => (has(m) ? W.traps[m] || 0 : 0);
  const pickTrap = (exclude) => {
    const opts = ['saw', 'hammer', 'spikes', 'roller'].filter((m) => m !== exclude && trapW(m) > 0);
    if (!opts.length) return null;
    let tot = 0; for (const m of opts) tot += trapW(m);
    let r = rnd() * tot; for (const m of opts) { r -= trapW(m); if (r <= 0) return m; }
    return opts[opts.length - 1];
  };
  // a single trap piece (used by intro / mixed patterns); returns length used
  const trapPiece = (m, z, gentle) => {
    if (m === 'saw') { saw(z); if (!gentle && L >= 5 && chance(0.5)) { saw(z + 7); return 29; } return 22; }
    if (m === 'hammer') { hammer(z, gentle ? { speed: 1.35, amp: 0.56 } : {}); if (!gentle && diff > 5 && chance(0.5)) { hammer(z + 8); return 30; } return 22; }
    if (m === 'spikes') { spikes(z + 2, gentle ? { period: 2.7, up: 0.42 } : {}); if (!gentle && diff > 6 && chance(0.45)) { spikes(z + 9); return 31; } return 24; }
    if (m === 'roller') {
      const n = gentle ? 1 : RI(2, diff > 8 ? 4 : 3);
      const used = [];
      for (let k = 0; k < n; k++) {
        let x, g = 0; do { x = lane(); } while (used.some((u) => Math.abs(u - x) < 1.6) && g++ < 8);
        used.push(x); roller(x, z + 12 + k * R(5, 8), gentle ? { speed: 3.6, tf: 0.5 } : {});
      }
      return 18 + n * 4;
    }
    return 0;
  };

  // ---------------------------------------------------------- patterns: hand-authored segments
  // each: min level, min heat, weight, build(z) -> new z
  const PATTERNS = {
    gate: { min: 1, heat: 0, w: 3, build: (z) => { gate(z, chance(0.25 - harsh * 0.15) ? 'good' : 'choice'); if (chance(0.6)) coinLine(z + 7, R(-3, 3)); return z + R(22, 26); } },
    fight: { min: 1, heat: 0, w: 2.2, build: (z) => { enemy(z + 4); if (chance(0.5)) coinLine(z - 8, R(-3, 3)); return z + R(26, 30); } },
    // gate right before an enemy group: the choice decides the fight
    gateFight: { min: 2, heat: 0.5, w: 2.2, build: (z) => { gate(z, 'choice'); enemy(z + 15, { f: TRAPPY[prevK] ? 0.9 : 1.12 }); return z + 15 + R(25, 28); } },
    // wall corridor with a weapon crate waiting behind it
    armory: { min: 3, heat: 1, w: 1.0, build: (z) => {
      const tf = R(1.2, 2.0);
      wall(-3.35, z, 3.3, tf); wall(3.35, z, 3.3, tf); wall(-3.35, z + 6, 3.3, tf); wall(3.35, z + 6, 3.3, tf);
      coinLine(z - 3, 0, 9, 0); crate(chance(0.6) ? 'weapon' : 'soldier', 0, z + 13);
      return z + 13 + R(22, 25);
    } },
    wall: { min: 1, heat: 0, w: 1.4, build: (z) => {
      const layout = RI(0, 2);
      if (layout === 0) { const s = chance(0.5) ? -1 : 1; wall(s * 2, z, 6); coinLine(z - 10, -s * 3.3, 7, 0.4); }
      else if (layout === 1) wall(0, z, 4);
      else { wall(-3.35, z, 3.3); wall(3.35, z, 3.3); }
      return z + R(24, 28);
    } },
    // full-width breach: no way around, one weak brick section, soldiers waiting behind it
    breach: { min: 6, heat: 4, pos: 0.4, w: 0.9, build: (z) => {
      const weak = RI(0, 2);
      [-3.35, 0, 3.35].forEach((x, i) => wall(x, z, 3.3, i === weak ? R(0.55, 0.8) : R(1.6, 2.4)));
      crate('soldier', [-3.35, 0, 3.35][weak] * 0.75, z + 9);
      return z + 9 + R(22, 25);
    } },
    crates: { min: 2, heat: 0, w: 1.0, build: (z) => {
      if (L >= 4 && chance(0.5)) { const s = chance(0.5) ? -1 : 1; crate('weapon', s * 2.6, z); crate('soldier', -s * 2.6, z); }
      else crate('soldier', pick([-2.6, 0, 2.6]), z);
      return z + R(22, 26);
    } },
    // two or three saws in a row with a coin trail weaving through
    sawGauntlet: { min: 5, heat: 2, w: 1.0, tw: 'saw', build: (z) => {
      const ph = R(0, 6.28);
      for (let j = 0; j < 2; j++) saw(z + j * 9, { ph: ph + j * 2.1 });
      for (let j = 0; j < 2; j++) coinLine(z - 2 + j * 9, j % 2 ? 3.2 : -3.2, 4, 0);
      return z + 31;
    } },
    // tempting big gate, but the hazard sits right on its side of the road
    tempt: { min: 4, heat: 1.5, w: 1.1, build: (z) => {
      const gz = z + 9;
      const good = gdef(true, { mul: true, big: true }), meh = gdef(true, { mul: false, r: R(0, 0.25), r2: 0 });
      const left = chance(0.5);
      spec.gates.push({ z: gz, defs: left ? [good, meh] : [meh, good] });
      const sx = left ? -2.6 : 2.6;
      const g = pickTrap('roller') || 'hammer';
      if (g === 'spikes') spikes(gz - 4, { lanes: [left ? -3.33 : 3.33], period: R(1.9, 2.2), up: 0.7 });
      else if (g === 'saw') saw(gz - 4, { cx: sx * 0.9, amp: 1.5 });
      else hammer(gz - 4, { cx: sx * 0.95, amp: 0.3, speed: R(1.8, 2.2) });
      return gz + R(22, 26);
    } },
    hammerRow: { min: 4, heat: 1, w: 1.0, tw: 'hammer', build: (z) => {
      const n = diff > 3 && chance(0.6) ? 2 : 1, ph = R(0, 6.28);
      for (let j = 0; j < n; j++) hammer(z + j * 8, { ph: ph + j * Math.PI * 0.5 });
      coinLine(z - 4, 0, 5, 0);
      return z + 22 + (n - 1) * 8;
    } },
    spikeField: { min: 8, heat: 1, w: 1.0, tw: 'spikes', build: (z) => {
      const n = diff > 4 && chance(0.55) ? 2 : 1;
      for (let j = 0; j < n; j++) spikes(z + 2 + j * 7);
      coinLine(z - 6, R(-3, 3), 5);
      return z + 24 + (n - 1) * 7;
    } },
    rollerAlley: { min: 13, heat: 1, w: 1.0, tw: 'roller', build: (z) => z + trapPiece('roller', z, false) },
    // soldiers + an ambush: melee charge with gunners right behind
    ambush: { min: 5, heat: 4, pos: 0.3, w: 1.0, build: (z) => {
      crate('soldier', pick([-2.6, 2.6]), z);
      enemy(z + 18, { type: th.melee, f: 0.8 }); enemy(z + 27, { type: th.shooter, f: 0.75 });
      return z + 27 + R(26, 29);
    } },
    // mixed gauntlet: two different traps back to back
    gauntlet: { min: 9, heat: 5, pos: 0.3, w: 1.0, build: (z) => {
      const a = pickTrap(), b = pickTrap(a) || a;
      z += trapPiece(a, z, false) - 6;
      return z + trapPiece(b, z, false);
    } },
    // a trap right in front of an enemy group: dodge, then fight
    trapFight: { min: 6, heat: 3, w: 1.0, build: (z) => {
      const m = pickTrap('roller') || 'saw';
      z += trapPiece(m, z, true) - 4;
      enemy(z + 4, { f: 0.8 }); return z + R(27, 30);   // sized before the trap: keep it fair
    } },
  };

  // ---------------------------------------------------------- plan
  const segs = Math.round(7 + Math.min(diff, 12) * 0.95);
  const plan = ['gate:good', 'crate:weapon', 'gate'];
  if (local >= 2 || world > 0) plan.push('fight'); else plan.push('gate');
  // newly unlocked mechanic: a gentle solo introduction early in the level
  const fresh = ['hammer', 'spikes', 'roller'].find((m) => L === UNLOCK[m] || L === UNLOCK[m] + 1);
  const signature = local <= 2 && world > 0 ? ['spikes', 'roller', 'hammer'][world - 1] : null;
  if (fresh || signature) plan.push('intro:' + (fresh || signature));
  const prevTrap = (p) => (PATTERNS[p] && PATTERNS[p].tw) || (p && p.startsWith('intro') ? 'x' : null);
  const fill = segs - 2;
  let last = plan[plan.length - 1];
  const used = {};
  const GATEY = { gate: 1, gateFight: 1, tempt: 1 };
  const WALLY = { wall: 1, armory: 1, breach: 1 };
  const TRAPPY = { sawGauntlet: 1, hammerRow: 1, spikeField: 1, rollerAlley: 1, gauntlet: 1, trapFight: 1, tempt: 1 };
  const wantTraps = L < UNLOCK.hammer ? 0 : Math.min(5, 1 + Math.floor(diff / 3));
  let traps = 0;
  while (plan.length < fill) {
    const i = plan.length;
    if (i === Math.floor(fill * 0.5) || (L >= 3 && i === Math.floor(fill * 0.8))) { plan.push('crate:weapon'); last = 'crate'; continue; }
    const needGate = !plan.slice(-3).some((q) => GATEY[q.split(':')[0]]);
    const opts = [];
    let tot = 0;
    for (const k in PATTERNS) {
      const p = PATTERNS[k];
      // hard patterns only once the army had a chance to grow: allowed heat ramps up along the level
      if (p.min > L || p.heat > diff * (0.3 + 0.7 * i / fill) + 0.5 || k === last) continue;
      // the finale's groups are sized ~85 units ahead: no big fight right before it
      if (i >= fill - 2 && (k === 'ambush' || k === 'trapFight' || k === 'gateFight')) continue;
      if (p.tw && trapW(p.tw) === 0) continue;
      if (TRAPPY[k] && (TRAPPY[last] || prevTrap(last))) continue;   // a breather between trap sections
      if (WALLY[k] && WALLY[last]) continue;
      if (p.pos && i / fill < p.pos) continue;                       // heavy pieces wait until the army has grown
      if (needGate && !GATEY[k]) continue;                           // economy: a gate at least every 3 segments                          // ...and between wall sections
      // running short on traps for this level's quota: only trap patterns qualify
      if (wantTraps - traps >= fill - i - 1 && !TRAPPY[k]) continue;
      let w = p.w * (p.tw ? trapW(p.tw) : 1) * Math.pow(0.45, used[k] || 0);
      if (p.heat > 0) w *= 0.6 + Math.min(diff, 10) * 0.08;  // hotter levels lean on harder patterns
      opts.push([k, w]); tot += w;
    }
    if (!opts.length) { plan.push('gate'); last = 'gate'; continue; }
    let r = rnd() * tot, k = opts[opts.length - 1][0];
    for (const [kk, w] of opts) { r -= w; if (r <= 0) { k = kk; break; } }
    plan.push(k); last = k;
    used[k] = (used[k] || 0) + 1;
    if (TRAPPY[k]) traps++;
  }
  // finale before the boss: x10 is a showdown, otherwise a gate decides the last fight
  if (local === 10) plan.push('gate:good', 'showdown');
  else if (local === 5) plan.push('gate', 'ambushEnd');
  else plan.push('gateFight');

  let z = 26, prevK = null;
  for (const p of plan) {
    const [k, arg] = p.split(':');
    spec.patterns.push(p);
    if (k === 'gate' && arg) { gate(z, arg); z += R(22, 26); }
    else if (k === 'crate') { crate(arg, pick([-2.6, 0, 2.6]), z); if (chance(0.5)) coinLine(z - 10, R(-3, 3)); z += R(22, 26); }
    else if (k === 'intro') { z += trapPiece(arg, z, true); coinLine(z - 12, R(-3, 3), 5); }
    else if (k === 'showdown') {
      crate('soldier', pick([-2.6, 2.6]), z); z += 18;
      enemy(z, { type: th.melee, f: 1.05, xr: 0 }); enemy(z + 10, { type: th.shooter, f: 0.7 });
      z += 10 + R(28, 30);
    } else if (k === 'ambushEnd') { enemy(z + 4, { type: th.melee, f: 0.9 }); enemy(z + 13, { type: th.shooter, f: 0.7 }); z += 13 + R(27, 30); }
    else z = PATTERNS[k].build(z);
    prevK = k;
  }
  spec.end = z;
  spec.bossLine = z + 6;
  spec.bossZ = spec.bossLine + 24;
  spec.speed = 8.6 + Math.min(diff, 14) * 0.12;
  spec.hpMul = 1 + Math.min(L, 40) * 0.012;
  return spec;
}
