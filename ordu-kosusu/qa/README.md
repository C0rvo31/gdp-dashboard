# QA tools (Playwright, headless Chromium with SwiftShader)
Build first: `cd web && node build.mjs`. Screenshots land in `qa/out/` (git-ignored).
- `node qa/sim.js` — fast logic-only balance sim (bots play levels via `window.__G.step`). `LEVELS=1,11 node qa/sim.js` to pick levels.
  Prints win/lose, army size, death causes per level for a smart bot, an upgraded bot and a random-gate bot.
  All bots dodge walls/saws/hammers/spikes/rollers with a lane planner; only the random-gate bot guesses gates.
  `DUMB_LEVELS=…` picks the random-gate bot's levels, `UP=4` gives the first bot upgrades, `PLAN=1` prints each level's
  segment patterns, `TRACE=1` logs steering near hazards and every melee fight.
  `ONLY=smart,up4,human,dumb` runs only those bots. `HUMAN=31,32,… RUNS=6` adds a human-ish bot (re-steers 5x/s, sees hazards only 0.3 s ahead, misreads 15% of gates).
- `node qa/traps.js` — screenshots of the trap mechanics (pendulum hammer, spike strip, barrel / snowball / boulder).
- `node qa/worlds.js` — gameplay screenshot of each world (L1/11/21/31) with enemies near, plus boss scenes.
- `node qa/smoke.js` — end-to-end regression test (exit code 1 on failure, ~2-4 min): tap/swipe start, pointer steering,
  win → DEVAM, lose → TEKRAR DENE, settings pause/sound/eco, background auto-pause, ANA MENÜ coins, upgrades/max,
  world change 10→11, wrap 40→41, NaN/state invariants every step, GPU leak check over level rebuilds, draw-call budget.
  `SHOTS=1 node qa/smoke.js` also saves screenshots to `qa/out/smoke-*.png`. Run it before every merge.
- `node qa/lineup.js` — close-ups of the 5 soldier tiers (t0..t4.png) and 8 enemy types (e-*.png).
- `node qa/bonus.js` — bonus content: boss → victory stairs → win panel with 1 / 60 / 1000 soldiers (checks the ×N multiplier
  and that the finale ends in < 4.6 s), then an ALTIN KOŞUSU gold run (level 5) start → finish. Screenshots `out/bonus-*.png`, exit 1 on failure.
Bonus levels (`web/src/bonus.js`, `isBonusLevel`): every level ending in 5 (5, 15, 25, 35 …) is an ALTIN KOŞUSU gold run
instead of a normal level (numbering unchanged). Every level ends on the ×1.2 … ×5 victory stairs that multiply the coin reward.
Debug hook in the page: `window.__G` = { S, squad, LV, step(dt), startRun, showMenu, save, camera, dims, renderer, scene, troops(), setWeapon }. `troops()` lists the instanced troop renderers (`t.lodD2 = Infinity` disables the far-instance LOD).
`S.freeCam = true` stops the game camera so a script can place `camera` itself.
