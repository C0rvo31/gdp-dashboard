# QA tools (Playwright, headless Chromium with SwiftShader)
Build first: `cd web && node build.mjs`. Screenshots land in `qa/out/` (git-ignored).
- `node qa/sim.js` — fast logic-only balance sim (bots play levels via `window.__G.step`). `LEVELS=1,11 node qa/sim.js` to pick levels.
  Prints win/lose, army size, death causes per level for a smart bot, an upgraded bot and a random-gate bot.
- `node qa/worlds.js` — gameplay screenshot of each world (L1/11/21/31) with enemies near, plus boss scenes.
- `node qa/smoke.js` — end-to-end regression test (exit code 1 on failure, ~2-4 min): tap/swipe start, pointer steering,
  win → DEVAM, lose → TEKRAR DENE, settings pause/sound/eco, background auto-pause, ANA MENÜ coins, upgrades/max,
  world change 10→11, wrap 40→41, NaN/state invariants every step, GPU leak check over level rebuilds, draw-call budget.
  `SHOTS=1 node qa/smoke.js` also saves screenshots to `qa/out/smoke-*.png`. Run it before every merge.
- `node qa/lineup.js` — close-ups of the 5 soldier tiers (t0..t4.png) and 8 enemy types (e-*.png).
Debug hook in the page: `window.__G` = { S, squad, LV, step(dt), startRun, showMenu, save, camera, dims, renderer, scene, setWeapon }.
`S.freeCam = true` stops the game camera so a script can place `camera` itself.
