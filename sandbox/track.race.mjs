#!/usr/bin/env node
// In-game soak for the track: autopilot race, restart (dispose + rebuild), quit to menu.
// Checks: no errors, exactly one track group in the scene, scene fog restored after quitting.
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
await withPage(async (page, h) => {
  await h.goto(`/?race=coast&seed=${a.seed ?? 4}&autopilot=1${a.q ?? ''}`);
  await h.step(Number(a.frames ?? 1500));
  const groups = () => h.eval(`window.__br.app.scene.children.flatMap((c) => [c, ...c.children]).filter((o) => String(o.name).startsWith('track:')).length`);
  const first = { groups: await groups(), snap: await h.snapshot(), trackDebug: await h.eval('!!window.__br.track') };
  await h.eval(`window.__br.app.bus.emit('flow:restartRace', {})`);
  await page.waitForFunction(() => window.__br.session() && window.__br.session().phase !== undefined, null, { timeout: 60000 });
  await h.sleep(1500);
  await h.step(300);
  const second = { groups: await groups(), snap: await h.snapshot() };
  await h.eval(`window.__br.app.bus.emit('flow:quitRace', {})`);
  await h.sleep(800);
  const after = { groups: await groups(), fog: await h.eval('window.__br.app.scene.fog === null'), trackDebug: await h.eval('!!window.__br.track') };
  const errors = await h.errors();
  console.log(JSON.stringify({ first: { groups: first.groups, phase: first.snap.phase, player: first.snap.riders?.[0], trackDebug: first.trackDebug }, second: { groups: second.groups, phase: second.snap.phase }, after, errors: errors.slice(0, 8), console: h.logs.slice(0, 8) }, null, 1));
});
