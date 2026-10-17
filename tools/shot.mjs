#!/usr/bin/env node
// Screenshot a page of the game.
//   node tools/shot.mjs --url "/?race=coast&seed=3" --out shots/x.png [--size 1280x720] [--wait 1500]
//        [--step 240] [--controls '{"throttle":1}'] [--eval "js"] [--browser webkit] [--snapshot]
// --step N advances N frames in manual mode (deterministic) instead of waiting real time.
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const out = a.out ?? 'shots/shot.png';
await withPage(async (page, h) => {
  await h.goto(a.url ?? '/');
  if (a.controls) await h.controls(JSON.parse(a.controls));
  if (a.eval) await h.eval(a.eval);
  if (a.step) await h.step(Number(a.step));
  if (a.wait) await h.sleep(Number(a.wait));
  await h.shot(out);
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2');
    const ext = c?.getExtension('WEBGL_debug_renderer_info');
    return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(JSON.stringify({ out, gl, snapshot: a.snapshot ? await h.snapshot() : undefined, errors: await h.errors(), console: h.logs.slice(0, 20) }, null, 1));
}, { size: a.size ?? '1280x720', browser: a.browser ?? 'chromium' });
