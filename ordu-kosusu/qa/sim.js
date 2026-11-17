const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(__dirname, '../web/dist/index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const SIM = (opts) => {
  const G = window.__G;
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
      const walls = LV.blocks.filter(b => b.alive && b.kind === 'wall' && b.z > q.z - 1 && b.z - q.z < 14);
      let tx = q.tx;
      if (gate) { const a = ap(gate.ops[0], S.count), b = ap(gate.ops[1], S.count); tx = (opts.dumb ? Math.random() < 0.5 : a >= b) ? -2.6 : 2.6; }
      else if (crate) tx = crate.x;
      if (walls.length) {
        const free = [-3.6, -1.8, 0, 1.8, 3.6].filter(x => walls.every(w => Math.abs(x - w.x) > w.w / 2 + 0.6));
        if (free.length) { free.sort((a, b) => Math.abs(a - q.x) - Math.abs(b - q.x)); tx = free[0]; }
      }
      const saw = LV.saws.find(w => w.z > q.z - 0.5 && w.z - q.z < 9);
      if (saw && !opts.dumb) {
        const ta = (saw.z - q.z) / q.speed;
        const sx = Math.sin((S.t + ta) * saw.speed + saw.ph) * saw.amp;
        const c = [-3.6, -1.8, 0, 1.8, 3.6].sort((a, b) => Math.abs(b - sx) - Math.abs(a - sx));
        tx = c[0];
      }
      q.tx = tx;
      G.step(1 / 60); t += 1 / 60;
      if (S.state === 'boss' && bossT === null) bossT = { t, count: S.count, w: S.weapon };
      if (S.state === 'boss') minC = Math.min(minC, S.count);
    }
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
  console.log('--- smart bot, no upgrades'); console.log(await p.evaluate(SIM, { levels: lv, up: 0 }));
  console.log('--- smart bot, upgrades 4'); console.log(await p.evaluate(SIM, { levels: lv.filter((l,i)=>i%2==0), up: 4 }));
  console.log('--- random-gate bot, no upgrades'); console.log(await p.evaluate(SIM, { levels: [1, 2, 3, 5, 8, 12, 22], up: 0, dumb: true }));
  await b.close();
})();
