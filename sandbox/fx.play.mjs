// fx gameplay sampler: autopilot race, periodic screenshots + fx stats (critics rerun it).
//   node sandbox/fx.play.mjs [--track coast] [--frames 1800] [--every 120] [--q "&quality=medium"]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const track = a.track ?? 'coast';
const frames = Number(a.frames ?? 1800);
const every = Number(a.every ?? 120);
const q = typeof a.q === 'string' ? a.q : '';

await withPage(async (page, h) => {
  await h.goto(`/?race=${track}&seed=${a.seed ?? 5}&autopilot=1${q}`);
  const counts = await page.evaluate(() => {
    const c = {};
    const bus = window.__br.app.bus;
    for (const ev of ['combat:hit', 'combat:ko', 'rider:drift', 'rider:boost', 'rider:land', 'rider:crash', 'pickup:take', 'skill:cast', 'rider:offroad', 'rider:bump']) {
      c[ev] = 0;
      bus.on(ev, () => { c[ev]++; });
    }
    window.__fxCounts = c;
    return c;
  });
  for (let f = 0; f < frames; f += every) {
    await h.step(every);
    await h.shot(`shots/fx/play-${track}-${String(f + every).padStart(4, '0')}.png`);
  }
  const out = await page.evaluate(() => ({ counts: window.__fxCounts, stats: window.__br.fx.stats(), snap: window.__br.snapshot() }));
  console.log(JSON.stringify({ counts: out.counts, scene: out.stats.scene, particles: out.stats.particles, fps: out.snap.fps, phase: out.snap.phase }));
  console.log(JSON.stringify({ errors: (await h.errors()).filter((e) => e.includes('[fx]') || e.includes('/fx/')).slice(0, 10), allErrors: (await h.errors()).length }));
}, { size: a.size ?? '1280x720' });
