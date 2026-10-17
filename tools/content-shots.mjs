// Content unit browser checks.
//   node tools/content-shots.mjs gallery   → shots/content/gallery-*.png + overflow report (exit 1 on overflow)
//   node tools/content-shots.mjs game      → achievements in the real game (real units) + in-game text shots
import fs from 'node:fs';
import { BASE, withPage } from './lib.mjs';

const OUT = 'shots/content';
fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] ?? 'gallery';

async function gallery() {
  return withPage(async (page, h) => {
    await page.goto(`${BASE}/sandbox/content.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__content?.ready === true, null, { timeout: 60000 });
    const report = await page.evaluate(() => window.__content);
    await page.addStyleTag({ content: '.cg-top { position: static !important; }' });
    for (const id of ['racers', 'police', 'loading', 'results', 'hud', 'world', 'menus']) {
      const el = await page.$(`#${id}`);
      if (el) await el.screenshot({ path: `${OUT}/gallery-${id}.png` });
    }
    await page.screenshot({ path: `${OUT}/gallery-top.png` });
    console.log(`gallery: ${report.checks} checks · stats ${JSON.stringify(report.stats)}`);
    for (const o of report.overflow) console.log(`OVERFLOW ${o.where}: «${o.text}» ${o.why}`);
    const errs = h.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
    for (const e of errs) console.log(e);
    return report.overflow.length + errs.length;
  }, { size: '1920x1080' });
}

const bad = mode === 'gallery' ? await gallery() : await (await import('./content-game.mjs')).game();
process.exitCode = bad ? 1 : 0;
