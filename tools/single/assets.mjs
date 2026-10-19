// Runtime-asset step of the single-file build. The game loads files from public/ at run time by
// relative URL (portraits, key art and billboards through img src, voice lines through fetch()).
// Every public file whose path occurs in the built bundle becomes an inert base64 block that
// shim.js serves in place of the network; files the bundle never names are left out (reported).
import fs from 'node:fs';
import path from 'node:path';

export const BLOCK_TYPE = 'application/x-br-asset';

const MIME = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2',
};

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

const attr = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/**
 * Files under `publicDir` that `bundle` names (by their path from public/ or from public/assets/).
 * Returns the HTML blocks plus a report of what was embedded and what was skipped.
 */
export function collectAssets(publicDir, bundle) {
  const embedded = [];
  const skipped = [];
  let html = '';
  for (const rel of walk(publicDir)) {
    const short = rel.replace(/^assets\//, '');
    const mime = MIME[path.extname(rel).toLowerCase()];
    if (!bundle.includes(rel) && !bundle.includes(short)) {
      skipped.push(rel);
      continue;
    }
    if (!mime) throw new Error(`no MIME type known for referenced asset ${rel}; add it to MIME in assets.mjs`);
    const data = fs.readFileSync(path.join(publicDir, rel));
    embedded.push({ rel, bytes: data.length });
    html += `<script type="${BLOCK_TYPE}" data-path="${attr(rel)}" data-type="${mime}">${data.toString('base64')}</script>\n`;
  }
  return { html, embedded, skipped };
}
