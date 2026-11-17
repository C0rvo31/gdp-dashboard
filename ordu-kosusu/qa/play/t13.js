// one soldier walking into a melee group must lose (smoke test regression check)
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  console.log(await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad;
    Object.assign(G.save, { level: 2, upStart: 0, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun();
    const LV = G.LV; for (const g of LV.gates) g.passed = true; for (const bl of LV.blocks) bl.alive = false; LV.saws.length = 0;
    const e = LV.enemies.find((x) => !x.T.shoots) || LV.enemies[0];
    q.z = e.z - 33; for (let i = 0; i < 30; i++) G.step(1 / 60);
    const log = [`type=${e.type} count=${e.count} hp=${e.hp.toFixed(2)} state=${e.state} x=${e.x.toFixed(1)} n=${S.count}`];
    for (let i = 0; i < 600 && S.state === 'play'; i++) { q.tx = e.x; G.step(1 / 60); if (i % 60 === 0) log.push(`t${i} state=${e.state} count=${e.count} alive=${e.alive} n=${S.count} dz=${(e.z - q.z).toFixed(1)}`); }
    log.push(S.state + ' n=' + S.count + ' enemy=' + e.count + ' deaths=' + JSON.stringify(S.deaths));
    return log.join('\n');
  }));
  await b.close();
})();
