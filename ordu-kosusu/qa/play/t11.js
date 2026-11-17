// boss fight duration per weapon tier (fixed army, army kept in the boss lane) and per upgrade level. usage: node qa/play/t11.js
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad, out = [];
    for (const L of [1, 11, 21, 31]) for (const n of [30, 100]) for (const up of [0, 6]) for (const w of [0, 1, 2, 3, 4]) {
      Object.assign(G.save, { level: L, upStart: n - 1, upRate: up, upDmg: up }); G.showMenu(); G.startRun();
      const LV = G.LV; G.setWeapon(w);
      for (const g of LV.gates) g.passed = true;
      for (const e of LV.enemies) e.alive = false;
      for (const bl of LV.blocks) bl.alive = false;
      LV.saws.length = 0; if (LV.hammers) LV.hammers.length = 0; if (LV.spikes) LV.spikes.length = 0; (LV.rollers || []).forEach((r) => (r.alive = false));
      q.z = LV.bossLine - 1; let t = 0, t0 = null;
      while (t < 90 && (S.state === 'play' || S.state === 'boss')) { q.tx = LV.boss.x; G.step(1 / 60); t += 1 / 60; if (S.state === 'boss' && t0 === null) t0 = t; }
      out.push({ L, boss: LV.boss.name, hp: LV.boss.max, army: n, upg: up, tier: w, end: S.state, fight: t0 === null ? '-' : +(t - t0).toFixed(1), left: S.count });
    }
    return out;
  });
  console.table(r);
  await b.close();
})();
