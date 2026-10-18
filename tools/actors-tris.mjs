#!/usr/bin/env node
// species/actors: triangle count + build time per species (high quality) and the sandbox draw stats.
//   node tools/actors-tris.mjs [quality=high]
import { withPage } from './lib.mjs';

await withPage(async (page, h) => {
  await h.goto(`/sandbox/actors.html?panel=0&manual=1&quality=${process.argv[2] ?? 'high'}`);
  const r = await page.evaluate(() => window.__actors.report());
  for (const [k, v] of Object.entries(r)) console.log(`${k.padEnd(10)} ${v}`);
  const errs = await h.errors();
  if (errs.length) console.log('errors', errs.slice(0, 3));
});
