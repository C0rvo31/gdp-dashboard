// HUD checks: weapon badge, crate label with HASAR, popup, boss bar number
const { open, OUT } = require('./h');
(async () => {
  const { b, p } = await open();
  await p.evaluate(() => {
    const G = window.__G, q = G.squad; Object.assign(G.save, { level: 3, upStart: 19, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun();
    for (const g of G.LV.gates) g.passed = true;
    q.z = 30; for (let i = 0; i < 80; i++) G.step(1 / 60);
  });
  await p.screenshot({ path: OUT + '/play_hud_crate.png' });
  await p.evaluate(() => {
    const G = window.__G, q = G.squad, LV = G.LV;
    const c = LV.blocks.find((x) => x.kind === 'weapon' && x.alive); q.z = c.z - 4; q.tx = -c.x;
    for (let i = 0; i < 200; i++) { q.tx = -c.x; G.step(1 / 60); if (!c.alive) break; }
  });
  await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/play_hud_popup.png' });
  await p.evaluate(() => {
    const G = window.__G, q = G.squad, LV = G.LV;
    for (const e of LV.enemies) e.alive = false; for (const bl of LV.blocks) bl.alive = false;
    q.z = LV.bossLine - 1; for (let i = 0; i < 300; i++) { q.tx = LV.boss.x; G.step(1 / 60); }
  });
  await p.screenshot({ path: OUT + '/play_hud_boss.png' });
  console.log(await p.evaluate(() => document.getElementById('bossBar').textContent + ' | ' + document.getElementById('wBadge').textContent));
  await b.close();
})();
