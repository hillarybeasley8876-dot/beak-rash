#!/usr/bin/env node
// AI art generator for BEAK RASH (assets unit). Prompts live in public/assets/PROMPTS.md (single
// source of truth: `{TOKEN}` definitions + one `### <out> · <aspect> · <mode>` section per file).
// Pipeline per job: submit → poll every 10 s (8 min cap) → download raw PNG to shots/assets/raw/
// → tools/cutout.py writes the shipped files under public/assets/. Up to 4 tries per job.
// Usage: node tools/gen-image.mjs [--only a,b|prefix*] [--force] [--recut] [--jobs 4] [--list]
//          [--variants N]  generate N candidates per job (raw/<out>.cand<i>.png, no cutout; existing
//                        candidates are kept unless --force)
//          [--edit [--variants N]]  apply each selected file's `> edit:` instruction to its current raw
//                        (uploaded, or its `> canvas:` outpaint canvas) -> raw/<out>.edit<i>.png, no cutout
//          [--pick out=i,...]  promote candidate i (or edit candidate eI) to the raw (old raw archived), cut it out
//          [--prompts FILE --dest DIR]   (experiments: alternate prompt file + output dir)
//          [--manifest]  only rewrite src/data/assets.ts from the shipped files (also done after every
//                        run that writes into public/assets)
// The internal endpoint needs no key (IOA VPN only); never put credentials in this file.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://ys-api.xaminim.com/api';
const PROMPTS = path.join(ROOT, 'public/assets/PROMPTS.md');
const DEST = path.join(ROOT, 'public/assets');
const LOG = path.join(ROOT, 'public/assets/gen.log');
const RAW = path.join(ROOT, 'shots/assets/raw');
const TRIES = 4;
const POLL_MS = 10_000;
const CAP_MS = 8 * 60_000;
const ASPECTS = new Set(['3:4', '16:9', '1:1']);
/** nano_banana: ~1 MP PNG. nano_banana_2: 2K (2752x1536 for 16:9), usually JPEG bytes (kept in the .png raw). */
const MODEL = 'nano_banana';
const MODELS = new Set([MODEL, 'nano_banana_2']);
/** cutout.py arguments per mode (see tools/cutout.py --help). PNGs are 256-colour (flat comic art). */
const MODES = {
  cut: ['--cut', '--max-h', '900', '--png', '--webp', '--colors', '256'],
  full: ['--max-h', '900', '--png', '--webp', '--colors', '256'],
  strip: ['--max-h', '900', '--png', '--webp', '--colors', '256'],
  bill: ['--max-h', '576', '--webp'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function log(msg) {
  const line = `${stamp()} ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function parseArgs(argv) {
  const a = { only: null, force: false, recut: false, jobs: 4, list: false, prompts: PROMPTS, dest: DEST, variants: 0, pick: null, manifest: false, edit: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--only') a.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--force') a.force = true;
    else if (k === '--recut') a.recut = true;
    else if (k === '--jobs') a.jobs = Math.max(1, Math.min(4, Number(argv[++i]) || 4));
    else if (k === '--list') a.list = true;
    else if (k === '--manifest') a.manifest = true;
    else if (k === '--prompts') a.prompts = path.resolve(argv[++i]);
    else if (k === '--dest') a.dest = path.resolve(argv[++i]);
    else if (k === '--variants') a.variants = Math.max(1, Math.min(8, Number(argv[++i]) || 1));
    else if (k === '--edit') a.edit = true;
    else if (k === '--pick') a.pick = new Map(argv[++i].split(',').map((p) => p.split('=')).map(([o, n]) => {
      if (!/^e?[1-9]\d*$/.test(n ?? '')) throw new Error(`--pick ${o}=${n}: want a candidate number or eN`);
      return [o, n];
    }));
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

/** Parse PROMPTS.md into [{out, aspect, mode, cut, prompt, model, edit, canvas}] with tokens expanded
 *  (mode may end in +flip). Per-section `>` directives: `cutout:` extra cutout.py args, `model:` image
 *  model, `edit:` instruction applied to the current raw by --edit, `canvas:` cutout.py args that build the
 *  outpaint canvas the edit starts from (must include --canvas S[,DY]; may --frame first), `ref:` a reference
 *  image (repo-relative path) sent with fresh rolls of that file. */
export function parsePrompts(md) {
  const tokens = new Map();
  for (const m of md.matchAll(/^- `\{([A-Z0-9_]+)\}` (.+)$/gm)) tokens.set(m[1], m[2].trim());
  const expand = (text, depth = 0) => text.replace(/\{([A-Z0-9_]+)\}/g, (all, name) => {
    if (!tokens.has(name)) throw new Error(`PROMPTS.md: unknown token {${name}}`);
    return depth > 4 ? all : expand(tokens.get(name), depth + 1);
  });
  const sections = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const h = /^### (\S+) · (\S+) · (\S+)\s*$/.exec(line);
    const dir = /^> (cutout|model|edit|canvas|ref): (.+)$/.exec(line);
    if (h) {
      cur = { out: h[1], aspect: h[2], mode: h[3], body: [], extra: [], edit: [], refs: [], model: MODEL, canvas: null };
      sections.push(cur);
    } else if (/^#{1,3} /.test(line)) cur = null;
    else if (cur && dir?.[1] === 'cutout') cur.extra.push(...dir[2].trim().split(/\s+/));
    else if (cur && dir?.[1] === 'edit') cur.edit.push(dir[2].trim());
    else if (cur && dir?.[1] === 'model') cur.model = dir[2].trim();
    else if (cur && dir?.[1] === 'ref') cur.refs.push(dir[2].trim());
    else if (cur && dir?.[1] === 'canvas') cur.canvas = dir[2].trim().split(/\s+/);
    else if (cur && line.trim() && !line.startsWith('>')) cur.body.push(line.trim());
  }
  return sections.map(({ out, aspect, mode, body, extra, edit, refs, model, canvas }) => {
    if (!ASPECTS.has(aspect)) throw new Error(`PROMPTS.md: ${out}: bad aspect ${aspect}`);
    const [base, ...flags] = mode.split('+');
    if (!MODES[base] || flags.some((f) => f !== 'flip')) throw new Error(`PROMPTS.md: ${out}: bad mode ${mode}`);
    if (!body.length) throw new Error(`PROMPTS.md: ${out}: empty prompt`);
    if (!MODELS.has(model)) throw new Error(`PROMPTS.md: ${out}: unknown model ${model}`);
    if (canvas && !canvas.includes('--canvas')) throw new Error(`PROMPTS.md: ${out}: canvas args need --canvas S[,DY]`);
    const cut = [...MODES[base], ...(flags.includes('flip') ? ['--flip'] : []), ...extra];
    const clean = (s) => expand(s).replace(/\s+/g, ' ');
    return { out, aspect, mode, cut, model, canvas, refs, prompt: clean(body.join(' ')), edit: edit.length ? clean(edit.join(' ')) : null };
  });
}

const matches = (out, pats) => pats.some((p) => (p.endsWith('*') ? out.startsWith(p.slice(0, -1)) : out === p));

async function postJson(endpoint, body, timeoutMs) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
  return res.json();
}

async function submit(job, prompt, images) {
  const body = { model_name: job.model, prompt, aspect_ratio: job.aspect };
  if (images.length) body.image_urls = images;
  const r = await postJson('nano_banana_image', body, 60_000);
  if (!r.success || typeof r.data !== 'string') throw new Error(`submit rejected: ${r.message ?? JSON.stringify(r).slice(0, 200)}`);
  const id = JSON.parse(r.data).task_id;
  if (typeof id !== 'string' || !id) throw new Error(`submit: no task_id in ${r.data}`);
  return id;
}

/** Upload a local image (multipart `file`) to the internal CDN; returns its https URL. */
async function upload(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/png' }), path.basename(file));
  const res = await fetch(`${API}/fileupload`, { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`fileupload: HTTP ${res.status}`);
  const r = await res.json();
  if (!r.success || typeof r.data !== 'string' || !r.data.startsWith('https://')) throw new Error(`fileupload rejected: ${JSON.stringify(r).slice(0, 200)}`);
  return r.data;
}

/** Poll until the task yields an https URL; throws on failure or after CAP_MS. */
async function poll(taskId) {
  const t0 = Date.now();
  while (Date.now() - t0 < CAP_MS) {
    await sleep(POLL_MS);
    let r;
    try {
      r = await postJson('nano_banana_image_query', { task_id: taskId }, 30_000);
    } catch (e) {
      log(`  poll ${taskId}: ${e.message} (will retry)`);
      continue;
    }
    const d = Array.isArray(r.data) ? r.data.find((u) => typeof u === 'string') : r.data;
    if (typeof d === 'string' && d.startsWith('https://')) return d;
    const msg = String(r.message ?? '');
    if (!r.success && msg && !/running|processing|pending|queue|进行|排队|生成中/i.test(msg)) throw new Error(`task failed: ${msg}`);
  }
  throw new Error(`task ${taskId} timed out after ${CAP_MS / 60000} min`);
}

async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!png && !jpg) throw new Error(`download is not an image (${buf.length} bytes)`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.part', buf);
  fs.renameSync(file + '.part', file);
}

/** Roll one image into rawFile: an edit of `editFrom` (uploaded URL) or a fresh roll with the job's refs. */
async function generate(job, rawFile, editFrom = null) {
  const label = job.cand ? `${job.out}#${job.cand}` : job.out;
  const images = editFrom ? [editFrom] : await Promise.all(job.refs.map(uploadOnce));
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      const id = await submit(job, editFrom ? job.edit : job.prompt, images);
      log(`${label}: submitted ${id} (try ${attempt}, ${job.model}${editFrom ? ', edit' : ''}${images.length ? `, ${images.length} image(s)` : ''})`);
      const url = await poll(id);
      await download(url, rawFile);
      log(`${label}: saved ${path.relative(ROOT, rawFile)} from ${url}`);
      return;
    } catch (e) {
      log(`${label}: try ${attempt}/${TRIES} failed: ${e.message}`);
      if (attempt < TRIES) await sleep(5000 * attempt * attempt);
    }
  }
  throw new Error(`${label}: gave up after ${TRIES} tries`);
}

