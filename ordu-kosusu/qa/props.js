// Props close-ups: gates, weapon / soldier crates with floating models, walls, coins, gold-run gems -> out/props-*.png
const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(__dirname, '../web/dist/index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  let bad = 0;
  p.on('pageerror', e => { bad++; console.log('PAGEERR', e.message); });
  p.on('console', m => { if (m.type() === 'error') { bad++; console.log('CONSOLE', m.text()); } });
  await p.goto(DIST);
  await p.waitForTimeout(800);
  const LEVELS = (process.env.LEVELS || '1,11,21,31,41').split(',').map(Number);
  for (const L of LEVELS) {
    // run (steering gates, bots skip enemies by being strong) until the first kind of object is close, shoot a shot of it
    for (const kind of ['gate', 'weapon', 'soldier', 'wall']) {
      const ok = await p.evaluate(({ L, kind }) => {
        const G = window.__G;
        G.save.level = L; G.showMenu(); G.startRun();
        const S = G.S, q = G.squad, LV = G.LV;
        S.count = 40;
        let tgt = kind === 'gate' ? LV.gates[0] : LV.blocks.find(bk => bk.kind === kind);
        if (!tgt && kind === 'soldier') { tgt = LV.blocks.find(bk => bk.kind === 'weapon'); if (tgt) { tgt.kind = 'soldier'; tgt.vf = 0.5; } } // force one
        if (!tgt) return false;
        q.z = tgt.z - 12; q.x = q.tx = 0;
        for (let i = 0; i < 30; i++) G.step(1 / 60);
        S.count = 40;
        S.freeCam = true;
        const cx = kind === 'gate' ? 0 : tgt.x;
        G.camera.position.set(cx, 3.2, tgt.z - 6.5); G.camera.lookAt(cx, 1.4, tgt.z); G.camera.updateMatrixWorld();
        return true;
      }, { L, kind });
      if (!ok) { console.log(L, kind, 'not found'); continue; }
      await p.evaluate(() => { for (let i = 0; i < 10; i++) window.__G.step(1 / 60); });
      await p.waitForTimeout(3500);
      await p.screenshot({ path: `${OUT}/props-${L}-${kind}.png` });
      console.log(L, kind, 'ok');
    }
  }
  // gold run gems + coins
  await p.evaluate(() => {
    const G = window.__G; G.save.level = 5; G.showMenu(); G.startRun();
    const S = G.S; for (let i = 0; i < 60 * 6 && S.state === 'play'; i++) G.step(1 / 60);
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/props-gems.png` });
  console.log('errors', bad);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
