// detailed trace of a level with the same bot as qa/sim.js. usage: LV=36 UP=0 node qa/play/t36.js
const { open } = require('./h');
(async () => {
  const { b, p } = await open();
  const L = +(process.env.LV || 36), up = +(process.env.UP || 0);
  const r = await p.evaluate(({ L, up }) => {
    const G = window.__G;
    const ap = (op, n) => op.k === 'add' ? n + op.v : op.k === 'sub' ? n - op.v : op.k === 'mul' ? n * op.v : Math.ceil(n / op.v);
    Object.assign(G.save, { level: L, upStart: up, upRate: up, upDmg: up });
    G.showMenu(); G.startRun();
    const LV = G.LV, S = G.S, q = G.squad, log = [];
    const spec = LV.spec;
    log.push(`theme=${LV.th.name} speed=${q.speed.toFixed(1)} hpMul=${LV.hpMul.toFixed(2)} nSeg: gates=${LV.gates.length} walls=${LV.blocks.filter(b => b.kind === 'wall').length} crates=${LV.blocks.filter(b => b.kind !== 'wall').length} enemies=${LV.enemies.map(e => e.type[0] + ':' + e.z.toFixed(0)).join(',')} saws=${LV.saws.map(s => s.z.toFixed(0)).join(',')}`);
    let t = 0, lastDeaths = {}, evs = new Set(), lastFight = 0;
    const prev = { count: S.count };
    const note = (m) => log.push(`t=${t.toFixed(1)} z=${q.z.toFixed(0)} n=${S.count} w=${S.weapon}  ${m}`);
    while (t < 200 && S.state === 'play') {
      const gate = LV.gates.find(g => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
      const crate = LV.blocks.find(b => b.alive && b.kind !== 'wall' && b.z > q.z && b.z - q.z < 26);
      const walls = LV.blocks.filter(b => b.alive && b.kind === 'wall' && b.z > q.z - 1 && b.z - q.z < 14);
      let tx = q.tx;
      if (gate) { const a = ap(gate.ops[0], S.count), bb = ap(gate.ops[1], S.count); tx = a >= bb ? -2.6 : 2.6; }
      else if (crate) tx = crate.x;
      if (walls.length) {
        const free = [-3.6, -1.8, 0, 1.8, 3.6].filter(x => walls.every(w => Math.abs(x - w.x) > w.w / 2 + 0.6));
        if (free.length) { free.sort((a, b) => Math.abs(a - q.x) - Math.abs(b - q.x)); tx = free[0]; }
      }
      const saw = LV.saws.find(w => w.z > q.z - 0.5 && w.z - q.z < 9);
      if (saw) {
        const ta = (saw.z - q.z) / q.speed;
        const sx = Math.sin((S.t + ta) * saw.speed + saw.ph) * saw.amp;
        tx = [-3.6, -1.8, 0, 1.8, 3.6].sort((a, b) => Math.abs(b - sx) - Math.abs(a - sx))[0];
      }
      q.tx = tx;
      for (const g of LV.gates) if (g.ops && !evs.has(g)) { evs.add(g); note(`gate armed ${g.ops.map(o => o.k + o.v)} @z${g.z.toFixed(0)}`); }
      for (const e of LV.enemies) if (e.armed && !evs.has(e)) { evs.add(e); note(`enemy ${e.type} armed count=${e.count} hp/ea=${e.hp.toFixed(2)} @z${e.z.toFixed(0)} x=${e.x.toFixed(1)}`); }
      for (const e of LV.blocks) if (e.armed && !evs.has(e)) { evs.add(e); note(`${e.kind} armed hp=${e.max} w=${e.w} x=${e.x} ${e.tier ? 'tier' + e.tier : ''}${e.v ? '+' + e.v : ''} @z${e.z.toFixed(0)}`); }
      const c0 = S.count, d0 = JSON.stringify(S.deaths);
      G.step(1 / 60); t += 1 / 60;
      if (!lastFight && S.fight) { lastFight = 1; note(`FIGHT start vs ${S.fight.type} (${S.fight.count})`); }
      if (lastFight && !S.fight) { lastFight = 0; note(`fight over`); }
      if (S.count - c0 >= 3 || S.count - c0 <= -3) note(`count ${c0}->${S.count} (${S.cause})`);
      if (Math.floor(t) !== Math.floor(t - 1 / 60)) { const d = S.deaths; const diff = []; for (const k in d) if ((d[k] || 0) !== (lastDeaths[k] || 0)) diff.push(`${k}+${d[k] - (lastDeaths[k] || 0)}`); lastDeaths = Object.assign({}, d); if (diff.length) note(`1s deaths: ${diff.join(' ')}`); }
    }
    log.push(`END state=${S.state} count=${S.count} t=${t.toFixed(1)} z=${q.z.toFixed(0)}/${LV.bossLine.toFixed(0)} deaths=${JSON.stringify(S.deaths)}`);
    return log;
  }, { L, up });
  console.log(r.join('\n'));
  await b.close();
})();
