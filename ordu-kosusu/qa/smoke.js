// End-to-end smoke / regression test. Drives the real built page (taps, pointer drags,
// DOM buttons) and fast-forwards gameplay with window.__G.step. Exits non-zero on failure.
//   cd web && node build.mjs && cd .. && node qa/smoke.js      (SHOTS=1 also saves screenshots to qa/out/)
const path = require('path');
const fs = require('fs');
const DIST = 'file://' + path.resolve(process.env.DIST || path.join(__dirname, '../web/dist/index.html'));
const OUT = path.join(__dirname, 'out');
const { chromium, devices } = require('playwright');

const fails = [];
let passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ok  ' + msg); } else { fails.push(msg); console.log('  FAIL ' + msg); } };

// ---------------------------------------------------------------- in-page helpers
function installHelpers() {
  const G = window.__G;
  const ap = (op, n) => op.k === 'add' ? n + op.v : op.k === 'sub' ? n - op.v : op.k === 'mul' ? n * op.v : Math.ceil(n / op.v);
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const T = window.__T = {
    errors: [],
    // invariants that must hold after every step
    quiet: false, // set while a test pokes S.count directly (sold/count mismatch on purpose)
    check() {
      if (T.quiet) return true;
      const S = G.S, q = G.squad, LV = G.LV;
      const bad = [];
      if (!fin(S.count) || S.count < 0 || S.count !== Math.round(S.count)) bad.push('count=' + S.count);
      if (!fin(q.x) || !fin(q.z) || !fin(q.tx)) bad.push('squad pos NaN');
      if (Math.abs(q.x) > 5) bad.push('squad.x off road ' + q.x);
      if (!fin(LV.boss.hp) || LV.boss.hp < 0) bad.push('boss.hp=' + LV.boss.hp);
      if (S.state === 'play' || S.state === 'boss') {
        if (q.sold.length !== Math.min(S.count, 150)) bad.push('sold ' + q.sold.length + ' vs count ' + S.count);
        if (S.fight && (!S.fight.alive || S.fight.state !== 'fight')) bad.push('stale S.fight');
      }
      if ((S.state === 'lose') && (S.count !== 0 || q.sold.length !== 0)) bad.push('army alive after lose: ' + S.count);
      for (const s of q.sold) if (!fin(s.x) || !fin(s.z)) { bad.push('soldier NaN'); break; }
      for (const g of LV.enemies) {
        if (!fin(g.pool) || !fin(g.hp) || !fin(g.x) || !fin(g.z) || g.count < 0) { bad.push('enemy NaN ' + g.type); break; }
        if (g.alive && g.armed && g.sold.length !== Math.min(g.count, 96)) { bad.push('enemy sold mismatch'); break; }
      }
      for (const b of LV.blocks) if (!fin(b.hp)) { bad.push('block hp NaN'); break; }
      if (bad.length) T.errors.push(S.state + ' L' + LV.L + ' t=' + S.t.toFixed(2) + ': ' + bad.join(', '));
      return bad.length === 0;
    },
    step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) { G.step(dt); T.check(); } },
    // smart bot (same as qa/sim.js): best gate, shoot crates, dodge walls/saws. Returns final state.
    bot(maxT = 200, until) {
      const S = G.S, q = G.squad, LV = G.LV;
      let t = 0;
      while (t < maxT && (S.state === 'play' || S.state === 'boss')) {
        if (until && until(G)) break;
        const gate = LV.gates.find(g => !g.passed && g.ops && g.z > q.z && g.z - q.z < 18);
        const crate = LV.blocks.find(b => b.alive && b.kind !== 'wall' && b.z > q.z && b.z - q.z < 26);
        const walls = LV.blocks.filter(b => b.alive && b.kind === 'wall' && b.z > q.z - 1 && b.z - q.z < 14);
        let tx = q.tx;
        if (gate) tx = ap(gate.ops[0], S.count) >= ap(gate.ops[1], S.count) ? -2.6 : 2.6;
        else if (crate) tx = crate.x;
        if (walls.length) {
          const free = [-3.6, -1.8, 0, 1.8, 3.6].filter(x => walls.every(w => Math.abs(x - w.x) > w.w / 2 + 0.6));
          if (free.length) { free.sort((a, b) => Math.abs(a - q.x) - Math.abs(b - q.x)); tx = free[0]; }
        }
        const saw = LV.saws.find(w => w.z > q.z - 0.5 && w.z - q.z < 9);
        if (saw) {
          const sx = Math.sin((S.t + (saw.z - q.z) / q.speed) * saw.speed + saw.ph) * saw.amp;
          tx = [-3.6, -1.8, 0, 1.8, 3.6].sort((a, b) => Math.abs(b - sx) - Math.abs(a - sx))[0];
        }
        // spike strips (TRAPS): take the lane whose spikes stay down while the whole army crosses
        const sp = (LV.spikes || []).find(ss => ss.z + ss.depth / 2 > q.z - G.dims(S.count).depth - 0.5 && ss.z - q.z < 12);
        if (sp) {
          const d = G.dims(S.count), lim = Math.max(0, 5 - 0.35 - d.hw);
          const ta = Math.max(0, (sp.z - sp.depth / 2 - q.z - 0.3) / q.speed), tb = (sp.z + sp.depth / 2 - q.z + d.depth + 0.6) / q.speed;
          let best = null, bs = 1e9;
          for (const tile of sp.tiles) {
            let bad = 0;
            for (let u = ta; u <= tb; u += 0.04) { const c = (((S.t + u + tile.ph) % sp.period) + sp.period) % sp.period; if (c < sp.up + 0.05) bad++; }
            const x = Math.max(-lim, Math.min(lim, tile.x)), sc = bad * 100 + Math.abs(x - q.x);
            if (sc < bs) { bs = sc; best = x; }
          }
          if (best !== null) tx = best;
        }
        q.tx = tx;
        G.step(1 / 60); T.check(); t += 1 / 60;
      }
      return S.state;
    },
    // victory stairs (bonus.js) decide when the win panel opens (up to ~4.5 s): step until it does
    finishStairs(maxS = 8) { for (let i = 0; i < maxS * 60 && !T.vis('winPanel'); i++) { G.step(1 / 60); T.check(); } return T.vis('winPanel'); },
    // expected stairs multiplier for an army of n (mirror of bonus.js NEED/MULTS)
    stairsMult(n) { const NEED = [1, 4, 8, 14, 22, 34, 50, 75, 110, 160], M = [1.2, 1.4, 1.6, 1.8, 2, 2.4, 2.8, 3.2, 4, 5]; let m = 1; for (let i = 0; i < 10; i++) if (n >= NEED[i]) m = M[i]; return m; },
    mem() {
      const R = G.renderer; R.render(G.scene, G.camera);
      return { geo: R.info.memory.geometries, tex: R.info.memory.textures, prog: R.info.programs.length, calls: R.info.render.calls };
    },
    vis: (id) => !document.getElementById(id).classList.contains('hidden'),
  };
}

