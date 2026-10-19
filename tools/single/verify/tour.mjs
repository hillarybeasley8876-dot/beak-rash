#!/usr/bin/env node
// Screen tour: shows every menu screen once and reports its images (key art, portraits) and errors
//   node tools/single/verify/tour.mjs <url> [--browser chromium|webkit] [--tag name]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, withPage } from '../../lib.mjs';
import { gameErrors, imageReport } from './probes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, '../../../shots');
const args = parseArgs(process.argv.slice(2));
const SCREENS = ['career', 'garage', 'trackSelect', 'settings', 'howto', 'credits'];

await withPage(async (page, h) => {
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url().slice(0, 120)));
  await page.goto(args._[0], { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__br?.ready === true, null, { timeout: 120000 });
  for (const screen of SCREENS) {
    await page.evaluate((s) => window.__br.show(s), screen);
    await h.sleep(1800);
    await h.shot(path.join(shots, `tour-${args.tag ?? 'x'}-${screen}.png`));
    const img = await imageReport(page);
    const names = await page.evaluate(() => [...document.querySelectorAll('#ui img')].map((i) => i.src.replace(/^.*\/assets\//, '')));
    console.log(screen, `imgs ${img.loaded}/${img.total} broken=${JSON.stringify(img.broken)} pending=${JSON.stringify(img.pending)}`, JSON.stringify(names));
  }
  console.log('gameErrors', JSON.stringify(await gameErrors(page)));
  console.log('console', JSON.stringify(h.logs), 'failed', JSON.stringify(failed));
}, { browser: args.browser ?? 'chromium' });
