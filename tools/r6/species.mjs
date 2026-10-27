#!/usr/bin/env node
// r6 acceptance: species (SPEC §23 — the meme roster gets real procedural models). Lead-owned, read-only for workers.
// For each new racer: its own SpeciesDef (not a stand-in), a triangle budget like the old cast (5 500 – 9 500 at high),
// hands on the grips and feet on the pedals on every bike (actors-check rules), signature colours on the model, a
// silhouette that differs from the species it used to borrow, and a turntable sheet for the lead's eyes.
//   node tools/r6/species.mjs [--ids bananacat,cryingcat,xinxian,moodeng,pedro,hamster] [--sheet]
import fs from 'node:fs';
import { parseArgs } from '../lib.mjs';
import { expect, finish, noErrors, withPage } from '../r4/accept-lib.mjs';

const a = parseArgs(process.argv.slice(2));
const IDS = String(a.ids ?? 'bananacat,cryingcat,xinxian,moodeng,pedro,hamster').split(',');
const BIKES = ['roadbike', 'erba', 'shared', 'fixie', 'mtb', 'tandem', 'kidbike'];
const BORROWED = { bananacat: 'cat', cryingcat: 'cat', xinxian: 'cat', moodeng: 'capybara', pedro: 'shiba', hamster: 'capybara' };
/** Colours the model must show (hex, any vertex within ΔE ~ 40 of it counts). */
const SIGNATURE = {
  bananacat: ['#ffd84a'],                 // the banana costume
  cryingcat: ['#8fd3ff'],                 // the tears
  xinxian: ['#f08a24'],                   // the orange coat
  moodeng: ['#6f7a8c', '#f2a7b5'],        // glossy grey + pink cheeks / mouth
  pedro: ['#2b2d33', '#8a8f99'],          // the black mask on grey fur
  hamster: ['#e8c49a'],                   // golden-tan fur
};

