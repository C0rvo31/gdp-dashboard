const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(__dirname, '../web/dist/index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const SIM = (opts) => {
  const G = window.__G;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ap = (op, n) => op.k === 'add' ? n + op.v : op.k === 'sub' ? n - op.v : op.k === 'mul' ? n * op.v : Math.ceil(n / op.v);
  const out = [];
  for (const lv of opts.levels) {
    Object.assign(G.save, { level: lv, upStart: opts.up, upRate: opts.up, upDmg: opts.up });
    G.showMenu(); G.startRun();
    const LV = G.LV, S = G.S, q = G.squad;
    let t = 0, bossT = null, minC = 1e9;
    while (t < 200 && (S.state === 'play' || S.state === 'boss' || (S.state === 'win' && LV.boss.t < 0.1))) {
      const gate = LV.gates.find(g => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
      const crate = LV.blocks.find(b => b.alive && b.kind !== 'wall' && b.z > q.z && b.z - q.z < 26);
      const walls = LV.blocks.filter(b => b.alive && b.kind === 'wall' && b.z > q.z - G.dims(S.count).depth - 1 && b.z - q.z < 14);
      let tx = q.tx;
      if (gate) { const a = ap(gate.ops[0], S.count), b = ap(gate.ops[1], S.count); if (opts.dumb && gate.pick === undefined) gate.pick = Math.random() < 0.5;
        if (opts.human && gate.pick === undefined) gate.pick = Math.random() < 0.15 ? a < b : a >= b;  // misreads 15% of gates
        tx = (opts.dumb || opts.human ? gate.pick : a >= b) ? -2.6 : 2.6; }
      else if (crate) tx = crate.x;
      else { const en = LV.enemies.find(e => e.alive && e.armed && e.z > q.z - 1 && e.z - q.z < 30); if (en) tx = en.x; else if (S.state === 'boss') tx = LV.boss.x; }  // no aiming any more: stand in front of the target
      // lane planner (all bots dodge like a human would; only the random-gate bot guesses gates):
      // score candidate lanes by how much of the army would overlap each hazard while it passes
      const d = G.dims(S.count), hw = d.hw, v = q.speed, lim = Math.max(0, 5 - 0.35 - hw);
      const haz = [];
      for (const w of LV.saws) if (w.z > q.z - d.depth - 1 && w.z - q.z < 12) haz.push({ z: w.z, half: 0.35, k: 8, at: (tt) => { const x = (w.cx || 0) + Math.sin(tt * w.speed + w.ph) * w.amp; return [x - 0.7, x + 0.7]; } });
      for (const h of LV.hammers || []) if (h.z > q.z - d.depth - 1 && h.z - q.z < 12) haz.push({ z: h.z, half: 0.72, k: 8, at: (tt) => {
        const th = Math.sin(tt * h.speed + h.ph) * h.amp; if (8 - 7.3 * Math.cos(th) > 1.3) return null;
        const x = h.cx + 7.3 * Math.sin(th); return [x - 0.9, x + 0.9]; } });
      for (const sp of LV.spikes || []) if (sp.z > q.z - d.depth - 2 && sp.z - q.z < 13) for (const tl of sp.tiles) haz.push({ z: sp.z, half: sp.depth / 2, k: 16, at: (tt) => {
        const c = (((tt + tl.ph) % sp.period) + sp.period) % sp.period; return c < sp.up + 0.05 || c > sp.period - 0.06 ? [tl.x - 1.6, tl.x + 1.6] : null; } });
      const zFirst = Math.min(...haz.map((h) => h.z));
      const inside = haz.some((h) => h.z - h.half - 0.3 < q.z && h.z + h.half + 0.3 > q.z - d.depth);
      const cands = []; for (let k = 0; k <= 12; k++) cands.push(-lim + (2 * lim * k) / 12);
      const ov = (x, r) => r ? Math.max(0, Math.min(x + hw, r[1]) - Math.max(x - hw, r[0])) / (2 * hw) : 0;
      let best = clamp(tx, -lim, lim), bs = 1e9;
      for (const x of cands.concat([best])) {
        let sc = Math.abs(x - tx) * 0.12 + (inside ? Math.abs(x - q.x) * 0.6 : 0);  // don't swerve while inside a hazard
        for (const w of walls) if (Math.abs(x - w.x) < w.w / 2 + hw) sc += 3 + 4 * w.hp / Math.max(1, w.max);
        for (const r of LV.rollers || []) if (r.alive && r.z > q.z - d.depth - 1 && (r.z - q.z) / (v + (r.rolling ? r.speed : 0)) < 1.3 && Math.abs(x - r.x) < r.w / 2 + hw) sc += 1 + 2 * r.hp / Math.max(1, r.max);
        // coconut shadows: be clear of the ring when it lands (a human sees the shadow; human-ish bot reacts late)
        for (const c of LV.drops || []) if (c.state === 'warn') {
          const rem = Math.max(0, c.warn - c.t);
          if (opts.human && c.t < 0.35) continue;
          sc += 14 * ov(x + (q.x - x) * Math.exp(-12 * rem), [c.x - c.r - 0.2, c.x + c.r + 0.2]);
        }
        // boss area slam: the red ring is telegraphed ~1 s ahead, step out of it (human-ish bot reacts after 0.35 s)
        const bs0 = LV.boss;
        if (bs0.spOn && !(opts.human && bs0.spRem > 0.6)) sc += 14 * ov(x + (q.x - x) * Math.exp(-12 * bs0.spRem), [bs0.spX - bs0.spRx - 0.2, bs0.spX + bs0.spRx + 0.2]);
        // mud: slows the march, avoid when there's a free lane
        for (const m of LV.muds || []) if (m.z + m.depth / 2 > q.z - 1 && m.z - m.depth / 2 - q.z < 14) for (const tl of m.tiles) sc += 2 * ov(x, [tl.x - 1.6, tl.x + 1.6]);
        for (const hz of haz) {
          const t0 = (hz.z - hz.half - 0.3 - q.z) / v, t1 = (hz.z + hz.half + 0.3 + d.depth - q.z) / v;
          let o = 0; const N = 10;
          for (let k = 0; k <= N; k++) { const tt = Math.max(0, t0 + (t1 - t0) * k / N); o += ov(x + (q.x - x) * Math.exp(-12 * tt), hz.at(S.t + (opts.human ? Math.min(tt, 0.3) : tt))); }
          sc += hz.k * o / (N + 1) * (hz.z <= zFirst + 2.5 ? 1 : 0.3); // nearest hazard first, re-steer for the next
        }
        if (sc < bs) { bs = sc; best = x; }
      }
      tx = best;
      if (!opts.human || Math.round(t * 60) % 12 === 0) q.tx = tx;  // a human re-steers ~5x per second
      if (opts.trace && Math.round(t * 60) % 6 === 0 && (haz.length || walls.length)) out.push(`  t=${t.toFixed(1)} z=${q.z.toFixed(1)} x=${q.x.toFixed(2)} tx=${tx.toFixed(2)} n=${S.count} sc=${bs.toFixed(2)} ${JSON.stringify(S.deaths)}`);
      G.step(1 / 60); t += 1 / 60;
      if (opts.trace && S.fight && !S.fight.__seen) { S.fight.__seen = 1; out.push(`  FIGHT z=${q.z.toFixed(0)} ${S.fight.type} enemy=${S.fight.count} us=${S.count}`); }
      if (S.state === 'boss' && bossT === null) bossT = { t, count: S.count, w: S.weapon };
      if (opts.trace && S.state === "boss" && Math.round(t * 60) % 60 === 0) out.push(`  BOSS t=${t.toFixed(0)} n=${S.count} hp=${Math.round(LV.boss.hp)} bx=${LV.boss.x.toFixed(1)} qx=${q.x.toFixed(1)} st=${LV.boss.state}`);
      if (S.state === 'boss') minC = Math.min(minC, S.count);
    }
    if (opts.plan) out.push(`L${lv} plan: ${LV.spec.patterns.join(' ')}`);
    out.push(`L${lv}: ${S.state} t=${t.toFixed(0)}s count=${S.count} weapon=${S.weapon} atBoss=${bossT && bossT.count} bossHp=${Math.round(LV.boss.hp)}/${LV.boss.max} bossFight=${bossT ? (t - bossT.t).toFixed(1) : "-"}s deaths=${JSON.stringify(S.deaths)}`);
  }
  return out.join('\n');
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(DIST);
  await p.waitForTimeout(500);
  const lv = (process.env.LEVELS || '1,2,3,5,8,10,11,13,16,20,21,24,28,31,35,40').split(',').map(Number);
  console.log('--- smart bot, no upgrades'); console.log(await p.evaluate(SIM, { levels: lv, up: +(process.env.UP || 0), plan: !!process.env.PLAN, trace: !!process.env.TRACE }));
  console.log('--- smart bot, upgrades 4'); console.log(await p.evaluate(SIM, { levels: lv.filter((l,i)=>i%2==0), up: 4 }));
  const dl = (process.env.DUMB_LEVELS || '1,2,3,5,8,12,15,22,25,30,35,40').split(',').map(Number);
  if (process.env.HUMAN) { const hl = process.env.HUMAN.split(',').map(Number); for (let k = 0; k < +(process.env.RUNS || 1); k++) { console.log('--- human-ish bot (late reactions, 15% gate mistakes), no upgrades'); console.log(await p.evaluate(SIM, { levels: hl, up: 0, human: true })); } }
  console.log('--- random-gate bot, no upgrades'); console.log(await p.evaluate(SIM, { levels: dl, up: 0, dumb: true }));
  await b.close();
})();