/** Run tools/cutout.py with args; resolves with its summary line. */
function py(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-E', path.join(ROOT, 'tools/cutout.py'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`cutout exit ${code}: ${out.trim()}`))));
  });
}

const cutout = (job, rawFile, dest) => py([rawFile, path.join(dest, job.out), ...job.cut]);

/** Keep the previous raw as history before re-rolling, so a worse re-roll can be undone. */
function archive(rawFile) {
  if (!fs.existsSync(rawFile)) return;
  const dir = path.join(path.dirname(rawFile), 'history');
  fs.mkdirSync(dir, { recursive: true });
  const t = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  fs.renameSync(rawFile, path.join(dir, `${path.basename(rawFile, '.png')}.${t}.png`));
}

/** Candidate file: '3' = fresh roll raw/<out>.cand3.png, 'e2' = edit raw/<out>.edit2.png. */
const candFile = (out, c) => path.join(RAW, `${out}.${String(c).startsWith('e') ? `edit${String(c).slice(1)}` : `cand${c}`}.png`);

const uploads = new Map();
/** Upload a repo-relative reference image once per run. */
function uploadOnce(rel) {
  const file = path.resolve(ROOT, rel);
  if (!uploads.has(file)) {
    if (!fs.existsSync(file)) throw new Error(`missing reference image ${rel}`);
    uploads.set(file, upload(file));
  }
  return uploads.get(file);
}

