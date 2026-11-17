// layout stats per level (growth sources vs threats)
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const r = await p.evaluate(() => {
    const G = window.__G, rows = [];
    for (let L = 1; L <= 40; L++) {
      Object.assign(G.save, { level: L, upStart: 0 }); G.showMenu();
      const s = G.LV.spec;
      const sh = ['gunner', 'bandit', 'frost', 'demon'];
      rows.push({ L, len: Math.round(s.end), gates: s.gates.length, wcr: s.blocks.filter((b) => b.kind === 'weapon').length, scr: s.blocks.filter((b) => b.kind === 'soldier').length,
        enemies: s.enemies.length, shoot: s.enemies.filter((e) => sh.includes(e.type)).length, fMax: +Math.max(...s.enemies.map((e) => e.f)).toFixed(2), saws: s.saws.length, walls: s.blocks.filter((b) => b.kind === 'wall').length,
        growth: s.gates.length + s.blocks.filter((b) => b.kind === 'soldier').length, threat: s.enemies.length + s.saws.length + s.blocks.filter((b) => b.kind === 'wall').length });
    }
    return rows;
  });
  console.table(r);
  await b.close();
})();
