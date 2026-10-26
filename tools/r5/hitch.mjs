#!/usr/bin/env node
// r5 acceptance: hitch (no shader program may compile after GO: every r4 prop is warmed behind the loading screen).
// Lead-owned, read-only for workers. Each new program in the middle of a race is a 30–250 ms freeze on a mid GPU;
// before r5 the fish truck, the roadworks and the police roadblock compiled theirs the moment they appeared.
// Per track: a manual race, then every r4 set piece is forced near the player (the four track events, ★3 police with
// the backup and the roadblock, the cloud pelican, thrown weapons) and the race is ridden through them.
//   node tools/r5/hitch.mjs [--tracks coast,city,mountain,watertown,gobi]
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TRACKS = String(a.tracks ?? 'coast,city,mountain,watertown,gobi').split(',').filter(Boolean);

for (const id of TRACKS) {
  await withPage(async (page, h) => {
    await h.goto(`/?race=${id}&seed=11&manual=1&autopilot=1`, { timeout: 120000 });
    const out = await page.evaluate(async () => {
      const b = window.__br;
      b.manual(true);
      for (let i = 0; i < 40 && b.session()?.phase !== 'racing'; i++) b.step(30);
      const r = b.app.renderer, s = b.session();
      const key = (p) => p.cacheKey ?? `${p.name}#${p.id}`;
      const known = new Set(r.info.programs.map(key));
      const late = [];
      const scan = (tag) => {
        for (const p of r.info.programs) if (!known.has(key(p))) { known.add(key(p)); late.push(`${tag}@${s.time.toFixed(1)}`); }
      };
      const ride = async (n, tag) => { for (let i = 0; i < n; i++) { b.step(10); scan(tag); await new Promise((res) => setTimeout(res, 0)); } };
      await ride(30, 'start');
      // the four track events, one after the other, just ahead of the player
      const kinds = ['fishSpill', 'geese', 'roadworks', 'stalls'];
      for (const k of kinds) {
        try { b.events?.force(k, s.player.s + 240); } catch { /* a track without stalls */ }
        await ride(70, k);
      }
      // the police at ★3: wind-ups, the backup, the roadblock
      b.race?.setHeat?.(1);
      await ride(150, 'police');
      // the cloud pelican and thrown weapons
      b.secrets?.forceGod?.();
      await ride(40, 'god');
      for (const w of ['saltfish', 'slipper', 'pan', 'leek', 'umbrella', 'baguette', 'selfie', 'keyboard']) {
        b.combat?.give?.(0, w, 3);
        b.setControls({ throttle: 1, heavy: true, heavyHeld: true }); b.step(2);
        b.setControls({ throttle: 1, heavyHeld: true }); b.step(24);
        b.setControls({ throttle: 1, heavyHeld: false }); await ride(6, `throw:${w}`);
      }
      b.setControls(null);
      await ride(60, 'tail');
      return { late, programs: r.info.programs.length };
    });
    expect(out.late.length === 0, `${id}: no shader program compiles after GO (${out.late.length}: ${out.late.slice(0, 8).join(', ') || 'none'}; ${out.programs} programs)`);
    await noErrors(h, `${id} hitch`);
  }, { size: '960x540' });
}

finish('r5-hitch');
