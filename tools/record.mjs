#!/usr/bin/env node
// Record a deterministic clip: manual-steps the game at a fixed dt and screenshots every frame, then
// encodes with ffmpeg.  node tools/record.mjs --url "/?race=coast&seed=3&autopilot=1" --seconds 12
//   [--fps 30] [--warm 240] [--size 1280x720] [--out shots/rec/clip.mp4] [--eval "js before recording"]
//   [--controls '{"throttle":1}'] [--gif]   (--warm = frames stepped before recording starts)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, withPage } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const fps = Number(a.fps ?? 30);
const frames = Math.round(Number(a.seconds ?? 10) * fps);
const out = a.out ?? 'shots/rec/clip.mp4';
const tmp = path.join(path.dirname(out), `.frames-${process.pid}`);
fs.mkdirSync(tmp, { recursive: true });
try {
  await withPage(async (page, h) => {
    await h.goto(a.url ?? '/?race=coast&seed=3&autopilot=1');
    if (a.controls) await h.controls(JSON.parse(a.controls));
    await h.step(Number(a.warm ?? 240), 1 / fps);
    if (a.eval) await h.eval(a.eval);
    for (let i = 0; i < frames; i++) {
      await h.step(1, 1 / fps);
      await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(5, '0')}.png`) });
    }
    const errs = await h.errors();
    if (errs.length) console.log('page errors:', errs.slice(0, 5));
  }, { size: a.size ?? '1280x720' });
  const pattern = path.join(tmp, 'f%05d.png');
  if (a.gif) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', pattern, '-vf',
      'fps=20,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', out.replace(/\.mp4$/, '.gif')]);
  } else {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out]);
  }
  console.log('wrote', a.gif ? out.replace(/\.mp4$/, '.gif') : out);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
