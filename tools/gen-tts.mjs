#!/usr/bin/env node
// Generates the Chinese voice lines with the internal MiniMax TTS API (IOA VPN only; never used at
// runtime): POST https://ys-api.xaminim.com/api/minimax_tts {text, voice_id, speed, emotion, pitch}
// → {success, data: mp3 URL}. Downloads, trims silence + loudness-normalises with ffmpeg (if
// installed), writes public/assets/voice/<id>.mp3 and regenerates src/data/voice.ts from the files
// that exist. Unreachable API = warning + exit 0 (existing files and manifest stay valid).
//   node tools/gen-tts.mjs [--force] [--only ann_ko,goose_taunt_0] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public/assets/voice');
const MANIFEST = path.join(ROOT, 'src/data/voice.ts');
const API = 'https://ys-api.xaminim.com/api/minimax_tts';
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');
const ONLY = (() => { const i = args.indexOf('--only'); return i >= 0 ? new Set((args[i + 1] ?? '').split(',')) : null; })();

// Speakers: TTS voice + delivery. Fallback voice is used if the first one is rejected.
const SPEAKERS = {
  announcer: { voice: 'Chinese (Mandarin)_Male_Announcer', fallback: 'presenter_male', speed: 1.15, emotion: 'surprised' },
  pelican: { voice: 'junlang_nanyou', fallback: 'male-qn-qingse', speed: 1.1, emotion: 'happy' },
  goose: { voice: 'male-qn-badao', fallback: 'male-qn-jingying', speed: 1.1, emotion: 'angry' },
  capybara: { voice: 'Chinese (Mandarin)_Gentleman', fallback: 'audiobook_male_1', speed: 0.8, emotion: 'neutral' },
  cat: { voice: 'qiaopi_mengmei', fallback: 'lovely_girl', speed: 1.1, emotion: 'happy' },
  shiba: { voice: 'clever_boy', fallback: 'cute_boy', speed: 0.95, emotion: 'neutral' },
  pigeon: { voice: 'cute_boy', fallback: 'clever_boy', speed: 1.15, emotion: 'neutral' },
  penguin: { voice: 'male-qn-jingying', fallback: 'male-qn-qingse', speed: 1.0, emotion: 'neutral' },
  seagull: { voice: 'Chinese (Mandarin)_Southern_Young_Man', fallback: 'male-qn-qingse', speed: 1.15, emotion: 'happy' },
  sloth: { voice: 'Chinese (Mandarin)_Humorous_Elder', fallback: 'audiobook_male_1', speed: 1.0, emotion: 'neutral' },
  corgi: { voice: 'Chinese (Mandarin)_Straightforward_Boy', fallback: 'clever_boy', speed: 1.1, emotion: 'angry' },
};

