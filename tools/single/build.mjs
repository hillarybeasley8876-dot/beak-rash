#!/usr/bin/env node
// Builds BEAK RASH into ONE self-contained HTML file that plays from file:// (double-click, no
// server, no other files):
//   node tools/single/build.mjs [--out <file.html>] [--root <repo checkout>]
// --root defaults to the checkout this script lives in (it needs its node_modules installed).
// 1. vite build with the repo's vite.config.ts + single-chunk overrides   (vite-build.mjs)
// 2. keep the font slices the game's text needs, inline them as woff2     (fonts.mjs)
// 3. embed the public/ files the bundle refers to + a shim that serves them (assets.mjs, shim.js)
// 4. inline everything into the page                                        (html.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteBuild } from './vite-build.mjs';
import { inlineFonts, usedCodePoints } from './fonts.mjs';
import { collectAssets } from './assets.mjs';
import { assembleHtml, externalRefs } from './html.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const root = path.resolve(arg('--root') ?? path.join(here, '../..'));
const outFile = path.resolve(arg('--out') ?? path.join(root, 'dist-single', '暴力鹈鹕.html'));
const buildDir = path.join(here, '.out');
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

/** "assets/portraits/*.png ×40, assets/PROMPTS.md" — skipped files grouped by folder and type. */
function groupPaths(paths) {
  const groups = new Map();
  for (const p of paths) {
    const key = `${path.posix.dirname(p)}/*${path.posix.extname(p)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map((g) => (g.length === 1 ? g[0] : `${path.posix.dirname(g[0])}/*${path.posix.extname(g[0])} ×${g.length}`)).join(', ');
}

async function main() {
  await viteBuild(root, buildDir);
  const page = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
  const refs = externalRefs(page);
  if (refs.scripts.length !== 1) throw new Error(`expected one module script, got ${refs.scripts.length}`);
  if (refs.styles.length > 1) throw new Error(`expected at most one stylesheet, got ${refs.styles.length}`);
  const jsFile = path.resolve(buildDir, refs.scripts[0]);
  const js = fs.readFileSync(jsFile, 'utf8');
  if (/\bimport\(|\b(?:from|import)\s*["'`]\.{1,2}\//.test(js)) throw new Error('bundle still imports other chunks; code splitting was not disabled');

  let css = '';
  if (refs.styles[0]) {
    const cssFile = path.resolve(buildDir, refs.styles[0]);
    const rawCss = fs.readFileSync(cssFile, 'utf8');
    const textCss = rawCss.replace(/@font-face\s*\{[^}]*\}/g, '');
    const used = usedCodePoints({ js: [js], css: [textCss], html: [page] });
    const fonts = inlineFonts(rawCss, path.dirname(cssFile), used);
    css = fonts.css;
    console.log(`[single] fonts: ${fonts.stats.kept} slices kept, ${fonts.stats.dropped} unused dropped, woff2 ${mb(fonts.stats.bytes)} (${used.length} code points used)`);
    for (const [family, bytes] of fonts.stats.families) console.log(`[single]   ${family}: ${mb(bytes)}`);
  }

  const assets = collectAssets(path.join(root, 'public'), js);
  const assetBytes = assets.embedded.reduce((n, a) => n + a.bytes, 0);
  console.log(`[single] assets: ${assets.embedded.length} embedded (${mb(assetBytes)}); not referenced by the game, left out: ${groupPaths(assets.skipped) || 'none'}`);

  const shim = fs.readFileSync(path.join(here, 'shim.js'), 'utf8');
  const html = assembleHtml({ html: page, css, js, shim, assetBlocks: assets.html });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(`[single] wrote ${outFile} (${mb(Buffer.byteLength(html))}; js ${mb(js.length)}, css ${mb(css.length)})`);
}

main().catch((err) => {
  console.error('[single] build failed:', err);
  process.exit(1);
});
