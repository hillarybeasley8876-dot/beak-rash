// Acceptance-round replay of the critics' cinematic probe (shots/accept/r1-aesthetic/cine.mjs) with fx
// telemetry: real game, all rivals around (bystanders), manual frames at 1920x1080, UI on by default.
//   node sandbox/fx.accept.mjs <track> <ko|wrecked|ult|chain> [extraQuery] [tag]   (VICTIM=cat picks the victim)
// -> shots/fx/acc1/<track>-<variant><tag>/NN-<ms>.png, sheet.jpg (contact sheet), log.txt
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withPage } from '../tools/lib.mjs';

const [track = 'coast', variant = 'ko', extra = '', tag = ''] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'shots/fx/acc1', `${track}-${variant}${tag}`);
fs.mkdirSync(OUT, { recursive: true });
const TIMES = (process.env.TIMES ?? '').split(',').filter(Boolean).map(Number);
const DEFAULT = {
  ko: [0.05, 0.2, 0.45, 0.7, 1.0, 1.3, 1.6, 2.0],
  chain: [0.05, 0.2, 0.45, 0.7, 1.0, 1.3, 1.6, 2.0],
  wrecked: [0.05, 0.25, 0.5, 0.75, 1.0, 1.4],
  ult: [0.15, 0.9, 1.3, 1.7, 1.95, 2.15, 2.5, 2.9, 3.4],
}[variant];
const times = TIMES.length ? TIMES : DEFAULT;
const log = [];

await withPage(async (page, h) => {
  await h.goto(`/?race=${track}&seed=3${extra}`);
  await h.controls({ throttle: 1 });
  for (let i = 0; i < 60; i++) {
    const s = await h.snapshot();
    if (s.phase === 'racing') break;
    await h.step(15);
  }
  await h.step(360);
  const info = await page.evaluate(([v, vic]) => {
    const br = window.__br;
    const s = br.session();
    window.__acc = { victims: [] };
    br.app.bus.on('ult:impact', (e) => { window.__acc.victims = e.victims; window.__acc.pos = e.pos; });
    window.__acc.ev = [];
    br.app.bus.on('combat:ko', (e) => { if (!window.__acc.victims.includes(e.victim)) window.__acc.victims.push(e.victim); });
    for (const n of ['combat:ko', 'cine:ko', 'cine:ult']) br.app.bus.on(n, (e) => window.__acc.ev.push([n.slice(0, 6), +br.app.clock.realTime.toFixed(2), e.phase ?? '', e.victim ?? '', e.attacker ?? '', e.chain ?? '']));
    const pick = vic ? s.riders.find((r) => r.character === vic)?.id : undefined;
    if (v === 'ko') return { victim: br.fx.testKo(pick === undefined ? {} : { victim: pick }) };
    if (v === 'chain') return { victim: br.fx.testKo({ chainAfter: 0.3 }) };
    if (v === 'wrecked') return { victim: br.fx.testWrecked() };
    const rivals = s.riders.filter((r) => !r.isPlayer).slice(0, 3);
    rivals.forEach((r, i) => br.combat.pin(r.id, 7 + i * 6, [-1.8, 1.6, -0.4][i], true));
    br.combat.set(0, { sp: 100 });
    br.combat.cast(0, 4);
    return { pinned: rivals.map((r) => r.character) };
  }, [variant, process.env.VICTIM ?? '']);
  log.push(JSON.stringify(info));
  const files = [];
  let t = 0;
  for (const [i, at] of times.entries()) {
    const frames = Math.max(1, Math.round((at - t) * 60));
    await h.step(frames);
    t += frames / 60;
    if (variant === 'ult' && i === 0) await page.evaluate(() => window.__br.combat.unpin());
    const f = path.join(OUT, `${String(i + 1).padStart(2, '0')}-${Math.round(t * 1000)}ms.png`);
    await page.screenshot({ path: f });
    files.push(f);
    const st = await page.evaluate(() => {
      const br = window.__br;
      const fx = br.fx.stats();
      const c = br.fx.post.cine;
      const k = fx.cine.ko;
      const s = br.session();
      const cam = br.app.camera;
      const V = cam.position.constructor;
      // Frame-height fraction (head top + 0.25 m to the bike) and body NDC of a rider; d = metres from the impact.
      const size = (id) => {
        const vw = s.views.get(id);
        if (!vw) return null;
        const pts = ['head', 'body', 'bike'].map((n) => vw.anchor(n, new V()));
        pts.push(pts[0].clone().setY(pts[0].y + 0.25));
        const ys = pts.map((q) => q.clone().project(cam).y);
        const b = pts[1].clone().project(cam);
        const imp = window.__acc.pos;
        const d = imp ? Math.hypot(pts[1].x - imp.x, pts[1].z - imp.z) : null;
        return [s.rider(id).character, +((Math.max(...ys) - Math.min(...ys)) / 2).toFixed(2), +b.x.toFixed(2), +b.y.toFixed(2), d === null ? null : +d.toFixed(1)];
      };
      const sizes = [...window.__acc.victims.map(size), ['P', ...(size(s.player.id) ?? []).slice(1)]];
      return { sizes, scale: +br.app.clock.scale.toFixed(2), ko: k ? `${k.kind} t=${k.t} chain=${k.chain} ${k.framing}` : null, cast: c.cast.size, look: +c.ko.toFixed(2) };
    });
    log.push(`${path.basename(f)} ${JSON.stringify(st)}`);
  }
  log.push('events ' + JSON.stringify(await page.evaluate(() => window.__acc.ev)));
  log.push('errors ' + JSON.stringify(await h.errors()).slice(0, 1500));
  log.push('logs ' + h.logs.slice(0, 10).join('\n').slice(0, 1500));
  execFileSync('python3', [path.join(ROOT, 'sandbox/fx.grid.py'), path.join(OUT, 'sheet.jpg'), '4', '480', ...files]);
}, { size: '1920x1080' });
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
console.log(log.join('\n'));
