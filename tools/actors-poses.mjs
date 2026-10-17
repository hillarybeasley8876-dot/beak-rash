#!/usr/bin/env node
// actors unit: scripted pose screenshots from the sandbox.
//   node tools/actors-poses.mjs <name> "<query>" "<js before stepping>" <frames> [more frames…]
// Each extra frame count takes another shot after stepping that many more frames.
import { withPage } from './lib.mjs';

const [name, query = '', js = '', ...frames] = process.argv.slice(2);
await withPage(async (page, h) => {
  await h.goto(`/sandbox/actors.html?${query}`);
  await page.evaluate(() => window.__actors.step(30));
  if (js) await page.evaluate(js);
  let i = 0;
  for (const f of frames.length ? frames : ['1']) {
    await page.evaluate((n) => window.__actors.step(n), Number(f));
    await h.shot(`shots/actors/${name}-${i++}.png`);
  }
  const errs = await h.errors();
  console.log(JSON.stringify({ shots: i, errors: errs.slice(0, 5), logs: h.logs.filter((l) => !l.includes('fallback bike')).slice(0, 8) }));
});
