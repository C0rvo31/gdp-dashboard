// dodging melee / shooter groups; shooter lethality; group never fought leaves behind
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad, out = [];
    const mk = (L, n, type, cnt, gx) => {
      Object.assign(G.save, { level: L, upStart: n - 1, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun();
      const LV = G.LV;
      for (const g of LV.gates) g.passed = true; for (const bl of LV.blocks) bl.alive = false; LV.saws.length = 0;
      LV.enemies.forEach((e, i) => { if (i) e.alive = false; });
      const e = LV.enemies[0];
      const info = { raider: [1, false, 4.5], gunner: [1, true, 4], demon: [2.2, true, 4], skeleton: [2, false, 5] }[type];
      e.type = type; e.T = { hp: info[0], shoots: info[1], speed: info[2], rate: type === 'demon' ? 0.28 : 0.2, bullet: 0xff0000 };
      e.z = 70; e.f = cnt / n * 1 ; q.z = 40; G.step(0.001); e.count = cnt; e.x = gx;
      return e;
    };
    // melee dodge
    for (const n of [1, 6, 30, 100]) for (const side of [-1, 1]) {
      const e = mk(1, n, 'raider', n, 3.5 * side * -1); // group on opposite side of where army stands
      let t = 0, fought = false;
      while (t < 12 && S.state === 'play') { q.tx = 3.5 * side; G.step(1 / 60); t += 1 / 60; if (S.fight) fought = true; }
      out.push({ test: 'melee-dodge', n, armyX: 3.5 * side, groupLeft: e.alive ? e.count : 0, fought, armyLeft: S.count });
    }
    // shooters: army in front vs at edge
    for (const n of [6, 30, 100]) for (const mode of ['center', 'edge']) {
      const e = mk(6, n, 'gunner', n, 0);
      let t = 0; const c0 = S.count;
      while (t < 9 && S.state === 'play' && e.alive) { q.tx = mode === 'center' ? 0 : 3.2; G.step(1 / 60); t += 1 / 60; }
      out.push({ test: 'shooters ' + mode, n, deathsShot: S.deaths.shot || 0, enemyState: e.state, enemyLeft: e.alive ? e.count : 0, armyLeft: S.count, t: +t.toFixed(1) });
    }
    return out;
  });
  console.table(r);
  await b.close();
})();
