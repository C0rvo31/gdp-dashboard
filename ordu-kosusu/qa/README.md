# QA tools (Playwright, headless Chromium with SwiftShader)
Build first: `cd web && node build.mjs`. Screenshots land in `qa/out/` (git-ignored).
- `node qa/sim.js` — fast logic-only balance sim (bots play levels via `window.__G.step`). `LEVELS=1,11 node qa/sim.js` to pick levels.
  Prints win/lose, army size, death causes per level for a smart bot, an upgraded bot and a random-gate bot.
- `node qa/worlds.js` — gameplay screenshot of each world (L1/11/21/31) with enemies near, plus boss scenes.
- `node qa/lineup.js` — close-ups of the 5 soldier tiers (t0..t4.png) and 8 enemy types (e-*.png).
Debug hook in the page: `window.__G` = { S, squad, LV, step(dt), startRun, showMenu, save, camera, dims, setWeapon }.
`S.freeCam = true` stops the game camera so a script can place `camera` itself.
