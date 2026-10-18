// Actors sandbox entry: loop, fake physics for the bench riders, and the window.__actors script API.
import { Euler, Quaternion, Vector3 } from 'three';
import type { ViewCue } from '../src/core/contracts';
import { damp } from '../src/core/math';
import type { CharacterId, CrashCause, Side, StatusId, WeaponId } from '../src/core/types';
import { GRIP_BACK } from '../src/actors/rig/ride';
import { B } from '../src/actors/rig/skeleton';
import { speciesAsset, speciesDef } from '../src/actors/species';
import { CharacterBuilder } from '../src/actors/kit/builder';
import { buildPanel } from './actors-panel';
import { P, ROSTER_IDS, S, cam, controls, errors, placeCamera, renderer, resize, riders, scene, spawn } from './actors-scene';

const q = new Quaternion(), e = new Euler(0, 0, 0, 'YXZ'), pos = new Vector3();
let manual = P.get('manual') === '1';

function fakePhysics(dt: number): void {
  for (const r of riders) {
    const st = r.state;
    st.modeTime += dt;
    st.invuln = Math.max(0, st.invuln - dt);
    for (const s of st.statuses) s.time -= dt;
    st.statuses = st.statuses.filter((s) => s.time > 0);
    st.mods.invisible = st.statuses.some((s) => s.id === 'invisible');
    if (st.action) {
      st.action.t += dt;
      if (st.action.t >= st.action.dur) st.action = null;
    }
    if (st.mode === 'crashed') {
      st.speed = Math.max(0, st.speed - 9 * dt);
      if (st.modeTime > 2.6) { st.mode = 'respawning'; st.modeTime = 0; st.crash = null; }
    } else if (st.mode === 'respawning') {
      if (st.modeTime > 0.6) { st.mode = 'racing'; st.modeTime = 0; st.invuln = 2; }
    } else {
      st.speed = damp(st.speed, S.speed, 1.5, dt);
    }
    st.s += st.speed * dt;
    st.lean = S.weave ? Math.sin(S.t * 1.4) * 0.55 : S.lean;
    if (st.boostTime > 0) st.boostTime = Math.max(0, st.boostTime - dt);
  }
}

function tick(dtReal: number): void {
  const dt = dtReal * S.scale;
  S.t += dt;
  fakePhysics(dt);
  for (const r of riders) {
    const st = r.state;
    pos.copy(r.base);
    q.setFromEuler(e.set(0, -st.yaw + (P.get('spin') === '1' ? S.t * 0.6 : 0), -st.lean, 'YXZ'));
    r.view.update(st, pos, q, dt, dtReal);
  }
  const lead = riders[0];
  if (S.view === 'chase' && lead) {
    controls.target.set(0, 1.1, -4);
    cam.position.set(0, 2.1, 5.2);
  } else if (P.get('follow') === '1' && lead) {
    const body = lead.view.anchor('body', new Vector3());
    const d = cam.position.clone().sub(controls.target);
    controls.target.lerp(body, 1 - Math.exp(-8 * dtReal));
    cam.position.copy(controls.target).add(d);
  }
  controls.update();
  renderer.render(scene, cam);
}