// id, speaker, kind, text (= the on-screen line it voices), say (spoken form, if different).
const LINES = [
  ['ann_3', 'announcer', 'announcer', '三！'],
  ['ann_2', 'announcer', 'announcer', '二！'],
  ['ann_1', 'announcer', 'announcer', '一！'],
  ['ann_go', 'announcer', 'announcer', '冲！'],
  ['ann_ko', 'announcer', 'announcer', '击倒！'],
  ['ann_double', 'announcer', 'announcer', '双杀！'],
  ['ann_triple', 'announcer', 'announcer', '三杀！'],
  ['ann_showtime', 'announcer', 'announcer', 'SHOWTIME！', 'Show time！'],
  ['ann_perfect', 'announcer', 'announcer', '完美落地！'],
  ['ann_place1', 'announcer', 'announcer', '第一名！'],
  ['ann_place2', 'announcer', 'announcer', '第二名！'],
  ['ann_place3', 'announcer', 'announcer', '第三名！'],
  ['ann_finish', 'announcer', 'announcer', '冲线！'],
  ['ann_busted', 'announcer', 'announcer', '被抓了！'],
  ['ann_final', 'announcer', 'announcer', '最后冲刺！'],
  ['ann_wrecked', 'announcer', 'announcer', '翻车了！'],
  ['ann_onemore', 'announcer', 'announcer', 'ONE MORE！', 'One more！'],
  ['ann_lead', 'announcer', 'announcer', '领先了！'],
  ['ann_nearmiss', 'announcer', 'announcer', '好险！'],
  ['pelican_taunt_0', 'pelican', 'taunt', '嘴大吃四方！'],
  ['pelican_taunt_1', 'pelican', 'taunt', '让一让，鹈鹕要过了！'],
  ['pelican_ko_0', 'pelican', 'ko', '一口一个！'],
  ['pelican_ko_1', 'pelican', 'ko', '下一位！'],
  ['pelican_hurt_0', 'pelican', 'hurt', '我的嘴……', '我的嘴……'],
  ['goose_taunt_1', 'goose', 'taunt', '嘎！！', '嘎！'],
  ['goose_taunt_2', 'goose', 'taunt', '看什么看，没见过鹅骑车？'],
  ['goose_ko_1', 'goose', 'ko', '鹅的地盘！'],
  ['goose_hurt_1', 'goose', 'hurt', '这不可能！'],
  ['capybara_taunt_0', 'capybara', 'taunt', '那咋了。'],
  ['capybara_taunt_1', 'capybara', 'taunt', '不急，不急。'],
  ['capybara_ko_0', 'capybara', 'ko', '不好意思，我没急。'],
  ['capybara_ko_1', 'capybara', 'ko', '躺赢。'],
  ['capybara_hurt_1', 'capybara', 'hurt', '也行吧。'],
  ['cat_taunt_0', 'cat', 'taunt', '哈基米~', '哈基米～'],
  ['cat_taunt_2', 'cat', 'taunt', '喵（不屑）', '喵。'],
  ['cat_ko_0', 'cat', 'ko', '推下去了喵。'],
  ['cat_ko_1', 'cat', 'ko', '下一个杯子是谁？'],
  ['cat_hurt_0', 'cat', 'hurt', '喵呜！'],
  ['shiba_taunt_0', 'shiba', 'taunt', 'such fast.', 'Such fast.'],
  ['shiba_taunt_2', 'shiba', 'taunt', '汪！（墨镜反光）', '汪！'],
  ['shiba_ko_0', 'shiba', 'ko', 'very ko. wow.', 'Very KO. Wow.'],
  ['shiba_hurt_0', 'shiba', 'hurt', 'much pain.', 'Much pain.'],
  ['shiba_hurt_1', 'shiba', 'hurt', '呜汪……'],
  ['pigeon_taunt_0', 'pigeon', 'taunt', '咕咕咕。'],
  ['pigeon_taunt_1', 'pigeon', 'taunt', '在路上了在路上了。'],
  ['pigeon_taunt_2', 'pigeon', 'taunt', '下次一定！'],
  ['pigeon_ko_1', 'pigeon', 'ko', '鸽了你。'],
  ['pigeon_hurt_1', 'pigeon', 'hurt', '我会回来的（大概）', '我会回来的……大概。'],
  ['penguin_taunt_0', 'penguin', 'taunt', '滑就完事了。'],
  ['penguin_taunt_1', 'penguin', 'taunt', '冰面太少，差评。'],
  ['penguin_ko_0', 'penguin', 'ko', '滑铲成功！'],
  ['penguin_ko_1', 'penguin', 'ko', '冷静点。'],
  ['penguin_hurt_0', 'penguin', 'hurt', '冰……冰呢……'],
  ['seagull_taunt_0', 'seagull', 'taunt', 'MINE!', 'Mine！'],
  ['seagull_taunt_1', 'seagull', 'taunt', '薯条交出来！'],
  ['seagull_taunt_2', 'seagull', 'taunt', '这条路也是我的。'],
  ['seagull_ko_1', 'seagull', 'ko', '谢谢款待。'],
  ['seagull_hurt_0', 'seagull', 'hurt', '我的薯条！'],
  ['sloth_taunt_0', 'sloth', 'taunt', '你……好……'],
  ['sloth_taunt_1', 'sloth', 'taunt', '马……上……到……'],
  ['sloth_ko_1', 'sloth', 'ko', '早……说……了……'],
  ['sloth_hurt_0', 'sloth', 'hurt', '哎……呀……'],
  ['corgi_taunt_0', 'corgi', 'taunt', '靠边停车！'],
  ['corgi_taunt_2', 'corgi', 'taunt', '驾驶证、行车证、鱼证！'],
  ['corgi_ko_0', 'corgi', 'ko', '抓到你了！'],
  ['corgi_hurt_0', 'corgi', 'hurt', '袭警？！'],
];

