// weapon crates: spacing vs arm distance (stale tier), tier up, soldier models, popup, unbroken crate
const { open, OUT } = require('./h');
(async () => {
  const { b, p } = await open();
  const gaps = await p.evaluate(() => {
    const G = window.__G, res = [];
    for (let L = 1; L <= 40; L++) {
      Object.assign(G.save, { level: L, upStart: 0 }); G.showMenu();
      const w = G.LV.blocks.filter((b) => b.kind === 'weapon' || b.kind === 'soldier').sort((a, b) => a.z - b.z);
      const ws = w.filter((b) => b.kind === 'weapon');
      const close = [];
      for (let i = 1; i < ws.length; i++) if (ws[i].z - ws[i - 1].z < 82) close.push((ws[i].z - ws[i - 1].z).toFixed(0));
      res.push(`L${L}: wcrates@${ws.map((b) => b.z.toFixed(0)).join(',')} ${close.length ? 'CLOSE<82:' + close : ''}`);
    }
    return res;
  });
  console.log(gaps.filter((g) => g.includes('CLOSE')).join('\n') || 'no close pairs');
  console.log(gaps.slice(0, 6).join('\n'));

  // simulate: perfect shooter in center collects all crates by steering to them, check popup on duplicate tier
  const r = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad, out = [];
    for (const L of [1, 2, 3, 4]) {
      Object.assign(G.save, { level: L, upStart: 9, upRate: 5, upDmg: 5 }); G.showMenu(); G.startRun();
      const LV = G.LV, pop = document.getElementById('wpn');
      let popups = 0, lastW = S.weapon, ups = 0; const evs = [];
      const cl = (pop.className || '');
      for (let t = 0; t < 120 * 60 && S.state === 'play'; t++) {
        const crate = LV.blocks.find((b) => b.alive && b.kind !== 'wall' && b.z > q.z && b.z - q.z < 40);
        const walls = LV.blocks.filter((b) => b.alive && b.kind === 'wall' && b.z > q.z - 1 && b.z - q.z < 14);
        const gate = LV.gates.find((g) => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
        let tx = q.tx;
        if (gate) tx = 2.6; else if (crate) tx = crate.x;
        if (walls.length) { const f = [-3.6, -1.8, 0, 1.8, 3.6].filter((x) => walls.every((w) => Math.abs(x - w.x) > w.w / 2 + 0.6)); if (f.length) tx = f[0]; }
        q.tx = tx;
        const before = LV.blocks.map((b) => b.alive);
        const wBefore = S.weapon;
        const hadPop = pop.classList.contains('go');
        G.step(1 / 60);
        LV.blocks.forEach((b, i) => { if (before[i] && !b.alive && b.kind !== 'wall') evs.push(`z${b.z.toFixed(0)} ${b.kind} tier${b.tier} weapon ${wBefore}->${S.weapon}`); });
      }
      out.push({ L, final: S.state, weapon: S.weapon, evs });
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
