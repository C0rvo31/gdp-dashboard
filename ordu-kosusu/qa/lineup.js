const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(__dirname, '../web/dist/index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 260, height: 300 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(DIST);
  await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.ui{display:none!important}' });
  const setup = (w) => {
    const G = window.__G; G.S.freeCam = true; G.setWeapon(w);
    G.squad.sold.length = 0; G.S.count = 2;
    G.squad.sold.push({ x: -0.45, z: 0, k: 1, ph: 0, jx: 0, jz: 0 }, { x: 0.45, z: 0.6, k: 1, ph: 1, jx: 0, jz: 0 });
    G.squad.x = 0; G.squad.z = 0;
    for (const e of G.LV.enemies) e.alive = false;
    const c = G.camera; c.position.set(1.2, 1.25, 2.6); c.lookAt(0, 0.65, 0.2);
  };
  for (let w = 0; w < 5; w++) {
    await p.evaluate(setup, w);
    await p.evaluate(() => { const s = window.__G.squad.sold; s[0].x = -0.45; s[0].z = 0; s[1].x = 0.45; s[1].z = 0.6; });
    await p.waitForTimeout(350);
    await p.screenshot({ path: `${OUT}/t${w}.png` });
  }
  const types = [['raider', 1], ['gunner', 2], ['nomad', 11], ['bandit', 12], ['knight', 21], ['frost', 22], ['skeleton', 31], ['demon', 32]];
  for (const [type, L] of types) {
    await p.evaluate(({ type, L }) => {
      const G = window.__G; G.save.level = L; G.showMenu(); G.S.freeCam = true;
      const e = G.LV.enemies.find(g => g.type === type) || G.LV.enemies[0];
      for (const g of G.LV.enemies) { g.alive = g === e; }
      e.type = type; e.troop = e.troop; e.armed = true; e.alive = true; e.x = 0; e.z = 3; e.count = 2; e.sold.length = 0;
      e.sold.push({ x: -0.45, z: 3, k: 1, ph: 0, jx: 0, jz: 0 }, { x: 0.45, z: 3.6, k: 1, ph: 1, jx: 0, jz: 0 });
      e.label.sprite.visible = false;
      G.squad.sold.length = 0; G.S.count = 0;
      const c = G.camera; c.position.set(-1.2, 1.25, 0.4); c.lookAt(0, 0.65, 3.2);
      window.__fixE = () => { e.sold[0].x = -0.45; e.sold[0].z = 3; e.sold[1].x = 0.45; e.sold[1].z = 3.6; e.x = 0; e.z = 3; };
    }, { type, L });
    await p.evaluate(() => window.__fixE());
    await p.waitForTimeout(350);
    await p.screenshot({ path: `${OUT}/e-${type}.png` });
  }
  await b.close();
})();
