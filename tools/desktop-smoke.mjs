#!/usr/bin/env node
// Desktop build smoke test: launches the packaged app off-screen (BR_SMOKE=1), attaches over CDP and checks that
// it boots to the title from app://, races coast for 600 frames without console errors, and quits through
// app.quit (the menu's 退出游戏). Run tools/package-desktop.sh first.
//   node tools/desktop-smoke.mjs [--exe <path>]   (default: this platform's build in desktop/build/)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9471; // 9333 belongs to another app on the Mac
const OUT = path.join(ROOT, 'shots/desktop');
const argAt = process.argv.indexOf('--exe');
const exe = argAt > 0 ? process.argv[argAt + 1] : process.platform === 'win32'
  ? path.join(ROOT, 'desktop/build/暴力鹈鹕-win/暴力鹈鹕.exe')
  : path.join(ROOT, 'desktop/build/暴力鹈鹕.app/Contents/MacOS/Electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };

if (!fs.existsSync(exe)) { console.error(`missing ${exe} (run tools/package-desktop.sh)`); process.exit(1); }
const env = { ...process.env, BR_DEBUG_PORT: String(PORT), BR_SMOKE: '1' };
delete env.ELECTRON_RUN_AS_NODE; // VS Code terminals set it, which would run the binary as plain node
const app = spawn(exe, [], { env, stdio: 'ignore' });
const exited = new Promise((r) => app.once('exit', (code) => r(code ?? 0)));

let browser;
try {
  for (let i = 0; ; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { if (i > 60) throw new Error('no CDP endpoint'); }
    await sleep(500);
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? (await ctx.waitForEvent('page'));
  await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 60000 });
  const boot = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      protocol: location.protocol, screen: window.__br.app.ui.screen, quit: typeof window.__br.app.quit,
      gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'n/a',
    };
  });
  console.log(`gpu: ${boot.gpu}`);
  expect(boot.protocol === 'app:', `served from app:// (${boot.protocol})`);
  expect(boot.screen === 'title', `boots to the title (${boot.screen})`);
  expect(boot.quit === 'function', 'app.quit is offered (desktop 退出游戏)');
  await page.evaluate(() => window.__br.start({ trackId: 'coast', seed: 3 }));
  await page.waitForFunction(() => window.__br.app.ui.screen === 'race', null, { timeout: 60000 });
  const snap = await page.evaluate(() => {
    const br = window.__br;
    br.setControls({ throttle: 1 });
    br.manual(true);
    br.step(600);
    return br.snapshot();
  });
  expect(snap.phase === 'racing' && snap.riders[0].s > 40, `coast race runs (phase=${snap.phase}, s=${snap.riders[0]?.s})`);
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => window.__br.manual(false));
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'smoke-race.png') });
  const errors = await page.evaluate(() => window.__br.errors.slice());
  expect(errors.length === 0, `no console errors (${errors.slice(0, 2).join(' | ')})`);
  await page.evaluate(() => window.__br.app.quit()).catch(() => undefined); // the page goes away mid-call
  const code = await Promise.race([exited, sleep(10000).then(() => 'timeout')]);
  expect(code !== 'timeout', `app.quit closes the app (exit ${code})`);
} catch (err) {
  failures.push(String(err));
  console.error(err);
} finally {
  await browser?.close().catch(() => undefined);
  if (app.exitCode === null) app.kill();
}
console.log(failures.length ? `\ndesktop smoke FAILED (${failures.length})` : '\ndesktop smoke OK');
process.exit(failures.length ? 1 : 0);
