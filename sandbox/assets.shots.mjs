#!/usr/bin/env node
// Screenshots of the assets gallery (assets unit): node sandbox/assets.shots.mjs [bg ...]
// Writes shots/assets/gallery_<bg>.png (full page) + per-section crops, prints missing count + errors.
import { BASE, withPage } from '../tools/lib.mjs';

const backdrops = process.argv.slice(2).length ? process.argv.slice(2) : ['split', 'checker'];
await withPage(async (page, h) => {
  const report = [];
  for (const bg of backdrops) {
    await page.goto(`${BASE}/sandbox/assets.html?bg=${bg}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('body[data-ready]', { timeout: 60000 });
    await h.shot(`shots/assets/gallery_${bg}.png`);
    await page.screenshot({ path: `shots/assets/gallery_${bg}_full.png`, fullPage: true });
    const sections = await page.$$('section');
    for (const [i, s] of sections.entries()) await s.screenshot({ path: `shots/assets/gallery_${bg}_s${i + 1}.png` });
    const failed = await page.evaluate(() => Number(document.body.dataset.failed));
    const files = await page.evaluate(() => document.querySelectorAll('.tile').length);
    report.push({ bg, files, failed });
  }
  console.log(JSON.stringify({ report, console: h.logs }, null, 1));
}, { size: '1600x1000' });