const api = {
  set(o: Partial<typeof S>): void {
    const respawn = (o.character && o.character !== S.character) || (o.bike && o.bike !== S.bike) || (o.mode && o.mode !== S.mode);
    Object.assign(S, o);
    if (respawn) spawn();
    else if (o.view || o.dist) placeCamera();
  },
  cue(name: ViewCue, opts?: { side?: Side; skillId?: string; weapon?: WeaponId; intensity?: number }): void {
    for (const r of riders) r.view.cue(name, opts);
  },
  action(kind: 'attack' | 'heavy' | 'skill' | 'ult' | 'bell' | 'hit', side: Side, dur: number, skillId: string | null = null): void {
    for (const r of riders) r.state.action = { kind, side, t: 0, dur, weapon: r.state.weapon, skillId, resolved: false };
  },
  weapon(w: WeaponId): void {
    for (const r of riders) { r.state.weapon = w; r.view.setWeapon(w); }
  },
  status(id: StatusId, time: number): void {
    for (const r of riders) r.state.statuses.push({ id, time, strength: 1, source: null });
  },
  boost(time: number): void {
    for (const r of riders) { r.state.boostTime = time; r.state.boostPower = 0.3; }
  },
  crash(cause: CrashCause = 'ko'): void {
    for (const r of riders) {
      const st = r.state;
      r.view.anchor('body', pos);
      st.mode = 'crashed';
      st.modeTime = 0;
      const v = st.speed;
      st.crash = { cause, vel: { x: 1.2, y: 5.5, z: -0.7 * v }, spin: { x: -6.5, y: 1.6, z: 2.2 }, origin: { x: pos.x, y: 0, z: pos.z }, attacker: null };
      st.speed = 0.7 * v;
    }
  },
  step(n: number, dt = 1 / 60): void {
    manual = true;
    for (let i = 0; i < n; i++) tick(dt);
  },
  realtime(): void { manual = false; },
  /** Max foot/grip IK error (m) over `frames` steps of riding for the current riders. */
  check(frames = 120): { foot: number; grip: number } {
    let foot = 0, grip = 0;
    const t = new Vector3();
    for (let f = 0; f < frames; f++) {
      tick(1 / 60);
      for (const r of riders) {
        const v = r.view, m = v.inst.def.meta, ps = v.ps, inp = v.input;
        for (const [bone, pedal] of [[B.footL, inp.pedalL], [B.footR, inp.pedalR]] as const) {
          const side = bone === B.footL ? -1 : 1;
          t.set(pedal.x + side * m.ankleLift[0], pedal.y + m.ankleLift[1], pedal.z + m.ankleLift[2]);
          foot = Math.max(foot, t.distanceTo(ps.mp[bone] as Vector3));
        }
        for (const [bone, g] of [[B.handL, inp.gripL], [B.handR, inp.gripR]] as const) {
          t.set(g.x, g.y + m.gripDrop, g.z + GRIP_BACK);
          grip = Math.max(grip, t.distanceTo(ps.mp[bone] as Vector3));
        }
      }
    }
    return { foot: +foot.toFixed(4), grip: +grip.toFixed(4) };
  },
  /** Average CPU ms per view.update over `frames` frames for the current riders (timer-resolution safe). */
  perf(frames = 300): number {
    let n = 0;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      const dt = 1 / 60;
      S.t += dt;
      fakePhysics(dt);
      for (const r of riders) {
        pos.copy(r.base);
        q.setFromEuler(e.set(0, 0, -r.state.lean, 'YXZ'));
        r.view.update(r.state, pos, q, dt, dt);
        n++;
      }
    }
    return +((performance.now() - t0) / Math.max(1, n)).toFixed(4);
  },
  report(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const id of ROSTER_IDS) {
      const a = speciesAsset(id, 'high');
      out[id] = `${a.tris} tris, ${a.buildMs.toFixed(0)} ms`;
    }
    out.drawCalls = String(renderer.info.render.calls);
    out.triangles = String(renderer.info.render.triangles);
    return out;
  },
  /** Triangles per builder chunk (in build order) for one species — for trimming budgets. */
  chunks(id: CharacterId): number[] {
    const b = new CharacterBuilder(1);
    speciesDef(id).build(b, 'high');
    return b.chunkTris;
  },
  riders,
};

declare global { interface Window { __actors?: typeof api } }
window.__actors = api;
addEventListener('resize', resize);
resize();
spawn();
if (P.get('panel') !== '0') buildPanel(api);
else (document.getElementById('panel') as HTMLDivElement).style.display = 'none';
let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min((now - last) / 1000, 1 / 15);
  last = now;
  if (!manual) tick(dt);
  else renderer.render(scene, cam);
});
(window as unknown as { __br: { ready: boolean; errors: string[] } }).__br = { ready: true, errors };