const editInputs = new Map();
/** Upload the image an edit job starts from (its current raw, or the outpaint canvas built from it), once per run. */
function editInput(job) {
  if (!editInputs.has(job.out)) {
    editInputs.set(job.out, (async () => {
      const rawFile = path.join(RAW, `${job.out}.png`);
      if (!fs.existsSync(rawFile)) throw new Error(`--edit needs an existing raw ${path.relative(ROOT, rawFile)}`);
      if (!job.canvas) return upload(rawFile);
      const base = path.join(RAW, `${job.out}.canvas`);
      log(`${job.out}: canvas ${await py([rawFile, base, ...job.canvas, '--max-h', '4096', '--png'])}`);
      return upload(`${base}.png`);
    })());
  }
  return editInputs.get(job.out);
}

async function runJob(job, args) {
  if (job.cand) {
    const file = candFile(job.out, job.cand);
    if (!args.force && fs.existsSync(file)) return;
    await generate(job, file, String(job.cand).startsWith('e') ? await editInput(job) : null);
    return;
  }
  const rawFile = path.join(RAW, `${job.out}.png`);
  if (job.pick) {
    const from = candFile(job.out, job.pick);
    if (!fs.existsSync(from)) throw new Error(`no candidate ${path.relative(ROOT, from)}`);
    archive(rawFile);
    fs.copyFileSync(from, rawFile);
    log(`${job.out}: picked candidate ${job.pick}`);
    log(`${job.out}: cutout ${await cutout(job, rawFile, args.dest)}`);
    return;
  }
  const fresh = args.force || !fs.existsSync(rawFile);
  if (fresh) {
    archive(rawFile);
    await generate(job, rawFile);
  }
  const shipped = fs.existsSync(path.join(args.dest, `${job.out}.webp`));
  if (fresh || args.recut || !shipped) log(`${job.out}: cutout ${await cutout(job, rawFile, args.dest)}`);
}