/** Roster lines voiced per character (first N of each list in src/data/roster.ts; bubbles match by text):
 *  every taunt (a voiced bubble next to a honk-only one sounds broken), the first KO / hurt lines. */
const ROSTER_CAP = { taunts: Infinity, koLines: 3, hurtLines: 3 };
const KIND_OF = { taunts: 'taunt', koLines: 'ko', hurtLines: 'hurt' };

/** Stage directions (（不屑）) are not spoken; ~ reads as a drawn-out ～; all-caps words are words, not letters. */
const spoken = (text) => text.replace(/（[^）]*）|\([^)]*\)/g, '').replace(/~/g, '～')
  .replace(/\b[A-Z]{2,}\b/g, (w) => w[0] + w.slice(1).toLowerCase()).replace(/!+/g, '！').trim();

/** Add the roster's first lines that have no clip yet (ids <character>_<kind>_<index in the list>). */
function addRosterLines() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/roster.ts'), 'utf8');
  const texts = new Set(LINES.map((l) => l[3]));
  const ids = new Set(LINES.map((l) => l[0]));
  for (const speaker of Object.keys(SPEAKERS)) {
    const block = src.split(new RegExp(`\\bid: '${speaker}'`))[1]?.split(/\bid: '/)[0] ?? '';
    for (const [list, cap] of Object.entries(ROSTER_CAP)) {
      const body = (block.match(new RegExp(`${list}: \\[([\\s\\S]*?)\\]`)) ?? [])[1] ?? '';
      const items = [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
      items.slice(0, cap).forEach((text, i) => {
        const id = `${speaker}_${KIND_OF[list]}_${i}`;
        if (texts.has(text) || ids.has(id) || !/\p{L}/u.test(spoken(text))) return;
        LINES.push([id, speaker, KIND_OF[list], text, spoken(text) === text ? undefined : spoken(text)]);
      });
    }
  }
}
addRosterLines();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(body, timeoutMs = 30000) {
  const res = await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** TTS one line → mp3 URL. Tries the speaker's voice, then its fallback; 3 attempts each with backoff. */
async function synth(say, sp) {
  let lastErr = null;
  for (const voice of [sp.voice, sp.fallback]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const json = await post({ text: say, voice_id: voice, speed: sp.speed, emotion: sp.emotion });
        if (json.success && typeof json.data === 'string' && json.data.startsWith('http')) return { url: json.data, voice };
        lastErr = new Error(String(json.message ?? 'no data'));
        if (/voice id not exist/.test(String(json.message))) break;
      } catch (err) {
        lastErr = err;
      }
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error('tts failed');
}

function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/** Frames (20 ms) quieter than this are pauses / tails, not speech. */
const ACTIVE_DB = -50;

/**
 * Active-speech RMS (dB over the 20 ms frames above ACTIVE_DB, so tails and pauses do not pull a
 * short word's level down) and duration (s) of an audio file, from its decoded 32 kHz mono PCM.
 */
function measure(file) {
  const pcm = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '32000', '-'], { maxBuffer: 64 << 20 }).stdout;
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
  const frame = 640;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + frame <= x.length; i += frame) {
    let e = 0;
    for (let j = i; j < i + frame; j++) e += x[j] * x[j];
    if (10 * Math.log10(e / frame + 1e-20) > ACTIVE_DB) { sum += e; n += frame; }
  }
  return { rms: n ? 10 * Math.log10(sum / n) : NaN, seconds: x.length / 32000 };
}

/** Clips shorter than this skip loudnorm's short-input mode: their active-speech RMS is matched to the set's. */
const SHORT_S = 0.6;
const TARGET_RMS = -16;
/** Longest clip (s): a bark blocks the others while it plays; longer takes are time-compressed (pitch kept). */
const MAX_S = 2.4;

/**
 * Trim leading / trailing silence and squeeze long inner pauses to 0.15 s (barks stay short),
 * normalise loudness (loudnorm; takes over MAX_S time-compressed, short ones without loudnorm's
 * short-input mode), then match every clip's active-speech RMS to TARGET_RMS (limited at −2 dBFS):
 * one-word lines no longer jump out of the set. WAV in between, one MP3 encode (mono 32 kHz, 80 kbps).
 */
