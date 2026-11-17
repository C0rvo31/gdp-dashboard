const path = require('path');
const { chromium, devices } = require('playwright');
const DIST = 'file://' + path.resolve(__dirname, '../../web/dist/index.html');
exports.OUT = path.resolve(__dirname, '../out');
require('fs').mkdirSync(exports.OUT, { recursive: true });
exports.open = async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(DIST); await p.waitForTimeout(600);
  return { b, p, ctx };
};
