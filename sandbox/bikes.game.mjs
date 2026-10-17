#!/usr/bin/env node
// In-game check: start a race with the given bike for the player and every rival, drive N frames, screenshot
// the chase view and report draw calls / triangles / bike counts and errors.
//   node sandbox/bikes.game.mjs --bike tandem [--stub world,combat] [--frames 300] [--out shots/bikes/game.png]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
const bike = a.bike ?? 'roadbike';
const stub = a.stub ? `&stub=${a.stub}` : '';
await withPage(async (page, h) => {
  await h.goto(`/?race=${a.track ?? 'coast'}&seed=2&traffic=0&police=0&bike=${bike}${stub}`);
  await h.controls({ throttle: 1 });
  await h.step(Number(a.frames ?? 300));
  await h.shot(a.out ?? `shots/bikes/game-${bike}.png`);
  const info = await h.eval(() => {
    const app = window.__br.app;
    const r = app.renderer.info.render;
    const bikes = [];
    app.scene.traverse((o) => { if (o.name.startsWith('bike:')) bikes.push(o.name); });
    let bikeCalls = 0;
    app.scene.traverse((o) => { if (o.isMesh && o.visible && /^bike:(body|hull)$/.test(o.name)) bikeCalls++; });
    return { calls: r.calls, triangles: r.triangles, bikes, bikeMeshes: bikeCalls, fps: Math.round(window.__br.game.fps) };
  });
  console.log(JSON.stringify({ ...info, errors: (await h.errors()).slice(0, 5), console: h.logs.slice(0, 8) }, null, 1));
});