function polish(src, dst) {
  const trim = 'silenceremove=start_periods=1:start_threshold=-48dB:stop_periods=-1:stop_threshold=-48dB:stop_duration=0.25:stop_silence=0.15';
  const wav = `${dst}.tmp.wav`;
  const render = (af) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af', af, '-ar', '32000', '-ac', '1', wav]);
  render(`${trim},loudnorm=I=-16:TP=-2:LRA=9`);
  let m = measure(wav);
  if (m.seconds > MAX_S) render(`${trim},atempo=${Math.min(2, m.seconds / MAX_S).toFixed(3)},loudnorm=I=-16:TP=-2:LRA=9`);
  else if (m.seconds < SHORT_S) render(trim);
  m = measure(wav);
  const gain = Number.isFinite(m.rms) ? (TARGET_RMS - m.rms).toFixed(1) : '0';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', `volume=${gain}dB,alimiter=limit=0.79:level=disabled,afade=t=in:d=0.005`,
    '-ar', '32000', '-ac', '1', '-b:a', '80k', dst]);
  fs.rmSync(wav, { force: true });
}

async function makeLine([id, speaker, , text, say], tmpDir, ffmpeg) {
  const file = path.join(OUT, `${id}.mp3`);
  if (!FORCE && fs.existsSync(file)) return 'kept';
  const sp = SPEAKERS[speaker];
  // A spoken ellipsis is a short pause, not a drawl (……  → …).
  const { url, voice } = await synth((say ?? text).replace(/……/g, '…'), sp);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const raw = path.join(tmpDir, `${id}.raw.mp3`);
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  if (ffmpeg) polish(raw, file);
  else fs.copyFileSync(raw, file);
  fs.rmSync(raw, { force: true });
  return `made (${voice})`;
}

function writeManifest() {
  const rows = LINES.filter(([id]) => fs.existsSync(path.join(OUT, `${id}.mp3`)));
  const body = rows.map(([id, speaker, kind, text]) =>
    `  ${JSON.stringify(id)}: { id: ${JSON.stringify(id)}, text: ${JSON.stringify(text)}, file: ${JSON.stringify(`assets/voice/${id}.mp3`)}, speaker: ${JSON.stringify(speaker)}, kind: ${JSON.stringify(kind)} },`,
  ).join('\n');
  const src = `// Voice line manifest — GENERATED by tools/gen-tts.mjs (do not edit by hand).
// text = the on-screen line this clip voices (taunt bubbles are matched by exact text).
export type VoiceKind = 'announcer' | 'taunt' | 'ko' | 'hurt';
export interface VoiceLine { id: string; text: string; file: string; speaker: string; kind: VoiceKind }
export const VOICE: Record<string, VoiceLine> = {
${body}
};
`;
  fs.writeFileSync(MANIFEST, src);
  return rows.length;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const todo = LINES.filter(([id]) => !ONLY || ONLY.has(id));
  if (DRY) {
    for (const l of todo) console.log(l[0], SPEAKERS[l[1]].voice, l[4] ?? l[3]);
    return;
  }
  try {
    await post({ text: '测试', voice_id: SPEAKERS.announcer.voice }, 8000);
  } catch (err) {
    console.warn(`[gen-tts] TTS API unreachable (${err.message}); connect IOA VPN. Keeping existing files; manifest rebuilt from disk.`);
    console.log(`[gen-tts] manifest: ${writeManifest()} lines`);
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(process.env.HOME ?? '/tmp', 'm', 'tts-'));
  const ffmpeg = hasFfmpeg();
  if (!ffmpeg) console.warn('[gen-tts] ffmpeg not found: clips are used unprocessed');
  const queue = todo.slice();
  const failed = [];
  const worker = async () => {
    for (let line = queue.shift(); line; line = queue.shift()) {
      try {
        console.log(`[gen-tts] ${line[0]}: ${await makeLine(line, tmpDir, ffmpeg)}`);
      } catch (err) {
        failed.push(line[0]);
        console.warn(`[gen-tts] ${line[0]} failed: ${err.message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`[gen-tts] manifest: ${writeManifest()} lines${failed.length ? `; failed: ${failed.join(', ')}` : ''}`);
}

main().catch((err) => {
  console.error('[gen-tts] fatal', err);
  process.exit(1);
});
