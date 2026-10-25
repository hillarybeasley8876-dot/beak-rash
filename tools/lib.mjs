// Shared Playwright harness for agents. Caps concurrent browsers machine-wide (mkdir locks),
// launches GPU Chromium (or WebKit), and exposes helpers that drive the game via window.__br.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKS = path.join(ROOT, '.locks');
const SLOTS = Number(process.env.BR_SLOTS ?? 8); // machine-wide headless browsers (RTX 3090 / 32 threads here)
export const BASE = process.env.BR_BASE ?? 'http://127.0.0.1:5300';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// GPU ANGLE backend per OS: Metal on macOS, D3D11 on Windows, the platform default elsewhere.
const ANGLE = { darwin: ['--use-angle=metal'], win32: ['--use-angle=d3d11'] }[process.platform] ?? [];

// Integrator notice (2026-10-18): every agent that Read ~30-45 full-size PNG screenshots died with
// "Request timed out" (the request body grows with each image). Printed on stderr so JSON stdout stays clean.
console.error(
  '[lib] IMAGE BUDGET (integrator): agents that Read 30+ full-size screenshots die with "Request timed out". ' +
    'Before you Read a screenshot, convert it: python tools/thumb.py in.png (-> in.jpg, 1280 px wide) or ' +
    'python tools/thumb.py a.png b.png ... -o sheet.jpg (one contact sheet), and Read at most ~15 images in total for your whole task.',
);

async function acquireSlot() {
  fs.mkdirSync(LOCKS, { recursive: true });
  for (let waited = 0; ; waited += 500) {
    for (let i = 0; i < SLOTS; i++) {
      const dir = path.join(LOCKS, `browser${i}`);
      try {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'pid'), String(process.pid));
        return () => fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Slot taken: reclaim it only when its owner is gone. No pid yet means another process is between
        // mkdir and write, so leave the slot alone unless it has been empty for more than 10 s.
        const pidFile = path.join(dir, 'pid');
        let pid = 0;
        try { pid = Number(fs.readFileSync(pidFile, 'utf8')) || 0; } catch { /* not written yet */ }
        let stale;
        if (pid) {
          try { process.kill(pid, 0); stale = false; } catch (e) { stale = e.code !== 'EPERM'; }
        } else {
          try { stale = Date.now() - fs.statSync(dir).mtimeMs > 10_000; } catch { stale = false; }
        }
        if (stale) fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    if (waited === 0) console.log('[lib] waiting for a browser slot…');
    await sleep(500);
  }
}

/** Run fn(page, helpers) in a fresh browser; always closes the browser and frees the slot. */
export async function withPage(fn, { size = '1280x720', browser = 'chromium', dpr = 1 } = {}) {
  const [width, height] = size.split('x').map(Number);
  const release = await acquireSlot();
  const engine = browser === 'webkit' ? webkit : chromium;
  const b = await engine.launch(browser === 'webkit' ? {} : {
    channel: 'chromium',
    args: [...ANGLE, '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const cleanup = async () => { await b.close().catch(() => undefined); release(); };
  process.once('SIGINT', () => void cleanup().then(() => process.exit(130)));
  try {
    const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const h = helpers(page, logs);
    return await fn(page, h);
  } finally {
    await cleanup();
  }
}

function helpers(page, logs) {
  const h = {
    logs,
    async goto(q = '/', { timeout = 60000 } = {}) {
      await page.goto(BASE + q, { waitUntil: 'load', timeout });
      await page.waitForFunction(() => window.__br?.ready === true, null, { timeout });
    },
    /** Advance N frames deterministically (switches the game to manual stepping). */
    async step(frames, dt = 1 / 60) {
      await page.evaluate(([n, d]) => { window.__br.manual(true); window.__br.step(n, d); }, [frames, dt]);
    },
    async realtime() { await page.evaluate(() => window.__br.manual(false)); },
    async controls(c) { await page.evaluate((x) => window.__br.setControls(x), c); },
    async press(action) { await page.evaluate((a) => window.__br.press(a), action); },
    async snapshot() { return page.evaluate(() => window.__br.snapshot()); },
    async errors() { return page.evaluate(() => window.__br.errors.slice()); },
    async eval(js) { return page.evaluate(js); },
    async shot(file) {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      // Let the RAF loop present at least two frames so the canvas holds the latest image.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({ path: file });
      return file;
    },
    async key(code, ms = 100) { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); },
    sleep,
  };
  return h;
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}