await withPage(async (page, h) => {
  await h.goto('/sandbox/actors.html?panel=0&speed=9&manual=1');
  const defs = await page.evaluate(async (ids) => {
    const m = await import('/src/actors/species/index.ts');
    return ids.map((id) => ({ id, def: m.speciesDef(id).id }));
  }, IDS);
  for (const { id, def } of defs) expect(def === id, `${id}: has its own species model (speciesDef → '${def}', was '${BORROWED[id]}')`);

  const stats = await page.evaluate(async ({ ids, sig, borrowed }) => {
    const m = await import('/src/actors/species/index.ts');
    const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    const parse = (s) => hex(parseInt(s.slice(1), 16));
    const out = {};
    for (const id of ids) {
      const asset = m.speciesAsset(id, 'high');
      const g = asset.geometry;
      const col = g.getAttribute('color');
      const pos = g.getAttribute('position');
      // the colours the model shows (vertex colours, 0..1 → 0..255)
      const want = sig[id].map(parse);
      const found = want.map((w) => {
        let best = Infinity;
        for (let i = 0; i < col.count; i += 3) {
          const c = [col.getX(i) * 255, col.getY(i) * 255, col.getZ(i) * 255];
          // vertex colours may be linear: compare against both encodings
          const lin = c.map((v) => 255 * Math.pow(v / 255, 1 / 2.2));
          best = Math.min(best, Math.hypot(c[0] - w[0], c[1] - w[1], c[2] - w[2]), Math.hypot(lin[0] - w[0], lin[1] - w[1], lin[2] - w[2]));
        }
        return Math.round(best);
      });
      // silhouette difference vs the borrowed model: compare the bounding boxes and the volume samples
      const bb = (geo) => { geo.computeBoundingBox(); const b = geo.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; };
      const other = m.speciesAsset(borrowed[id], 'high');
      const mine = bb(g), theirs = bb(other.geometry);
      const diff = Math.max(...mine.map((v, i) => Math.abs(v - theirs[i]) / Math.max(0.01, theirs[i])));
      out[id] = { tris: asset.tris, verts: pos.count, colour: found, size: mine.map((v) => +v.toFixed(2)), diff: +diff.toFixed(2), borrowedTris: other.tris };
    }
    return out;
  }, { ids: IDS, sig: SIGNATURE, borrowed: BORROWED });
  for (const id of IDS) {
    const s = stats[id];
    expect(s.tris >= 5500 && s.tris <= 9500, `${id}: ${s.tris} triangles at high quality (5 500 – 9 500 like the old cast)`);
    expect(s.colour.every((d) => d <= 40), `${id}: shows its signature colours ${SIGNATURE[id].join(' ')} (closest vertex ΔRGB ${s.colour.join(', ')}; ≤ 40)`);
  }
  const sameAsBorrowed = IDS.filter((id) => stats[id].diff < 0.06 && Math.abs(stats[id].tris - stats[id].borrowedTris) < 150);
  expect(sameAsBorrowed.length === 0, `no new model is just its stand-in reshuffled (${sameAsBorrowed.join(', ') || 'none'})`);

  // feet on the pedals, hands on the grips (the actors-check rules), on every bike
  let bad = 0;
  const rows = [];
  for (const c of IDS) {
    const row = [];
    for (const bike of BIKES) {
      const r = await page.evaluate(([c, bike]) => {
        window.__actors.set({ character: c, bike, mode: 'ride' });
        return { ...window.__actors.check(320, true), short: !!window.__actors.riders[0].view.inst.def.meta.shortLegs };
      }, [c, bike]);
      const fail = r.grip > 0.01 || (!r.short && r.foot > 0.01);
      if (fail) bad++;
      row.push(`${bike}:${(r.foot * 100).toFixed(1)}/${(r.grip * 100).toFixed(1)}${fail ? '!' : ''}`);
    }
    rows.push(`${c} ${row.join(' ')}`);
  }
  expect(bad === 0, `feet on the pedals and hands on the grips on all 7 bikes (foot/grip cm, max 1.0):\n      ${rows.join('\n      ')}`);
  // the signature skill pose plays (a cue that reads for ≥ 0.3 s)
  const poses = await page.evaluate((ids) => ids.map((c) => {
    window.__actors.set({ character: c, bike: 'roadbike', mode: 'ride' });
    const view = window.__actors.riders[0].view;
    const skillId = { bananacat: 'bananacat.peel', cryingcat: 'cryingcat.tears', xinxian: 'xinxian.fresh', moodeng: 'moodeng.bounce', pedro: 'pedro.trash', hamster: 'hamster.violin' }[c];
    view.cue('skill', { skillId });
    view.lastSkillId = skillId;
    const st = window.__actors.riders[0].state;
    st.action = { kind: 'skill', side: 1, t: 0, dur: 0.35, weapon: st.weapon, skillId: view.lastSkillId ?? null, resolved: true };
    let shown = 0;
    for (let i = 0; i < 60; i++) {
      window.__actors.step(1);
      const o = view.cueOut;
      if (o && (o.armL.blend > 0.3 || o.armR.blend > 0.3 || Math.abs(o.spin) > 0.1 || o.lie > 0.3 || Math.abs(o.spinePitch) > 0.08 || o.neck > 0.3 || o.wings > 0.3)) shown++;
    }
    return { c, shown: +(shown / 60).toFixed(2) };
  }), IDS);
  expect(poses.every((p) => p.shown >= 0.3), `each new racer strikes a readable pose for its signature skill (${poses.map((p) => `${p.c} ${p.shown}s`).join(', ')})`);
  await noErrors(h, 'species');
}, { size: '960x540' });

// the turntable sheet for the lead (front, 3/4, side, back) — the lead looks at it
if (a.sheet) {
  fs.mkdirSync('shots/r6-species', { recursive: true });
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', ['tools/actors-sheet.mjs', 'shots/r6-species/sheet.png', IDS.join(','), 'front,34,side,back'], { encoding: 'utf8', shell: true });
  expect(r.status === 0, `turntable sheet written (shots/r6-species/sheet.png) ${r.status === 0 ? '' : r.stderr.slice(0, 200)}`);
}

finish('r6-species');
