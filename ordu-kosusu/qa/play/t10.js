// screenshots + UI stress: huge army, gate view, boss, pause mid-fight, rapid taps
const { open, OUT } = require('./h');
(async () => {
  const { b, p } = await open();
  const shot = async (n) => { await p.screenshot({ path: OUT + '/play_' + n + '.png' }); };
  const run = (js, a) => p.evaluate(js, a);
  // huge army approaching gate
  await run(() => { const G = window.__G; Object.assign(G.save, { level: 2, upStart: 999, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun(); G.squad.z = 5; for (let i = 0; i < 200; i++) G.step(1 / 60); });
  await shot('army1000');
  // gate close up with army 6
  await run(() => { const G = window.__G; Object.assign(G.save, { level: 1, upStart: 5 }); G.showMenu(); G.startRun(); for (let i = 0; i < 60; i++) G.step(1 / 60); });
  await shot('gate_early');
  // pause mid fight
  await run(() => { const G = window.__G, q = G.squad; Object.assign(G.save, { level: 4, upStart: 29 }); G.showMenu(); G.startRun(); const e = G.LV.enemies[0]; for (const g of G.LV.gates) g.passed = true; for (const bl of G.LV.blocks) bl.alive = false; q.z = e.z - 22; for (let i = 0; i < 100; i++) G.step(1 / 60); });
  await shot('pre_pause_fight');
  await p.click('#btnGear');
  const before = await run(() => ({ z: window.__G.squad.z, n: window.__G.S.count }));
  await p.waitForTimeout(800);
  const after = await run(() => ({ z: window.__G.squad.z, n: window.__G.S.count, paused: window.__G.S.paused }));
  console.log('pause frozen?', before, after);
  await shot('paused');
  await p.click('#btnCloseSet');
  // rapid taps: menu, upgrade buttons, retry
  await run(() => { const G = window.__G; G.showMenu(); G.save.coins = 100000; });
  for (let i = 0; i < 30; i++) await p.evaluate(() => document.querySelector('.up[data-up=upStart]').click());
  console.log('rapid upgrade', await run(() => ({ up: window.__G.save.upStart, coins: window.__G.save.coins })));
  for (let i = 0; i < 20; i++) await p.mouse.click(200, 300);
  console.log('rapid taps state', await run(() => window.__G.S.state));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  // swipe frenzy
  await p.mouse.move(100, 500); await p.mouse.down();
  for (let i = 0; i < 80; i++) { await p.mouse.move(100 + (i % 2) * 250, 500); await run(() => window.__G.step(1 / 30)); }
  await p.mouse.up();
  console.log('after frenzy', await run(() => ({ x: window.__G.squad.x, tx: window.__G.squad.tx, st: window.__G.S.state })), errs);
  // boss screenshot with 1000 army
  await run(() => { const G = window.__G, q = G.squad; Object.assign(G.save, { level: 31, upStart: 400 }); G.showMenu(); G.startRun(); const LV = G.LV; for (const g of LV.gates) g.passed = true; for (const e of LV.enemies) e.alive = false; for (const bl of LV.blocks) bl.alive = false; LV.saws.length = 0; q.z = LV.bossLine - 1; for (let i = 0; i < 400; i++) G.step(1 / 60); });
  await shot('boss31_big');
  await b.close();
})();
