// Bonus content QA: victory stairs after the boss (1 / 60 / 1000 soldiers) and an ALTIN KOŞUSU
// gold-run level from start to finish. Screenshots -> qa/out/bonus-*.png. Exits 1 on any failure.
const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(__dirname, '../web/dist/index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const { chromium, devices } = require('playwright');

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message); });
  p.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text()); } });
  await p.goto(DIST);
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const G = window.__G;
    // the page keeps rendering, but only our manual steps advance the game
    window.__adv = (sec, until) => {
      for (let t = 0; t < sec; t += 1 / 60) { if (until && until(G)) return true; G.step(1 / 60); }
      return !!(until && until(G));
    };
    window.__toBoss = (L, count, weapon) => {
      G.S.paused = false; G.save.level = L; G.showMenu(); G.startRun();
      G.S.paused = true;
      G.S.count = count; G.setWeapon(weapon);
      const q = G.squad; // visible soldiers (main.js caps them at 150)
      while (q.sold.length < Math.min(count, 150)) q.sold.push({ x: 0, z: q.z, k: 1, ph: Math.random() * 6.28, jx: (Math.random() - 0.5) * 0.08, jz: (Math.random() - 0.5) * 0.08 });
      q.sold.length = Math.min(count, 150);
      for (const e of G.LV.enemies) e.alive = false;
      for (const x of G.LV.blocks) x.alive = false;
      G.LV.gates.forEach((g) => { g.passed = true; });
      G.LV.saws.length = 0;
      G.squad.z = G.LV.bossLine - 1;
      window.__adv(1);
      return G.S.state;
    };
  });
  const shot = async (name) => { await p.waitForTimeout(120); await p.screenshot({ path: `${OUT}/bonus-${name}.png` }); };

  // ---------------------------------------------------------------- victory stairs
  for (const [count, expectMult, snap] of [[60, null, true], [1, '×1.2', false], [1000, '×5', true]]) {
    const st = await p.evaluate(`window.__toBoss(3, ${count}, 4)`);
    check(st === 'boss', `stairs/${count}: reached boss (state=${st})`);
    // kill the boss fast so the finale starts
    const dead = await p.evaluate(() => window.__adv(30, (G) => { if (G.LV.boss.state !== 'dead' && G.LV.boss.hp > 1) G.LV.boss.hp = Math.min(G.LV.boss.hp, 1); return G.S.state === 'win'; }));
    check(dead, `stairs/${count}: boss died`);
    const t0 = await p.evaluate(() => window.__G.S.t);
    if (snap) {
      await p.evaluate(() => window.__adv(1.9));
      await shot(`stairs-mid-${count}`);
    }
    const shown = await p.evaluate(() => window.__adv(8, () => !document.getElementById('winPanel').classList.contains('hidden')));
    const dt = (await p.evaluate(() => window.__G.S.t)) - t0;
    check(shown, `stairs/${count}: win panel opened`);
    check(dt < 4.6, `stairs/${count}: finale took ${dt.toFixed(2)}s (< 4.6)`);
    const card = await p.evaluate(() => ({ mult: document.querySelector('#wMult b').textContent, vis: !document.getElementById('wMult').classList.contains('hidden'), coins: document.getElementById('wCoins').textContent }));
    check(card.vis, `stairs/${count}: multiplier line visible (${card.mult} ÇARPAN)`);
    if (expectMult) check(card.mult === expectMult, `stairs/${count}: multiplier ${card.mult} == ${expectMult}`);
    if (snap) {
      // look at the finished climb without the panel, then the panel itself
      await p.evaluate(() => document.getElementById('winPanel').classList.add('hidden'));
      await shot(`stairs-top-${count}`);
      await p.evaluate(() => document.getElementById('winPanel').classList.remove('hidden'));
      await p.waitForTimeout(1100);
      await shot(`win-${count}`);
    }
  }

  // ---------------------------------------------------------------- ALTIN KOŞUSU (level 5)
  await p.evaluate(() => { const G = window.__G; G.S.paused = false; G.save.level = 5; G.showMenu(); });
  const menu = await p.evaluate(() => ({ pill: document.getElementById('lvlPill').textContent, bonus: window.__G.LV.bonus, en: window.__G.LV.enemies.length, bl: window.__G.LV.blocks.length, saws: window.__G.LV.saws.length, gems: window.__G.LV.spec.gems.length, coins: window.__G.LV.coins.length }));
  check(menu.bonus && /ALTIN/.test(menu.pill), `gold run: L5 is a bonus level (${menu.pill})`);
  check(menu.en === 0 && menu.bl === 0 && menu.saws === 0, 'gold run: no enemies / walls / saws');
  console.log('     gold run layout:', JSON.stringify(menu));
  await shot('gold-menu');
  await p.evaluate(() => { const G = window.__G; G.startRun(); G.S.paused = true; });
  // bot: take the better gate, otherwise chase the nearest gem / coin
  await p.evaluate(() => {
    const G = window.__G, A = (op, n) => op.k === 'add' ? n + op.v : op.k === 'mul' ? n * op.v : n;
    window.__goldBot = (sec, until) => {
      const q = G.squad, LV = G.LV;
      for (let t = 0; t < sec && G.S.state === 'play'; t += 1 / 60) {
        if (until && until(G)) return true;
        const gate = LV.gates.find((g) => !g.passed && g.ops && g.z > q.z && g.z - q.z < 14);
        if (gate) q.tx = A(gate.ops[0], G.S.count) >= A(gate.ops[1], G.S.count) ? -2.6 : 2.6;
        else {
          const c = LV.coins.find((c) => !c.taken && c.z > q.z + 0.5 && c.z - q.z < 7);
          const gm = LV.spec.gems.find((g) => g.z > q.z + 0.5 && g.z - q.z < 7);
          const tgt = gm || c; if (tgt) q.tx = tgt.x;
        }
        G.step(1 / 60);
      }
      return !!(until && until(G));
    };
  });
  await p.evaluate(() => window.__goldBot(4.5));
  await shot('gold-run');
  const fin = await p.evaluate(() => window.__goldBot(60, (G) => G.S.state !== 'play'));
  const st = await p.evaluate(() => ({ s: window.__G.S.state, coins: window.__G.S.runCoins, count: window.__G.S.count }));
  check(st.s === 'win', `gold run: reached the finish line (state=${st.s}, army=${st.count}, coins=${st.coins})`);
  check(st.coins > 30, `gold run: collected coins (${st.coins})`);
  await p.evaluate(() => window.__adv(1.2));
  await shot('gold-stairs');
  const shown = await p.evaluate(() => window.__adv(8, () => !document.getElementById('winPanel').classList.contains('hidden')));
  check(shown, 'gold run: win panel opened');
  await p.waitForTimeout(1100);
  const card = await p.evaluate(() => ({ sub: document.getElementById('winSub').textContent, coll: document.getElementById('wColl').textContent, mult: document.querySelector('#wMult b').textContent, reward: document.getElementById('wCoins').textContent, level: window.__G.save.level }));
  console.log('     gold run card:', JSON.stringify(card));
  check(/ALTIN/.test(card.sub) && +card.coll === st.coins, 'gold run: card shows ALTIN KOŞUSU + coins collected');
  check(card.level === 6, 'gold run: next level is 6');
  await shot('gold-win');
  // next normal level should be a normal layout again
  await p.evaluate(() => { const G = window.__G; G.S.paused = false; G.showMenu(); });
  const nxt = await p.evaluate(() => ({ bonus: window.__G.LV.bonus, en: window.__G.LV.enemies.length, stairs: window.__G.S.state }));
  check(!nxt.bonus && nxt.en > 0, 'level 6 is a normal level again');

  check(errors.length === 0, `no page errors (${errors.length})`);
  await b.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL OK');
  process.exit(fails.length ? 1 : 0);
})();
