// Screenshots of the trap mechanics (pendulum hammer, spike strip, rolling barrel/snowball/boulder).
const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(__dirname, '../web/dist/index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(DIST);
  await p.waitForTimeout(800);
  // [name, level, condition on G]
  const shots = [
    ['hammer', 5, 'G => G.LV.hammers.some(h => h.z - G.squad.z < 11 && h.z - G.squad.z > 6 && h.hy < 2.5)'],
    ['spikes', 11, 'G => G.LV.spikes.some(s => s.z - G.squad.z < 10 && s.z - G.squad.z > 6 && s.tiles.some(t => t.st === 2))'],
    ['barrel', 14, 'G => G.LV.rollers.some(r => r.rolling && r.alive && r.z - G.squad.z < 13 && r.z - G.squad.z > 8)'],
    ['snowball', 22, 'G => G.LV.rollers.some(r => r.rolling && r.alive && r.z - G.squad.z < 13 && r.z - G.squad.z > 8)'],
    ['boulder', 33, 'G => G.LV.rollers.some(r => r.rolling && r.alive && r.z - G.squad.z < 13 && r.z - G.squad.z > 8)'],
    ['coconut', 41, 'G => G.LV.drops.some(c => c.state === "warn" && c.t > c.warn - 0.25)'],
    ['log', 47, 'G => G.LV.rollers.some(r => r.rolling && r.alive && r.z - G.squad.z < 13 && r.z - G.squad.z > 8)'],
    ['mud', 42, 'G => G.LV.muds.some(m => m.z - G.squad.z < 10 && m.z - G.squad.z > 4)'],
  ];
  for (const [name, L, cond] of shots) {
    const res = await p.evaluate(`(() => {
      const G = window.__G, cond = ${cond};
      G.save.level = ${L}; G.showMenu(); G.startRun();
      const S = G.S, q = G.squad, LV = G.LV;
      S.count = 36;
      for (let t = 0; t < 90 && S.state === 'play'; t += 1 / 60) {
        if (cond(G)) return { ok: true, t, z: q.z, n: S.count };
        const gate = LV.gates.find(g => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
        if (gate) q.tx = (gate.ops[0].k === 'add' || gate.ops[0].k === 'mul') ? -2.6 : 2.6;
        if (S.count < 30) S.count = 36;
        G.step(1 / 60);
      }
      return { ok: false, st: S.state };
    })()`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/trap-${name}.png` });
    console.log(name, L, JSON.stringify(res));
  }
  await b.close();
})();
