// gate values for counts 1,5,50,500 over many levels
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, out = {};
    const ap = (op, n) => op.k === 'add' ? n + op.v : op.k === 'sub' ? n - op.v : op.k === 'mul' ? n * op.v : Math.ceil(n / op.v);
    for (const n of [1, 5, 50, 500]) {
      const s = { n, gates: 0, noop: 0, bothBad: 0, worseThanHalf: 0, wipe: 0, samples: [], bestLoss: 0, tiny: 0, mulBig: 0 };
      for (let L = 1; L <= 40; L++) {
        Object.assign(G.save, { level: L, upStart: n - 1 }); G.showMenu(); G.startRun();
        G.S.count = n; // arm sees S.count
        G.squad.z = 10000; // arm everything? no: just force arm by stepping at zero-lim
        G.squad.z = 0;
        // arm gates by faking z
        G.squad.z = 1e4; G.step(0.001); // armObjects uses squad.z
        for (const g of G.LV.gates) {
          if (!g.ops) continue;
          s.gates++;
          const a = ap(g.ops[0], n), bb = ap(g.ops[1], n);
          const best = Math.max(a, bb), worst = Math.min(a, bb);
          if (a === n || bb === n) s.noop++;
          if (a < n && bb < n) s.bothBad++;
          if (worst <= n * 0.5) s.worseThanHalf++;
          if (worst <= 0) s.wipe++;
          if (best > n * 4 && n >= 5) s.mulBig++;
          if (best - n <= 0) s.tiny++;
          if (s.samples.length < 6 && L % 7 === 1) s.samples.push(`L${L}: ${g.ops.map((o) => o.k + o.v).join(' | ')}`);
        }
      }
      out[n] = s;
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
