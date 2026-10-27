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
  // ---- lead review (round 1 → 3): the defects the lead saw on the sheet, as numbers (briefs/r6/species.md)
  const review = await page.evaluate(async (ids) => {
    const m = await import('/src/actors/species/index.ts');
    const { B } = await import('/src/actors/rig/skeleton.ts');
    const lin2s = (v) => 255 * Math.pow(Math.max(0, v), 1 / 2.2);
    const out = {};
    for (const id of ids) {
      const def = m.speciesDef(id);
      const g = m.speciesAsset(id, 'high').geometry;
      const pos = g.getAttribute('position'), col = g.getAttribute('color'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
      const P = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const rgb = (i) => [col.getX(i), col.getY(i), col.getZ(i)];
      const by = (bone) => { const o = []; for (let i = 0; i < pos.count; i++) if (si.getX(i) === bone && sw.getX(i) >= 0.6) o.push(i); return o; };
      const ear = def.joints.ear;
      const ears = ear ? [ear, [-ear[0], ear[1], ear[2]]] : [];
      const head = by(B.head).filter((i) => { const p = P(i); return !ears.some((e) => Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]) < 0.1); });
      const r = { sleepy: def.meta.sleepy, hat: def.meta.hat };
      // the helmet sits on the skull: per 45° sector of its rim (lowest 20 % of the hat's vertices), the median
      // distance to the nearest head vertex (ears left out); the worst sector is the gap you see from that side
      const hat = by(B.hat);
      if (hat.length && def.meta.hat === 'helmet') {
        const ys = hat.map((i) => pos.getY(i)).sort((a, b) => a - b);
        const lo = ys[0], hi = ys[ys.length - 1];
        const rim = hat.filter((i) => pos.getY(i) < lo + (hi - lo) * 0.2);
        const cx = rim.reduce((a, i) => a + pos.getX(i), 0) / rim.length, cz = rim.reduce((a, i) => a + pos.getZ(i), 0) / rim.length;
        const sectors = Array.from({ length: 8 }, () => []);
        for (const i of rim) {
          const p = P(i);
          let best = 9;
          for (const j of head) { const q = P(j); best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
          sectors[Math.min(7, Math.floor(((Math.atan2(p[0] - cx, p[2] - cz) + Math.PI) / (2 * Math.PI)) * 8))].push(best);
        }
        const med = sectors.filter((s) => s.length).map((s) => { s.sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; });
        r.helmetGap = +(Math.max(...med) * 100).toFixed(1);
        let c = [0, 0, 0];
        for (const i of hat) { const v = rgb(i); c = c.map((x, k) => x + v[k]); }
        const hs = c.map((x) => lin2s(x / hat.length));
        const skin = def.meta.skin, sk = [(skin >> 16) & 255, (skin >> 8) & 255, skin & 255];
        r.helmetVsSkin = Math.round(Math.hypot(hs[0] - sk[0], hs[1] - sk[1], hs[2] - sk[2]));
      }
      // muzzle width: the front 30 % of the head (ears left out) against the whole head's width
      if (head.length) {
        const zs = head.map((i) => pos.getZ(i)), zmin = Math.min(...zs), zmax = Math.max(...zs);
        const xw = (list) => { const xs = list.map((i) => pos.getX(i)); return Math.max(...xs) - Math.min(...xs); };
        r.muzzleRatio = +(xw(head.filter((i) => pos.getZ(i) < zmin + (zmax - zmin) * 0.3)) / xw(head)).toFixed(2);
      }
      // the body's roundness: width / height of the pelvis + spine + chest vertices
      const torso = [...by(B.pelvis), ...by(B.spine), ...by(B.chest)];
      if (torso.length) {
        const xs = torso.map((i) => pos.getX(i)), ys = torso.map((i) => pos.getY(i));
        r.torsoWH = +((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys))).toFixed(2);
      }
      // the face between the eyes and the chin (|x| < 5 cm, from 4 cm under the mouth up to the eyes, in front
      // of the eyes): how many of its vertices are banana yellow
      const eye = def.joints.eye, mouth = def.meta.beak;
      if (eye && mouth) {
        const want = [[0xff, 0xd8, 0x4a], [0xe6, 0xb9, 0x2f]];
        let n = 0;
        for (let i = 0; i < pos.count; i++) {
          const [x, y, z] = P(i);
          if (Math.abs(x) > 0.05 || y < mouth[1] - 0.04 || y > eye[1] || z > eye[2] + 0.01) continue;
          const v = rgb(i), a = v.map(lin2s), b = v.map((x) => x * 255);
          if (want.some((w) => Math.hypot(a[0] - w[0], a[1] - w[1], a[2] - w[2]) < 40 || Math.hypot(b[0] - w[0], b[1] - w[1], b[2] - w[2]) < 40)) n++;
        }
        r.faceYellow = n;
      }
      out[id] = r;
    }
    return out;
  }, IDS);
  const rv = (id) => review[id] ?? {};
  if (IDS.includes('bananacat')) {
    expect(rv('bananacat').faceYellow <= 3, `bananacat: the face is clear of the peel between the eyes and the chin (${rv('bananacat').faceYellow} banana-yellow vertices there; ≤ 3 — move the flap that hangs over the nose and mouth)`);
  }
  for (const id of IDS.filter((i) => rv(i).helmetGap !== undefined)) {
    expect(rv(id).helmetGap <= 4.5, `${id}: the helmet sits on the skull (widest rim gap ${rv(id).helmetGap} cm; ≤ 4.5 like the cat and the shiba)`);
  }
  if (IDS.includes('moodeng')) {
    expect(rv('moodeng').helmetVsSkin >= 100, `moodeng: the helmet colour stands out from the grey skin (ΔRGB ${rv('moodeng').helmetVsSkin}; ≥ 100)`);
    expect(rv('moodeng').muzzleRatio >= 0.95, `moodeng: the hippo muzzle is as wide as the skull (front-30 % width / head width ${rv('moodeng').muzzleRatio}; ≥ 0.95)`);
  }
  if (IDS.includes('hamster')) {
    expect(rv('hamster').sleepy <= 0.12, `hamster: the enormous eyes are open (meta.sleepy ${rv('hamster').sleepy}; ≤ 0.12, keep the sad look with lidTilt / brows / the tear)`);
    expect(rv('hamster').torsoWH >= 1.2, `hamster: a round ball of a body (torso width / height ${rv('hamster').torsoWH}; ≥ 1.2)`);
  }
  // ---- lead review (round 3 → 4): orthographic bone maps of the finished mesh (what the camera sees)
  const review4 = await page.evaluate(async (ids) => {
    const m = await import('/src/actors/species/index.ts');
    const { B } = await import('/src/actors/rig/skeleton.ts');
    const lin2s = (v) => 255 * Math.pow(Math.max(0, v), 1 / 2.2);
    const out = {};
    for (const id of ids) {
      const def = m.speciesDef(id);
      const g = m.speciesAsset(id, 'high').geometry;
      const pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), col = g.getAttribute('color');
      const idx = g.index;
      const nTri = idx ? idx.count / 3 : pos.count / 3;
      const T = new Float64Array(nTri * 9), BN = new Int32Array(nTri);
      for (let k = 0; k < nTri; k++) {
        const v = [0, 1, 2].map((j) => (idx ? idx.getX(k * 3 + j) : k * 3 + j));
        v.forEach((ix, j) => T.set([pos.getX(ix), pos.getY(ix), pos.getZ(ix)], k * 9 + j * 3));
        const bs = v.map((ix) => (sw.getX(ix) >= 0.5 ? si.getX(ix) : -1));
        BN[k] = bs[0] === bs[1] || bs[0] === bs[2] ? bs[0] : bs[1] === bs[2] ? bs[1] : bs[0];
      }
      // the bone of the first triangle a ray meets (skip = bones the ray passes through, e.g. the eyelids)
      const first = (o, d, skip = []) => {
        let best = Infinity, bn = -1;
        for (let k = 0; k < nTri; k++) {
          const b = k * 9;
          const e1x = T[b + 3] - T[b], e1y = T[b + 4] - T[b + 1], e1z = T[b + 5] - T[b + 2];
          const e2x = T[b + 6] - T[b], e2y = T[b + 7] - T[b + 1], e2z = T[b + 8] - T[b + 2];
          const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-12) continue;
          const tx = o[0] - T[b], ty = o[1] - T[b + 1], tz = o[2] - T[b + 2];
          const u = (tx * px + ty * py + tz * pz) / det;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
          const v = (d[0] * qx + d[1] * qy + d[2] * qz) / det;
          if (v < 0 || u + v > 1) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) / det;
          if (t > 1e-4 && t < best && !skip.includes(BN[k])) { best = t; bn = BN[k]; }
        }
        return bn;
      };
      const view = (az) => { const a = (az * Math.PI) / 180; return { d: [-Math.sin(a), 0, -Math.cos(a)], right: [Math.cos(a), 0, -Math.sin(a)] }; };
      const r = {};
      // skull through the helmet: in a 1 cm bone map of the head (front, 3/4, side), head cells that sit between
      // helmet cells in the same column = grey skull showing through the shell
      if (def.meta.hat === 'helmet') {
        const hat = []; for (let i = 0; i < pos.count; i++) if (si.getX(i) === B.hat && sw.getX(i) >= 0.6) hat.push(i);
        const ys = hat.map((i) => pos.getY(i));
        const lo = Math.min(...ys) - 0.04, hi = Math.max(...ys) + 0.02;
        const cx = hat.reduce((a, i) => a + pos.getX(i), 0) / hat.length, cz = hat.reduce((a, i) => a + pos.getZ(i), 0) / hat.length;
        r.through = {};
        for (const [name, az] of [['front', 180], ['3/4', 225], ['side', 270]]) {
          const { d, right } = view(az);
          let n = 0;
          for (let u = -0.3; u <= 0.3 + 1e-9; u += 0.01) {
            const colm = [];
            for (let y = hi; y >= lo; y -= 0.01) colm.push(first([cx + right[0] * u - d[0] * 2, y, cz + right[2] * u - d[2] * 2], d));
            const top = colm.indexOf(B.hat), last = colm.lastIndexOf(B.hat);
            for (let k = top + 1; top >= 0 && k < last; k++) if (colm[k] === B.head) n++;
          }
          r.through[name] = n;
        }
      }
      // the eyes from the front: visible eyeball area in cm² (5 mm cells, the lids left out: the eye must not be
      // buried in the cheeks, the muzzle or under the helmet)
      const eye = def.joints.eye;
      if (eye) {
        const { d, right } = view(180);
        let n = 0;
        for (let u = -0.25; u <= 0.25; u += 0.005) for (let y = eye[1] - 0.1; y <= eye[1] + 0.1; y += 0.005) {
          const bn = first([right[0] * u - d[0] * 2, y, eye[2] + right[2] * u - d[2] * 2], d, [B.lidL, B.lidR]);
          if (bn === B.eyeL || bn === B.eyeR) n++;
        }
        r.eyeArea = +(n * 0.25).toFixed(1);
      }
      // the mouth line's curve: centre height minus corner height in cm (+ = turned down, − = a smile)
      const mouth = def.meta.beak;
      if (mouth) {
        const pts = [];
        for (let i = 0; i < pos.count; i++) {
          if (si.getX(i) !== B.head) continue;
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          if (Math.abs(x) > 0.07 || Math.abs(y - mouth[1]) > 0.06 || z > mouth[2] + 0.06) continue;
          const v = [col.getX(i), col.getY(i), col.getZ(i)], a = v.map(lin2s), b = v.map((x) => x * 255);
          const w = [0x2a, 0x14, 0x16];
          if (Math.hypot(a[0] - w[0], a[1] - w[1], a[2] - w[2]) < 30 || Math.hypot(b[0] - w[0], b[1] - w[1], b[2] - w[2]) < 30) pts.push([x, y]);
        }
        if (pts.length) {
          const halfW = Math.max(...pts.map((p) => Math.abs(p[0])));
          const mean = (l) => l.reduce((s, p) => s + p[1], 0) / Math.max(1, l.length);
          r.mouthCurve = +((mean(pts.filter((p) => Math.abs(p[0]) < halfW * 0.25)) - mean(pts.filter((p) => Math.abs(p[0]) > halfW * 0.7))) * 100).toFixed(2);
        }
      }
      // the neck: the narrowest horizontal slice of the body bones between the chest and the lower head, against
      // the head's width (the pelican's thick neck 0.9, the cat 0.53)
      const ofBones = (bones) => { const o = []; for (let i = 0; i < pos.count; i++) if (bones.includes(si.getX(i)) && sw.getX(i) >= 0.6) o.push(i); return o; };
      const ear = def.joints.ear, ears = ear ? [ear, [-ear[0], ear[1], ear[2]]] : [];
      const head = ofBones([B.head]).filter((i) => !ears.some((e) => Math.hypot(pos.getX(i) - e[0], pos.getY(i) - e[1], pos.getZ(i) - e[2]) < 0.1));
      const torso = ofBones([B.pelvis, B.spine, B.chest]);
      const body = ofBones([B.pelvis, B.spine, B.chest, B.neck1, B.neck2, B.neck3, B.head]);
      const wid = (l) => { const xs = l.map((i) => pos.getX(i)); return Math.max(...xs) - Math.min(...xs); };
      if (head.length && torso.length) {
        const hy = head.map((i) => pos.getY(i)), hy0 = Math.min(...hy), hy1 = Math.max(...hy);
        const cy1 = Math.max(...torso.map((i) => pos.getY(i)));
        let waist = 9;
        for (let y = Math.min(cy1, hy0) - 0.05; y <= hy0 + (hy1 - hy0) * 0.3; y += 0.01) {
          const sl = body.filter((i) => Math.abs(pos.getY(i) - y) < 0.006);
          if (sl.length >= 6) waist = Math.min(waist, wid(sl));
        }
        r.neck = +(waist / wid(head)).toFixed(2);
      }
      out[id] = r;
    }
    return out;
  }, IDS);
  for (const id of IDS.filter((i) => review4[i]?.through)) {
    const t = review4[id].through;
    expect(Object.values(t).every((n) => n <= 4), `${id}: no skull showing through the helmet shell (head cells between helmet cells: front ${t.front}, 3/4 ${t['3/4']}, side ${t.side}; ≤ 4 each like the cat, the shiba and the capybara)`);
  }
  if (IDS.includes('moodeng')) {
    expect(review4.moodeng.eyeArea >= 15, `moodeng: the tiny eyes read from the front (visible eyeball ${review4.moodeng.eyeArea} cm², lids left out; ≥ 15 — the sloth shows 18, the goose 23, pedro 32)`);
  }
  if (IDS.includes('hamster')) {
    expect(review4.hamster.mouthCurve >= 0.3, `hamster: the sad mouth turns down (centre ${review4.hamster.mouthCurve} cm above the corners; ≥ 0.3 — a negative value is a smile)`);
    expect(review4.hamster.neck >= 0.8, `hamster: no neck — the head flows straight into the ball body (narrowest slice between chest and head / head width ${review4.hamster.neck}; ≥ 0.8, the pelican 0.9)`);
  }
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
