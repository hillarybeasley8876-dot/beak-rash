#!/usr/bin/env node
// r6 acceptance: roadworks (SPEC §19 fixed — the user saw traffic drive straight into the work zone and barrier
// meshes clipping / flickering). Lead-owned, read-only for workers.
// Before r6: barriers were rigid 14 m slabs butted end to end (they overlap as soon as the road bends → coplanar tops
// z-fight), the instance pools drew every unused slot at the world origin (23 stacked copies), and traffic only looked
// at vehicles and riders (816 vehicle-frames inside barriers in 50 s on the coast).
//   node tools/r6/roadworks.mjs [--tracks coast,mountain,city]
import { parseArgs } from '../lib.mjs';
import { expect, finish, hold, noErrors, race, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const TRACKS = String(a.tracks ?? 'coast,mountain,city').split(',').filter(Boolean);

for (const track of TRACKS) {
  await withPage(async (page, h) => {
    await race(page, h, { track, seed: 5, extra: '&traffic=1&police=0' });
    await page.evaluate(() => { const b = window.__br, s = b.session(); for (const r of s.riders) if (!r.isPlayer) b.teleport(r.id, s.player.s + 1500 + r.id * 12, 0); });
    // 1. Geometry: force a work zone 190 m ahead (inside the director's start distance) and inspect its barriers.
    const geo = await page.evaluate(() => {
      const b = window.__br, s = b.session();
      b.events.force('roadworks', s.player.s + 190);
      b.step(4);
      const bars = s.obstacles.filter((o) => o.kind === 'barrier' && o.active && o.solid).sort((p, q) => p.s - q.s || p.x - q.x);
      // overlapping pieces along the road at the same lateral spot = coincident faces (the flicker); pieces that butt
      // end to end with no gap overlap as soon as the road bends (rigid boxes): consecutive pieces keep a small gap
      let overlaps = 0, butted = 0, holes = 0;
      for (let i = 0; i < bars.length; i++) {
        for (let j = i + 1; j < bars.length; j++) {
          const p = bars[i], q = bars[j];
          if (q.s - p.s > p.halfLength + q.halfLength + 1.5) break;
          const ds = Math.abs(q.s - p.s) - (p.halfLength + q.halfLength);
          const dx = Math.abs(q.x - p.x) - (p.halfWidth + q.halfWidth);
          if (ds < -0.05 && dx < -0.05) overlaps++;
          else if (dx < -0.3 && Math.abs(q.s - p.s) > 0.01) {
            if (ds < 0.05) butted++;
            else if (ds > 0.8) holes++;
          }
        }
      }
      // the instanced barrier meshes: every piece follows the road (its local up stays within 3° of the road normal)
      const group = s.world.getObjectByName('race:event:roadworks');
      const out = { n: bars.length, overlaps, butted, holes, longest: Math.max(0, ...bars.map((o) => o.halfLength * 2)), tilt: 0, meshes: 0, flushFeet: 0, stray: 0 };
      if (group) {
        const Mat = group.matrixWorld.constructor;
        group.updateMatrixWorld(true);
        group.traverse((m) => {
          if (!m.isInstancedMesh || !m.count) return;
          out.meshes++;
          const mat = new Mat();
          for (let i = 0; i < m.count; i++) {
            m.getMatrixAt(i, mat);
            const e = mat.elements;
            // an unused pool slot left at the identity draws a copy at the world origin (pre-r6: 10 barriers and
            // 13 cones stacked on one spot → the flicker the user saw)
            if (e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0) { out.stray++; continue; }
            const up = [e[4], e[5], e[6]];
            const len = Math.hypot(...up) || 1;
            const pos = [e[12], e[13], e[14]];
            const tp = s.track.project({ x: pos[0], y: pos[1], z: pos[2] });
            const f = s.track.frameAt(tp.s);
            const dot = (up[0] * f.up.x + up[1] * f.up.y + up[2] * f.up.z) / len;
            out.tilt = Math.max(out.tilt, Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI);
          }
          // a box face flush with the asphalt flickers: the lowest vertex of the instanced geometry must sit ≥ 1 cm up
          const pos = m.geometry.getAttribute('position');
          let minY = Infinity;
          for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
          if (minY < 0.01 && minY > -0.01) out.flushFeet++;
        });
      }
      return out;
    });
    expect(geo.n >= 8, `${track}: the work zone puts up barrier pieces (${geo.n})`);
    expect(geo.overlaps === 0, `${track}: no two barrier pieces overlap (coincident faces flicker) (${geo.overlaps} overlapping pairs)`);
    expect(geo.butted === 0 && geo.holes === 0, `${track}: consecutive pieces leave a 5–80 cm gap (no butted ends that overlap on bends, no holes) (${geo.butted} butted, ${geo.holes} holes)`);
    expect(geo.longest <= 4.2, `${track}: barrier pieces are short (≤ 4.2 m) so they follow curves (${geo.longest.toFixed(1)} m)`);
    expect(geo.meshes >= 1 && geo.tilt <= 3, `${track}: every barrier instance sits square on the road (max tilt ${geo.tilt.toFixed(1)}° over ${geo.meshes} meshes)`);
    expect(geo.stray === 0, `${track}: no unused instance slot is drawn (stacked copies at the world origin flicker) (${geo.stray} stray instances)`);
    expect(geo.flushFeet === 0, `${track}: no barrier / cone geometry has a face flush with the asphalt (z-fighting) (${geo.flushFeet} meshes)`);

    // 2. Traffic: no vehicle drives into a barrier, ever. Watch the zone for 50 s of traffic.
    const traffic = await page.evaluate(async () => {
      const b = window.__br, s = b.session(), p = s.player;
      const bars = s.obstacles.filter((o) => o.kind === 'barrier' && o.active && o.solid);
      if (!bars.length) return null;
      const s0 = Math.min(...bars.map((o) => o.s)) - 10, s1 = Math.max(...bars.map((o) => o.s)) + 10;
      // park the player out of the way just before the zone so the event stays alive, and let traffic run
      b.teleport(0, s0 - 30, 0);
      let inside = 0, seen = new Set(), stopped = 0, vanished = 0, through = 0;
      const last = new Map(), entered = new Map();
      for (let f = 0; f < 60 * 50; f += 4) {
        p.speed = 0; p.s = s0 - 30; p.x = -(s.track.bounds(p.s).left) + 0.8;
        b.step(4);
        const now = b.race.traffic();
        // a vehicle near the zone and the player must never just disappear (despawning cars to dodge the zone)
        for (const [id, v] of last) {
          if (!now.some((x) => x.id === id) && Math.abs(v.s - p.s) < 120) vanished++;
        }
        last.clear();
        for (const v of now) {
          last.set(v.id, v);
          // drove all the way through the zone (either direction)
          const side = v.s < s0 ? -1 : v.s > s1 ? 1 : 0;
          if (side !== 0 && !entered.has(v.id)) entered.set(v.id, side);
          if (side !== 0 && entered.has(v.id) && entered.get(v.id) === -side) { through++; entered.set(v.id, 2); }
        }
        for (const v of now) {
          if (v.s < s0 - 40 || v.s > s1 + 40) continue;
          seen.add(v.id);
          const ob = s.obstacles.find((o) => o.id === v.id);
          if (!ob) continue;
          for (const bar of bars) {
            if (Math.abs(ob.s - bar.s) < ob.halfLength + bar.halfLength - 0.2 && Math.abs(ob.x - bar.x) < ob.halfWidth + bar.halfWidth - 0.2) { inside++; break; }
          }
          if (v.v < 0.5) stopped++;
        }
      }
      return { inside, seen: seen.size, stopped, vanished, through };
    });
    expect(!!traffic && traffic.seen >= 2, `${track}: traffic reaches the work zone (${traffic?.seen} vehicles)`);
    expect(!!traffic && traffic.inside === 0, `${track}: no vehicle ever overlaps a barrier (${traffic?.inside} vehicle-frames inside)`);
    expect(!!traffic && traffic.vanished === 0, `${track}: no vehicle near the zone just disappears (${traffic?.vanished})`);
    expect(!!traffic && traffic.through >= 1, `${track}: traffic merges into the open lane and drives through the zone (${traffic?.through} vehicles through)`);
    await noErrors(h, `${track} roadworks`);
    void hold;
  }, { size: '960x540' });
}

finish('r6-roadworks');
