// saws: how many soldiers die passing one saw, per army size, per parked x and per phase.
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, out = [];
    const run = (n, xpos, ph, speed) => {
      Object.assign(G.save, { level: 5, upStart: n - 1, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun();
      const LV = G.LV;
      for (const g of LV.gates) g.passed = true;
      for (const e of LV.enemies) e.alive = false;
      for (const bl of LV.blocks) bl.alive = false;
      LV.saws.length = 1; const sw = LV.saws[0]; sw.z = 40; sw.ph = ph; sw.speed = speed; sw.amp = 3.4;
      LV.coins.forEach((c) => (c.taken = true));
      G.squad.z = 20; G.squad.tx = xpos; G.squad.x = xpos;
      let t = 0; const c0 = G.S.count;
      while (G.squad.z < 62 && G.S.state === 'play' && t < 20) { G.squad.tx = xpos; G.step(1 / 60); t += 1 / 60; }
      return c0 - G.S.count;
    };
    for (const n of [1, 6, 20, 60, 150]) {
      for (const x of [-3.2, 0, 3.2]) {
        const ds = [];
        for (let k = 0; k < 8; k++) ds.push(run(n, x, k * 0.8, 1.15));
        out.push({ n, x, min: Math.min(...ds), mean: +(ds.reduce((a, b) => a + b) / ds.length).toFixed(1), max: Math.max(...ds) });
      }
    }
    return out;
  });
  console.table(r);
  await b.close();
})();
