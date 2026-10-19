#!/usr/bin/env node
// Verifies a build in a real browser, holding one slot of the shared machine-wide browser pool
// (the repo's tools/lib.mjs, locks in <repo>/.locks):
//   node tools/single/verify/run.mjs file [--html <file.html>] [--browser chromium|webkit]
//   node tools/single/verify/run.mjs http [--dist <dir>]       [--browser chromium|webkit]
// Screenshots and <tag>-report.json go to <worktree>/shots/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, withPage } from '../../lib.mjs';
import { runFlow } from './flow.mjs';
import { serveDir } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const args = parseArgs(process.argv.slice(2));
const mode = args._[0] ?? 'file';
const browser = args.browser ?? 'chromium';
const shotsDir = path.join(root, 'shots');

async function main() {
  if (!['file', 'http'].includes(mode)) throw new Error(`unknown mode ${mode} (file | http)`);
  let server = null;
  let url;
  if (mode === 'file') {
    const html = path.resolve(args.html ?? path.join(root, 'dist-single', '暴力鹈鹕.html'));
    if (!fs.existsSync(html)) throw new Error(`no such file: ${html}`);
    url = pathToFileURL(html).href;
  } else {
    server = await serveDir(args.dist ?? path.join(root, 'dist'));
    url = server.url;
    console.log(`[verify] serving ${args.dist ?? 'dist'} at ${url}`);
  }
  const tag = args.tag ?? `${mode}-${browser}`;
  try {
    const opts = { url, tag, shotsDir, driveSeconds: Number(args.seconds ?? 20) };
    const report = await withPage((page, h) => runFlow(page, h, opts), { browser, size: args.size ?? '1280x720' });
    fs.mkdirSync(shotsDir, { recursive: true });
    fs.writeFileSync(path.join(shotsDir, `${tag}-report.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await server?.close();
  }
}

main().catch((err) => {
  console.error('[verify] failed:', err);
  process.exitCode = 1;
});
