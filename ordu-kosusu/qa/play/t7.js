// win-rate of the sim bot over N trials per level (randomness: aim, jitter). usage: LEVELS=31,36 TRIALS=8 UP=0 node qa/play/t7.js
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const levels = (process.env.LEVELS || '31,32,33,34,35,36,37,38,39,40').split(',').map(Number);
  const trials = +(process.env.TRIALS || 8), up = +(process.env.UP || 0);
  const r = await p.evaluate(({ levels, trials, up }) => {
    const G = window.__G;
    const ap = (op, n) => op.k === 'add' ? n + op.v : op.k === 'sub' ? n - op.v : op.k === 'mul' ? n * op.v : Math.ceil(n / op.v);
    const res = [];
    for (const L of levels) {
      let win = 0, deaths = {}, loseZ = [], atBoss = [];
      for (let k = 0; k < trials; k++) {
        Object.assign(G.save, { level: L, upStart: up, upRate: up, upDmg: up });
        G.showMenu(); G.startRun();
        const LV = G.LV, S = G.S, q = G.squad; let t = 0;
        while (t < 200 && (S.state === 'play' || S.state === 'boss' || (S.state === 'win' && LV.boss.t < 0.1))) {
          const gate = LV.gates.find(g => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
          const crate = LV.blocks.find(b => b.alive && b.kind !== 'wall' && b.z > q.z && b.z - q.z < 26);
          const walls = LV.blocks.filter(b => b.alive && b.kind === 'wall' && b.z > q.z - 1 && b.z - q.z < 14);
          let tx = q.tx;
          if (gate) { const a = ap(gate.ops[0], S.count), bb = ap(gate.ops[1], S.count); tx = a >= bb ? -2.6 : 2.6; }
          else if (crate) tx = crate.x;
          if (walls.length) { const free = [-3.6, -1.8, 0, 1.8, 3.6].filter(x => walls.every(w => Math.abs(x - w.x) > w.w / 2 + 0.6)); if (free.length) { free.sort((a, b) => Math.abs(a - q.x) - Math.abs(b - q.x)); tx = free[0]; } }
          const saw = LV.saws.find(w => w.z > q.z - 0.5 && w.z - q.z < 9);
          if (saw) { const ta = (saw.z - q.z) / q.speed; const sx = Math.sin((S.t + ta) * saw.speed + saw.ph) * saw.amp; tx = [-3.6, -1.8, 0, 1.8, 3.6].sort((a, b) => Math.abs(b - sx) - Math.abs(a - sx))[0]; }
          q.tx = tx; G.step(1 / 60); t += 1 / 60;
        }
        if (S.state === 'win') { win++; atBoss.push(S.count); }
        else { loseZ.push(Math.round(q.z)); }
        for (const d in S.deaths) deaths[d] = (deaths[d] || 0) + S.deaths[d];
      }
      res.push({ L, winRate: win + '/' + trials, loseAtZ: loseZ.join(','), deathsPerRun: Object.fromEntries(Object.entries(deaths).map(([k, v]) => [k, Math.round(v / trials)])), medEnd: atBoss.sort((a, b) => a - b)[atBoss.length >> 1] });
    }
    return res;
  }, { levels, trials, up });
  for (const x of r) console.log(JSON.stringify(x));
  await b.close();
})();
