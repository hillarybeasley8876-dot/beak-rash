#!/usr/bin/env node
// Track-card stills (ui-screens): renders one in-engine chase-cam frame per track (autopilot, fixed seed,
// UI hidden) and saves it as src/ui/assets/track-<id>.webp (800×450) for the career / quick-race cards.
// Re-run after the track look changes:  node tools/ui-track-stills.mjs [--tracks coast,city] [--seconds 9] [--out dir]
// The capybara is left out by default: its chill aura ring would sit in the middle of every still.
import fs from 'node:fs';
import { parseArgs, withPage } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const TRACKS = String(args.tracks ?? 'coast,city,mountain').split(',');
/** Race time of the still per track (picked by eye: clean frames, no skill rings); --seconds overrides. */
const DEFAULT_SECONDS = { coast: 9, city: 6, mountain: 6 };
const SEED = Number(args.seed ?? 7);
const RIVALS = String(args.rivals ?? 'goose,cat,shiba,pigeon,penguin,seagull,sloth');
const OUT_DIR = args.out ?? 'src/ui/assets';

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const id of TRACKS) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=${SEED}&autopilot=1&rivals=${RIVALS}`);
    await page.addStyleTag({ content: '.br-ui { display: none !important; }' });
    await page.waitForFunction(() => window.__br.session()?.phase === 'racing', null, { timeout: 60000 });
    await h.step(Math.round(60 * Number(args.seconds ?? DEFAULT_SECONDS[id] ?? 9)));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const png = await page.screenshot({ type: 'png' });
    const webp = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 450;
      const g = c.getContext('2d');
      if (!g) throw new Error('no 2d context');
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.82);
    }, png.toString('base64'));
    if (!webp.startsWith('data:image/webp')) throw new Error(`[ui-track-stills] ${id}: browser could not encode webp`);
    const file = `${OUT_DIR}/track-${id}.webp`;
    fs.writeFileSync(file, Buffer.from(webp.split(',')[1], 'base64'));
    const errors = await h.errors();
    console.log(`[ui-track-stills] ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)${errors.length ? ` errors: ${errors.slice(0, 2).join(' | ')}` : ''}`);
  }, { size: '1280x720' });
}
