// enemy groups: melee exchange ratios, shooters, dodging, label numbers, stale sizing
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad, out = { melee: [], dodge: [], shooter: [], sized: [] };
    const iso = (L, n, extra = {}) => {
      Object.assign(G.save, { level: L, upStart: n - 1, upRate: extra.up || 0, upDmg: extra.up || 0 }); G.showMenu(); G.startRun();
      const LV = G.LV;
      for (const g of LV.gates) g.passed = true;
      for (const bl of LV.blocks) bl.alive = false;
      LV.saws.length = 0; LV.coins.forEach((c) => (c.taken = true));
      LV.enemies.forEach((e, i) => { if (i > 0) e.alive = false; });
      return LV;
    };
    // 1) melee group of size ratio f vs army n, level L (hp mult). where army never moves and no gates.
    for (const L of [1, 11, 21, 31, 36]) for (const n of [5, 30, 120]) for (const f of [0.75, 1.0, 1.35]) {
      const LV = iso(L, n);
      const e = LV.enemies[0];
      // force melee type of the world
      const melee = ['raider', 'nomad', 'knight', 'skeleton'][Math.floor((L - 1) / 10) % 4];
      const T = { raider: 1.0, nomad: 1.3, knight: 2.4, skeleton: 2.0 };
      e.type = melee; e.T = { hp: T[melee], shoots: false, speed: { raider: 4.5, nomad: 5.2, knight: 3.8, skeleton: 5.0 }[melee] };
      e.troop = e.troop; e.f = f * (1 + Math.min(L, 40) * 0.008); e.z = 60;
      q.z = 30; let t = 0;
      G.step(0.001);
      const cnt = e.count;
      while (t < 25 && S.state === 'play' && e.alive) { q.tx = 0; G.step(1 / 60); t += 1 / 60; }
      out.melee.push({ L, n, f, enemy0: cnt, enemyHpEach: +e.hp.toFixed(2), armyLeft: S.count, enemyLeft: e.alive ? e.count : 0, state: S.state, t: +t.toFixed(1) });
    }
    return out;
  });
  const m = r.melee;
  console.table(m);
  await b.close();
})();
