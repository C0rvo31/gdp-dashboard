// steering, clamp, formation
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, out = [];
    const start = (n) => { Object.assign(G.save, { level: 1, upStart: n - 1 }); G.showMenu(); G.startRun(); G.step(0.01); G.squad.z = 0; };
    for (const n of [1, 2, 6, 7, 30, 150, 151, 400, 1000]) {
      start(n);
      G.squad.tx = 100; for (let i = 0; i < 120; i++) { G.squad.z = 0; G.step(1 / 60); }
      const sqR = G.squad.x, xs = G.squad.sold.map((s) => s.x);
      G.squad.tx = -100; for (let i = 0; i < 120; i++) { G.squad.z = 0; G.step(1 / 60); }
      const xs2 = G.squad.sold.map((s) => s.x), d = G.dims(n);
      out.push({ n, vis: G.squad.sold.length, minX: +Math.min(...xs2).toFixed(2), maxX: +Math.max(...xs).toFixed(2), sqL: +G.squad.x.toFixed(2), sqR: +sqR.toFixed(2), cols: d.cols, rows: d.rows, depth: +d.depth.toFixed(1) });
    }
    return out;
  });
  console.table(r);
  await p.evaluate(() => { window.__G.showMenu(); });
  await p.mouse.move(200, 600); await p.mouse.down();
  await p.mouse.move(300, 600, { steps: 10 });
  for (let i = 0; i < 20; i++) await p.evaluate(() => window.__G.step(1 / 60));
  console.log('after drag right', await p.evaluate(() => {
    const G = window.__G, c = G.camera;
    const v = c.position.clone().set(G.squad.x, 1, G.squad.z).project(c);
    return { x: G.squad.x, tx: G.squad.tx, st: G.S.state, ndcX: v.x };
  }));
  await p.mouse.up();
  await b.close();
})();
