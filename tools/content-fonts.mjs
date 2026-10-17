// Glyph coverage of the bundled @fontsource families: unions the cmap of every WOFF subset file, so the
// lint can flag characters a UI font lacks (the browser would silently fall back to Noto Sans SC).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from './content-ts.mjs';

function sfntTable(buf, wanted) {
  if (buf.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF file');
  const numTables = buf.readUInt16BE(12);
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    if (buf.toString('latin1', e, e + 4) !== wanted) continue;
    const offset = buf.readUInt32BE(e + 4);
    const compLength = buf.readUInt32BE(e + 8);
    const origLength = buf.readUInt32BE(e + 12);
    const raw = buf.subarray(offset, offset + compLength);
    return compLength < origLength ? zlib.inflateSync(raw) : raw;
  }
  return null;
}

function addFormat4(t, at, out) {
  const segs = t.readUInt16BE(at + 6) / 2;
  const ends = at + 14, starts = ends + segs * 2 + 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
  for (let s = 0; s < segs; s++) {
    const end = t.readUInt16BE(ends + s * 2), start = t.readUInt16BE(starts + s * 2);
    const delta = t.readInt16BE(deltas + s * 2), range = t.readUInt16BE(ranges + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph;
      if (range === 0) glyph = (c + delta) & 0xffff;
      else {
        const g = t.readUInt16BE(ranges + s * 2 + range + (c - start) * 2);
        glyph = g === 0 ? 0 : (g + delta) & 0xffff;
      }
      if (glyph !== 0) out.add(c);
    }
  }
}

function addFormat12(t, at, out) {
  const groups = t.readUInt32BE(at + 12);
  for (let g = 0; g < groups; g++) {
    const o = at + 16 + g * 12;
    const start = t.readUInt32BE(o), end = t.readUInt32BE(o + 4), glyph = t.readUInt32BE(o + 8);
    for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) out.add(c);
  }
}

function addCmap(buf, out) {
  const t = sfntTable(buf, 'cmap');
  if (!t) return;
  const n = t.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const at = t.readUInt32BE(4 + i * 8 + 4);
    const format = t.readUInt16BE(at);
    if (format === 4) addFormat4(t, at, out);
    else if (format === 12) addFormat12(t, at, out);
  }
}

const cache = new Map();

/** Code points covered by a fontsource family/weight, e.g. coverage('zcool-kuaile', 400). */
export function coverage(family, weight = 400) {
  const key = `${family}/${weight}`;
  if (cache.has(key)) return cache.get(key);
  const dir = path.join(ROOT, 'node_modules/@fontsource', family, 'files');
  const out = new Set();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(`-${weight}-normal.woff`));
  if (!files.length) throw new Error(`no ${weight} WOFF files for ${family}`);
  for (const f of files) addCmap(fs.readFileSync(path.join(dir, f)), out);
  cache.set(key, out);
  return out;
}

/** Characters of `text` that `family` cannot draw (whitespace ignored). */
export function missingGlyphs(text, family, weight = 400) {
  const cov = coverage(family, weight);
  return [...new Set(Array.from(text).filter((ch) => !/\s/.test(ch) && !cov.has(ch.codePointAt(0))))];
}