const MANIFEST = path.join(ROOT, 'src/data/assets.ts');
const MOODS = ['main', 'smug', 'hurt', 'eyes'];
const ART_KEYS = ['title', 'menu', 'results', 'garage'];

/** Shipped WebP files of one public/assets subfolder whose names match re, sorted naturally. */
function listShipped(dir, re) {
  const abs = path.join(DEST, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .map((f) => re.exec(f))
    .filter(Boolean)
    .sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
    .map((m) => ({ rel: `${dir}/${m[0]}`, m }));
}

const q = (s) => `'${s}'`;
const objLines = (entries, indent = '  ') => entries.map(([k, v]) => `${indent}${k}: ${v},`).join('\n');

/** Regenerate src/data/assets.ts from the files that exist under public/assets (atomic write). */
function writeManifest() {
  const portraits = new Map();
  for (const { rel, m } of listShipped('portraits', /^([a-z]+)_(main|smug|hurt|eyes)\.webp$/)) {
    if (!portraits.has(m[1])) portraits.set(m[1], {});
    portraits.get(m[1])[m[2]] = rel;
  }
  const art = new Map(listShipped('art', /^([a-z]+)\.webp$/).filter(({ m }) => ART_KEYS.includes(m[1])).map(({ rel, m }) => [m[1], rel]));
  const loading = listShipped('art', /^loading_(\d+)\.webp$/).map(({ rel }) => rel);
  if (loading.length) art.set('loading', loading[0]);
  const bills = new Map();
  for (const { rel, m } of listShipped('billboards', /^(coast|city|mountain)_(\d+)\.webp$/)) {
    if (!bills.has(m[1])) bills.set(m[1], []);
    bills.get(m[1]).push(rel);
  }
  const portraitLines = [...portraits].map(([id, set]) =>
    `  ${id}: { ${MOODS.filter((k) => set[k]).map((k) => `${k}: ${q(set[k])}`).join(', ')} },`).join('\n');
  const src = `// GENERATED by \`node tools/gen-image.mjs --manifest\` from the files in public/assets — do not edit
// by hand (assets unit). Paths are relative to public/assets; resolve them with assetUrl().
// Consumers must tolerate missing entries (fallback silhouettes / plain panels) and broken files.
import type { CharacterId, TrackId } from '../core/types';

export interface PortraitSet { main?: string; smug?: string; hurt?: string; eyes?: string }

export const assetUrl = (rel: string): string => \`\${import.meta.env.BASE_URL}assets/\${rel}\`;

/** Per character: main = 3/4 riding pose, smug / hurt = busts (transparent cut-outs, about 3:4,
 *  ≤ 900 px tall); eyes = full-bleed 16:9 close-up strip for skill cut-ins. */
export const PORTRAITS: Partial<Record<CharacterId, PortraitSet>> = {
${portraitLines}
};

/** Key art. title, garage: full-bleed 16:9 (garage keeps a dark calm centre for the 3D bike).
 *  menu: transparent pelican cut-out. loading (= LOADING_ART[0]), results: transparent vignettes. */
export const ART: Partial<Record<'title' | 'menu' | 'loading' | 'results' | 'garage', string>> = {
${objLines([...art].map(([k, v]) => [k, q(v)]))}
};

/** Every loading-screen vignette (transparent cut-outs); pick one per load. */
export const LOADING_ART: string[] = [${loading.map(q).join(', ')}];

/** Text-free 16:9 roadside posters per track; each keeps a calm band at the top for overlaid text. */
export const BILLBOARDS: Partial<Record<TrackId, string[]>> = {
${objLines([...bills].map(([k, v]) => [k, `[${v.map(q).join(', ')}]`]))}
};
`;
  fs.writeFileSync(MANIFEST + '.part', src);
  fs.renameSync(MANIFEST + '.part', MANIFEST);
  const nBills = [...bills.values()].reduce((n, v) => n + v.length, 0);
  log(`manifest: ${portraits.size} portrait sets, ${art.size} art, ${loading.length} loading, ${nBills} billboards`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.manifest) {
    writeManifest();
    return;
  }
  let jobs = parsePrompts(fs.readFileSync(args.prompts, 'utf8'));
  if (args.only) jobs = jobs.filter((j) => matches(j.out, args.only));
  if (args.pick) jobs = jobs.filter((j) => args.pick.has(j.out)).map((j) => ({ ...j, pick: args.pick.get(j.out) }));
  else if (args.edit) {
    const missing = jobs.filter((j) => !j.edit).map((j) => j.out);
    if (missing.length) throw new Error(`--edit: no \`> edit:\` instruction for ${missing.join(', ')}`);
    jobs = jobs.flatMap((j) => Array.from({ length: args.variants || 1 }, (_, i) => ({ ...j, cand: `e${i + 1}` })));
  } else if (args.variants) jobs = jobs.flatMap((j) => Array.from({ length: args.variants }, (_, i) => ({ ...j, cand: i + 1 })));
  if (args.list) {
    for (const j of jobs) console.log(`${j.out}  ${j.aspect}  ${j.mode}  ${fs.existsSync(path.join(RAW, j.out + '.png')) ? 'raw' : '-'}`);
    return;
  }
  if (!jobs.length) throw new Error('no jobs match');
  log(`run: ${jobs.length} job(s), ${args.jobs} concurrent${args.force ? ', force' : ''}${args.recut ? ', recut' : ''}`);
  const queue = [...jobs];
  const failed = [];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await runJob(job, args);
      } catch (e) {
        failed.push(job.out);
        log(`${job.out}: FAILED ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(args.jobs, jobs.length) }, worker));
  if (!args.variants && !args.edit && args.dest === DEST) writeManifest();
  log(`done: ${jobs.length - failed.length} ok, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''}`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`[gen-image] ${e.message}`);
    process.exitCode = 1;
  });
}
