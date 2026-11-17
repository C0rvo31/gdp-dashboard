// boss per world, win flow, pause/home during win celebration, persistence, retry after lose, count 0
const { open, OUT } = require('./h');
(async () => {
  const { b, p, ctx } = await open();
  // bosses
  const r = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad, out = [];
    for (const L of [1, 11, 21, 31]) {
      Object.assign(G.save, { level: L, upStart: 59, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun();
      const LV = G.LV;
      for (const g of LV.gates) g.passed = true;
      for (const e of LV.enemies) e.alive = false;
      for (const bl of LV.blocks) bl.alive = false;
      LV.saws.length = 0;
      q.z = LV.bossLine - 1;
      let t = 0, enter = null, atk = null, slams = 0, lastAtk = 0, c0 = 0, maxBar = '';
      while (t < 60 && (S.state === 'play' || S.state === 'boss')) {
        q.tx = 0; G.step(1 / 60); t += 1 / 60;
        if (S.state === 'boss' && !enter) { enter = { t, hp: LV.boss.max, n: S.count, name: LV.boss.name }; c0 = S.count; }
        if (LV.boss.state === 'attack' && !atk) atk = t - enter.t;
      }
      out.push({ L, boss: enter && enter.name, hp: enter && enter.hp, army: enter && enter.n, walkToAttack: atk && +atk.toFixed(1), fightLen: enter && +(t - enter.t).toFixed(1), end: S.state, left: S.count, scale: +LV.boss.s.toFixed(2) });
    }
    return out;
  });
  console.table(r);

  // 1 soldier vs boss, 1000 soldiers vs boss
  const r2 = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad, out = [];
    for (const n of [1, 5, 1000]) {
      Object.assign(G.save, { level: 10, upStart: n - 1, upRate: 0, upDmg: 0 }); G.showMenu(); G.startRun();
      const LV = G.LV;
      for (const g of LV.gates) g.passed = true; for (const e of LV.enemies) e.alive = false; for (const bl of LV.blocks) bl.alive = false; LV.saws.length = 0;
      q.z = LV.bossLine - 1; let t = 0; let enter = null;
      const t0 = performance.now();
      while (t < 90 && (S.state === 'play' || S.state === 'boss')) { q.tx = 0; G.step(1 / 60); t += 1 / 60; if (S.state === 'boss' && !enter) enter = { t, hp: LV.boss.max }; }
      out.push({ n, bossHp: enter && enter.hp, fight: +(t - enter.t).toFixed(1), end: S.state, left: S.count, simMsPerFrame: +((performance.now() - t0) / (t * 60)).toFixed(2) });
    }
    return out;
  });
  console.table(r2);

  // win flow + pause during celebration
  const r3 = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad;
    Object.assign(G.save, { level: 3, upStart: 20, coins: 0 }); G.showMenu(); G.startRun();
    const LV = G.LV;
    for (const g of LV.gates) g.passed = true; for (const e of LV.enemies) e.alive = false; for (const bl of LV.blocks) bl.alive = false; LV.saws.length = 0;
    q.z = LV.bossLine - 1;
    let t = 0;
    while (S.state !== 'boss' && t < 5) { G.step(1 / 60); t += 1 / 60; }
    LV.boss.hp = 1;
    while (S.state === 'boss' && t < 30) { G.step(1 / 60); t += 1 / 60; }
    return { state: S.state, level: G.save.level, coins: G.save.coins, endT: S.endT };
  });
  console.log('reached win, before panel:', r3);
  await p.click('#btnGear');
  console.log('gear visible during win-celebration, settings hidden?', await p.evaluate(() => document.getElementById('settings').classList.contains('hidden')));
  const homeVisible = await p.evaluate(() => !document.getElementById('btnHome').classList.contains('hidden'));
  console.log('home btn visible', homeVisible);
  await p.click('#btnHome');
  console.log('after Home during win celebration:', await p.evaluate(() => ({ level: window.__G.save.level, coins: window.__G.save.coins, state: window.__G.S.state })));

  // normal win path then reload persistence
  const r4 = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad;
    Object.assign(G.save, { level: 10, coins: 0 }); G.showMenu(); G.startRun();
    const LV = G.LV;
    for (const g of LV.gates) g.passed = true; for (const e of LV.enemies) e.alive = false; for (const bl of LV.blocks) bl.alive = false; LV.saws.length = 0;
    q.z = LV.bossLine - 1; let t = 0;
    while (S.state !== 'boss' && t < 5) { G.step(1 / 60); t += 1 / 60; }
    LV.boss.hp = 1; while (S.state === 'boss' && t < 30) { G.step(1 / 60); t += 1 / 60; }
    for (let i = 0; i < 200; i++) G.step(1 / 60);
    return { state: S.state, level: G.save.level, coins: G.save.coins, winSub: document.getElementById('winSub').textContent, panel: !document.getElementById('winPanel').classList.contains('hidden') };
  });
  console.log('win L10:', r4);
  await p.click('#btnNext');
  console.log('menu after next:', await p.evaluate(() => ({ pill: document.getElementById('lvlPill').textContent, theme: window.__G.LV.th.name, level: window.__G.save.level })));
  await p.reload(); await p.waitForTimeout(600);
  console.log('after reload:', await p.evaluate(() => ({ level: window.__G.save.level, coins: window.__G.save.coins, pill: document.getElementById('lvlPill').textContent, ls: localStorage.getItem('ordu_kosusu_save_v1') })));
  // upgrade persistence
  await p.evaluate(() => { window.__G.save.coins = 5000; });
  await p.evaluate(() => document.querySelector('.up[data-up=upRate]').click());
  await p.reload(); await p.waitForTimeout(600);
  console.log('upRate after reload', await p.evaluate(() => ({ up: window.__G.save.upRate, coins: window.__G.save.coins })));
  // lose + retry
  const r5 = await p.evaluate(() => {
    const G = window.__G, S = G.S, q = G.squad;
    Object.assign(G.save, { level: 12, upStart: 0, upRate: 0, upDmg: 0, coins: 0 }); G.showMenu(); G.startRun();
    G.LV.coins[0].taken = false;
    const LV = G.LV; const e0 = LV.enemies[0]; for (const g of LV.gates) g.passed = true; LV.enemies.forEach((e, i) => { if (i) e.alive = false; }); q.z = e0.z - 12; G.step(0.01); e0.count = 40; e0.state = 'charge';
    let t = 0; while (S.state === 'play' && t < 40) { q.tx = 0; G.step(1 / 60); t += 1 / 60; }
    for (let i = 0; i < 100; i++) G.step(1 / 60);
    return { state: S.state, panel: !document.getElementById('losePanel').classList.contains('hidden'), coins: G.save.coins, tip: document.getElementById('loseTip').textContent };
  });
  console.log('lose:', r5);
  await p.click('#btnRetry');
  console.log('retry ->', await p.evaluate(() => ({ state: window.__G.S.state, level: window.__G.save.level, count: window.__G.S.count })));
  await b.close();
})();
