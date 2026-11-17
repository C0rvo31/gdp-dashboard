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
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(DIST);
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const G = window.__G;
    window.__run = (L, cond, extra) => {
      G.save.level = L; G.showMenu(); G.startRun();
      if (extra) extra(G);
      const S = G.S, q = G.squad, LV = G.LV;
      for (let t = 0; t < 90 && (S.state === 'play' || S.state === 'boss'); t += 1 / 60) {
        if (cond(G)) return true;
        const gate = LV.gates.find(g => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
        if (gate) q.tx = (gate.ops[0].k === 'add' || gate.ops[0].k === 'mul') ? -2.6 : 2.6;
        G.step(1 / 60);
      }
      return false;
    };
  });
  const enemyNear = 'G => G.LV.enemies.some(e => e.alive && e.armed && e.z - G.squad.z < 17 && e.z - G.squad.z > 9)';
  for (const L of [1, 11, 21, 31, 41, 51]) {
    const ok = await p.evaluate(`window.__run(${L}, ${enemyNear}, G => { G.S.count = 60; })`);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/w${L}.png` });
    console.log(L, ok, await p.evaluate(() => JSON.stringify({ st: window.__G.S.state, c: window.__G.S.count, types: window.__G.LV.enemies.map(e => e.type).join(',') })));
  }
  // boss scenes for desert and lava
  for (const L of [11, 31, 51]) {
    await p.evaluate(`window.__run(${L}, G => G.S.state === 'boss' && G.LV.boss.state === 'attack', G => { G.S.count = 80; G.setWeapon(4); for (const e of G.LV.enemies) e.alive = false; G.squad.z = G.LV.bossLine - 2; })`);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/b${L}.png` });
  }
  await b.close();
})();