const S = (p, expr, arg) => p.evaluate(expr, arg);

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on('pageerror', (e) => pageErrors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  const shot = async (name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: `${OUT}/smoke-${name}.png` }); } };
  const W = 412, H = 915;
  const tapStart = async () => { await p.mouse.move(W / 2, H * 0.45); await p.mouse.down(); await p.mouse.move(W / 2 + 40, H * 0.45, { steps: 4 }); await p.mouse.up(); };
  const click = async (sel) => { await p.click(sel); await p.waitForTimeout(60); };

  try {
    await p.goto(DIST);
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await p.waitForTimeout(700);
    await p.evaluate(installHelpers);

    console.log('# boot / menu');
    ok(await S(p, () => !!window.__G && window.__G.S.state === 'menu'), 'page boots into menu');
    ok(await S(p, () => __T.vis('menu') && document.getElementById('lvlPill').textContent.includes('SEVİYE 1')), 'menu visible, level 1 pill');
    await shot('menu');

    console.log('# swipe to start + pointer steering');
    await tapStart();
    await p.waitForTimeout(100);
    ok(await S(p, () => __G.S.state === 'play' && !__T.vis('menu')), 'swipe starts the run');
    const tx0 = await S(p, () => __G.squad.tx);
    await p.mouse.move(W / 2, H * 0.6); await p.mouse.down(); await p.mouse.move(W / 2 + 80, H * 0.6, { steps: 5 }); await p.mouse.up();
    const tx1 = await S(p, () => __G.squad.tx);
    ok(tx1 < tx0, `drag right steers to world -x (tx ${tx0.toFixed(2)} -> ${tx1.toFixed(2)})`);
    await p.mouse.move(W / 2, H * 0.6); await p.mouse.down(); await p.mouse.move(W - 2, H * 0.6, { steps: 3 }); await p.mouse.move(2, H * 0.6, { steps: 3 }); await p.mouse.move(-400, H * 0.6, { steps: 3 }); await p.mouse.up();
    ok(await S(p, () => { __T.step(30); const q = __G.squad, d = __G.dims(__G.S.count); return Math.abs(q.tx) <= 5 - 0.35 - d.hw + 1e-6; }), 'steering is clamped to the road');

    console.log('# play level 1 to win');
    const coins0 = await S(p, () => __G.save.coins);
    ok(await S(p, () => __T.bot(200)) === 'win', 'bot beats level 1 (gates, crates, walls, enemies, boss)');
    ok(await S(p, () => __G.LV.boss.state === 'dead' && __G.LV.boss.hp === 0), 'boss dead with hp exactly 0');
    const armyAtWin = await S(p, () => ({ n: __G.S.count, run: __G.S.runCoins }));
    ok(await S(p, () => __T.finishStairs()), 'victory stairs finish and open the win panel');
    ok(await S(p, () => __T.vis('winPanel') && __G.save.level === 2), 'win panel shown, level advanced to 2');
    const coins1 = await S(p, () => __G.save.coins);
    ok(coins1 > coins0, `win reward banked (${coins0} -> ${coins1})`);
    {
      const m = await S(p, (n) => __T.stairsMult(n), armyAtWin.n);
      const exp = Math.round((20 + 1 * 6 + Math.floor(Math.min(armyAtWin.n, 400) * 0.6) + armyAtWin.run) * m);
      const shown = await S(p, () => { const el = document.getElementById('wMult'); return el && !el.classList.contains('hidden') ? el.querySelector('b').textContent : ''; });
      ok(coins1 - coins0 === exp && shown.replace('×', '') == String(m), `stairs multiplier: army ${armyAtWin.n} -> ×${m}, reward ${coins1 - coins0} (expected ${exp}), card "${shown}"`);
    }
    await S(p, () => __T.step(60 * 3));
    ok(await S(p, () => __G.save.coins) === coins1 && await S(p, () => __G.save.level) === 2, 'finishWin runs once (no double reward)');
    await shot('win');
    await click('#btnNext');
    ok(await S(p, () => __G.S.state === 'menu' && __G.LV.L === 2 && __T.vis('menu') && !__T.vis('winPanel')), 'DEVAM -> menu of level 2');

    console.log('# lose (killed mid fight loop) + retry');
    await tapStart();
    ok(await S(p, () => __G.S.state === 'play'), 'level 2 started by tap');
    const lose = await S(p, () => {
      const G = __G, S = G.S, q = G.squad;
      // play normally until an enemy group is close, then shrink the army to 1 and walk into it
      const melee = (e) => e.alive && e.armed && !e.T.shoots && e.z - q.z < 30 && e.z - q.z > 3;
      __T.bot(120, (G) => G.LV.enemies.some(melee));
      const e = G.LV.enemies.find(melee);
      if (!e) return 'no melee enemy (' + S.state + ')';
      // hold fire so the group survives to melee range, then shrink the army to 1 right before contact
      for (let i = 0; i < 600 && S.state === 'play' && e.alive && e.state !== 'fight' && e.z - q.z > 4; i++) { S.shotAcc = -1e9; q.tx = e.x; G.step(1 / 60); __T.check(); }
      if (!e.alive) return 'enemy died before contact';
      S.count = 1; q.sold.length = 1; S.runCoins = Math.max(S.runCoins, 3);
      for (let i = 0; i < 600 && S.state === 'play'; i++) { S.shotAcc = -1e9; q.tx = e.x; G.step(1 / 60); __T.check(); }
      return S.state + (S.fight === null ? ' fightCleared' : ' fightSet');
    });
    ok(lose === 'lose fightCleared', 'army dies inside the fight loop -> lose, S.fight cleared (' + lose + ')');
    const lc = await S(p, () => ({ coins: __G.save.coins }));
    await S(p, () => __T.step(60 * 2));
    ok(await S(p, () => __T.vis('losePanel') && __G.S.count === 0 && __G.squad.sold.length === 0), 'lose panel shown, stray bullets did not revive the army');
    ok(await S(p, () => __G.save.coins) === lc.coins, 'no extra coins after lose');
    await shot('lose');
    await click('#btnRetry');
    ok(await S(p, () => __G.S.state === 'menu' && __G.LV.L === 2 && __G.save.level === 2), 'TEKRAR DENE -> same level');

    console.log('# settings: pause/resume, sound, eco');
    await tapStart();
    await S(p, () => __T.step(60));
    await click('#btnGear');
    ok(await S(p, () => __G.S.paused && __T.vis('settings') && __T.vis('btnHome')), 'gear pauses and shows settings (with ANA MENÜ)');
    // frame limiter: count renderer.render() calls with a stub (SwiftShader itself is far too slow to measure fps)
    const rate = (ms) => p.evaluate((ms) => new Promise((res) => {
      const R = __G.renderer, real = R.render; let n = 0;
      R.render = function () { n++; };
      const t0 = performance.now();
      setTimeout(() => { R.render = real; res(n / ((performance.now() - t0) / 1000)); }, ms);
    }), ms);
    const z0 = await S(p, () => __G.squad.z);
    const fPaused = await rate(700);
    ok(await S(p, () => __G.squad.z) === z0, 'game frozen while paused');
    ok(fPaused < 3, `no re-rendering while paused (${fPaused.toFixed(1)} fps)`);
    const snd = await S(p, () => __G.save.sound);
    await click('#settings .tog[data-set="sound"]');
    ok(await S(p, () => __G.save.sound) === !snd && await S(p, () => document.querySelector('.tog[data-set="sound"]').classList.contains('on')) === !snd, 'sound toggle flips save + switch');
    await click('#settings .tog[data-set="sound"]');
    await click('#settings .tog[data-set="eco"]');
    ok(await S(p, () => __G.save.eco && __G.renderer.getPixelRatio() === 1), 'eco on -> pixel ratio 1');
    await p.waitForTimeout(150);
    ok(await rate(500) < 3, 'resize while paused renders once, then idles');
    await click('#btnCloseSet');
    ok(await S(p, () => !__G.S.paused && !__T.vis('settings')), 'TAMAM resumes');
    const fEco = await rate(1200);
    ok(fEco <= 34 && fEco > 5, `eco mode caps the loop at ~30 fps (${fEco.toFixed(1)})`);
    ok(await S(p, () => __G.squad.z) > z0, 'game advances after resume');
    await click('#btnGear'); await click('#settings .tog[data-set="eco"]');
    ok(await S(p, () => !__G.save.eco && __G.renderer.getPixelRatio() === Math.min(window.devicePixelRatio, 1.75)), 'eco off -> full pixel ratio');
    await click('#btnCloseSet');
    const fFull = await rate(1200);
    ok(fFull > fEco * 1.4, `eco off runs faster than eco (${fFull.toFixed(1)} fps)`);

    console.log('# visibilitychange auto-pause');
    const vis = await S(p, () => {
      const set = (h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); };
      set(true); const paused = __G.S.paused && __T.vis('settings');
      set(false); delete document.hidden;
      return paused;
    });
    ok(vis, 'going to background mid-run opens the pause screen');
    if (await S(p, () => __T.vis('settings'))) await click('#btnCloseSet');

    console.log('# ANA MENÜ mid-run keeps run coins');
    // (the run above went on in real time unsteered; start a fresh one so it is alive)
    const home = await S(p, () => { __G.showMenu(); __G.startRun(); __T.bot(6); __G.S.runCoins += 4; return { run: __G.S.runCoins, coins: __G.save.coins, st: __G.S.state }; });
    await click('#btnGear'); await click('#btnHome');
    ok(home.run > 0 && await S(p, () => __G.save.coins) === home.coins + home.run && await S(p, () => __G.S.state === 'menu'), `ANA MENÜ banks ${home.run} run coins and returns to menu (${home.st})`);
    ok(await S(p, () => __G.LV.L === 2 && document.getElementById('coins').textContent.length > 0), 'menu rebuilt for the same level');

    console.log('# ANA MENÜ right after the boss dies still counts the win');
    const hw = await S(p, () => { __G.startRun(); const st = __T.bot(200); return { st, lvl: __G.save.level, coins: __G.save.coins }; });
    if (hw.st === 'win') {
      await click('#btnGear'); await click('#btnHome');
      ok(await S(p, () => __G.save.level) === hw.lvl + 1 && await S(p, () => __G.save.coins) > hw.coins, 'win banked when leaving before the win panel');
    } else ok(false, 'bot could not win level 2 for the ANA MENÜ-after-win check (' + hw.st + ')');

    console.log('# upgrades');
    await S(p, () => { __G.save.coins = 5000; __G.showMenu(); });
    const u0 = await S(p, () => ({ c: __G.save.coins, n: __G.S.count, g: __G.LV.gates.filter(g => g.armed).map(g => JSON.stringify(g.ops)).join() }));
    await click('.up[data-up="upStart"]');
    const u1 = await S(p, () => ({ c: __G.save.coins, n: __G.S.count, lvl: __G.save.upStart, sold: __G.squad.sold.length }));
    ok(u1.lvl === 1 && u1.n === 2 && u1.sold === 2 && u1.c === u0.c - 40, 'buy ASKER: +1 start soldier, cost 40');
    ok(await S(p, () => __G.LV.gates.filter(g => g.armed).every(g => g.ops && g.panels.every(pp => pp.visible && pp.material.map))), 'nearby gates re-armed after upgrade');
    await S(p, () => { __G.save.upRate = 29; __G.save.coins = 1e7; });
    await click('.up[data-up="upRate"]');
    const cMax = await S(p, () => __G.save.coins);
    ok(await S(p, () => __G.save.upRate === 30 && document.querySelector('.up[data-up="upRate"] [data-c]').textContent === 'MAKS'), 'upgrade reaches max, shows MAKS');
    await click('.up[data-up="upRate"]');
    ok(await S(p, () => __G.save.upRate === 30 && __G.save.coins) === cMax, 'maxed upgrade cannot be bought again');
    await S(p, () => { __G.save.coins = 0; });
    await click('.up[data-up="upDmg"]');
    ok(await S(p, () => __G.save.upDmg === 0 && __G.save.coins === 0 && __G.S.state === 'menu'), 'cannot buy without coins; tapping upgrade does not start run');

    console.log('# ALTIN KOŞUSU gold run (level 5)');
    const gold = await S(p, () => {
      const G = __G; G.save.level = 5; G.showMenu();
      const LV = G.LV;
      const layout = { bonus: !!LV.bonus, enemies: LV.enemies.length, saws: LV.saws.length, walls: LV.blocks.filter(b => b.kind === 'wall').length, boss: LV.boss.group.visible, pill: document.getElementById('lvlPill').textContent };
      const c0 = G.save.coins;
      G.startRun();
      const st = __T.bot(120);
      const at = { n: G.S.count, run: G.S.runCoins, boss: G.LV.boss.state };
      const panel = __T.finishStairs();
      return { layout, st, at, panel, gain: G.save.coins - c0, level: G.save.level, mult: __T.stairsMult(at.n), sub: document.getElementById('winSub').textContent };
    });
    ok(gold.layout.bonus && gold.layout.enemies === 0 && gold.layout.saws === 0 && gold.layout.walls === 0 && !gold.layout.boss && gold.layout.pill.includes('ALTIN'), 'level 5 is a gold run: no enemies/saws/walls/boss (' + JSON.stringify(gold.layout) + ')');
    ok(gold.st === 'win' && gold.at.boss === 'idle' && gold.panel && gold.level === 6, `gold run ends at the line, stairs, win panel, level 6 (${gold.st})`);
    ok(gold.at.run > 0 && gold.gain === Math.round((gold.at.run + 15 + 5 * 2) * gold.mult), `gold run pays (coins ${gold.at.run} + 25) x${gold.mult} = ${gold.gain}`);
    ok(gold.sub.includes('ALTIN'), 'gold run win card');
    await click('#btnNext');
    ok(await S(p, () => __G.LV.L === 6 && !__G.LV.bonus), 'DEVAM after the gold run -> normal level 6');

    console.log('# world change 10 -> 11');
    const winLevel = async (L) => S(p, (L) => {
      // well upgraded bot: this checks the world switch, not balance
      Object.assign(__G.save, { level: L, upStart: 12, upRate: 12, upDmg: 12 });
      __G.showMenu(); __G.startRun();
      const st = __T.bot(220); __T.finishStairs();
      return st;
    }, L);
    const w10 = await winLevel(10);
    ok(w10 === 'win', 'level 10 won (' + w10 + ')');
    await click('#btnNext');
    const w11 = await S(p, () => {
      const G = __G, LV = G.LV, pts = G.scene.children.find(o => o.isPoints);
      return { L: LV.L, key: LV.th.key, types: [...new Set(LV.enemies.map(e => e.type))], fog: G.scene.fog.color.getHex() === LV.th.fog, weather: pts.visible, pill: document.getElementById('lvlPill').textContent };
    });
    ok(w11.L === 11 && w11.key === 'desert' && w11.fog && !w11.weather && w11.pill.includes('ÇÖL'), 'level 11 is the desert world (' + JSON.stringify(w11) + ')');
    ok(w11.types.every(t => t === 'nomad' || t === 'bandit'), 'desert enemy types');
    await tapStart();
    ok(await S(p, () => __G.S.state === 'play'), 'desert run starts');
    await p.waitForTimeout(300);
    await shot('w11');
    await S(p, () => { __G.save.level = 21; __G.showMenu(); });
    ok(await S(p, () => __G.LV.th.key === 'snow' && __G.scene.children.find(o => o.isPoints).visible), 'level 21 snow world has weather');

    console.log('# world change 40 -> 41 and wrap back to the first world');
    const worlds = await S(p, () => {
      const keys = [];
      for (let w = 0; w < 12; w++) { __G.save.level = w * 10 + 1; __G.showMenu(); if (w > 0 && __G.LV.th.key === keys[0]) break; keys.push(__G.LV.th.key); }
      return keys;
    });
    console.log('  info: worlds ' + worlds.join(' > '));
    ok(worlds.length >= 4 && new Set(worlds).size === worlds.length, 'every 10 levels a new world (' + worlds.length + ' worlds)');
    const w40 = await winLevel(40);
    ok(w40 === 'win', 'level 40 won (' + w40 + ')');
    await click('#btnNext');
    ok(await S(p, (k) => __G.LV.L === 41 && __G.LV.th.key === k, worlds[4 % worlds.length]), 'level 41 is world ' + worlds[4 % worlds.length]);
    await tapStart();
    ok(await S(p, () => { const sp = document.getElementById('splash'); return sp ? sp.classList.contains('go') && sp.textContent.includes(__G.LV.th.name) : document.getElementById('toast').textContent.includes('YENİ BÖLÜM'); }), 'new world splash on 41');
    ok(await S(p, () => __T.bot(220)) !== 'play', 'level 41 plays to an end state');
    const WL = worlds.length * 10;
    const wW = await winLevel(WL);
    ok(wW === 'win', `level ${WL} won (${wW})`);
    await click('#btnNext');
    ok(await S(p, (WL) => __G.LV.L === WL + 1 && __G.LV.th.key === 'meadow' && !__G.scene.children.find(o => o.isPoints).visible, WL), `level ${WL + 1} wraps to the meadow world`);

    console.log('# busy scene: draw calls / update cost (report)');
    const perf = await S(p, () => {
      const G = __G, S = G.S, q = G.squad, R = G.renderer;
      __T.quiet = true;
      Object.assign(G.save, { level: 21 }); G.showMenu(); G.startRun(); S.count = 400; G.setWeapon(3);
      __T.bot(60, (G) => G.LV.enemies.some(e => e.alive && e.armed && e.z - q.z < 12));
      let calls = 0, ms = 0, tris = 0; const n = 120;
      for (let i = 0; i < n; i++) { S.count = Math.max(S.count, 300); const t0 = performance.now(); G.step(1 / 60); ms += performance.now() - t0; R.render(G.scene, G.camera); calls += R.info.render.calls; tris += R.info.render.triangles; }
      __T.quiet = false;
      const lod = G.troops ? G.troops().reduce((a, t) => a + (t.nl || 0), 0) : 0;
      return { calls: calls / n, tris: tris / n, updMs: ms / n, sold: q.sold.length, lod };
    });
    console.log(`  info: ${perf.sold} soldiers (${perf.lod} drawn as LOD), ${perf.calls.toFixed(1)} draw calls/frame, ${Math.round(perf.tris / 1000)}K triangles/frame, update() ${perf.updMs.toFixed(3)} ms`);
    ok(perf.calls < 90, 'draw calls in busy scene < 90');

    console.log('# resource leaks over level rebuilds');
    const leak = await S(p, () => {
      const G = __G;
      // play a bit, then jump to the boss line so every object of the level gets armed (gate
      // textures, labels, enemy groups); draw everything regardless of the frustum and count
      const cycle = (L) => {
        G.save.level = L; G.showMenu(); G.startRun(); __T.bot(15);
        G.squad.z = G.LV.bossLine - 0.5; G.step(1 / 60);
        G.scene.traverse((o) => { o.frustumCulled = false; });
        return __T.mem();
      };
      // warm-up: per-theme textures, per-enemy-type troops and trap geometry are cached on purpose
      for (const L of [1, 11, 21, 31, 7, 27]) cycle(L);
      const a = cycle(7);
      for (let i = 0; i < 14; i++) cycle(i % 2 ? 7 : 27);
      const z = cycle(7);
      return { a, z };
    });
    ok(leak.z.geo <= leak.a.geo && leak.z.tex <= leak.a.tex && leak.z.prog <= leak.a.prog, `no GPU leaks over 16 rebuilds (before ${JSON.stringify(leak.a)} after ${JSON.stringify(leak.z)})`);

    const errs = await S(p, () => __T.errors.slice(0, 10));
    ok(errs.length === 0, 'state invariants held on every step' + (errs.length ? ': ' + errs.join(' | ') : ''));
  } catch (e) {
    fails.push('exception: ' + (e && e.stack || e));
    console.log('  FAIL exception', e);
  }
  ok(pageErrors.length === 0, 'no page errors' + (pageErrors.length ? ': ' + pageErrors.slice(0, 5).join(' | ') : ''));
  await b.close();
  console.log(`\n${passes} passed, ${fails.length} failed`);
  if (fails.length) { console.log('FAILURES:\n - ' + fails.join('\n - ')); process.exit(1); }
})();
