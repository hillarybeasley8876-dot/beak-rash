// createCameraRig(app) → CameraRig: chase / look-back / cinematic override (+ rider-relative blend-out) /
// menu orbit / free, with trauma shake, a continuous buzz channel and FOV kicks driven by bus events and
// by the player's boost state (any boost source widens the view, even one that never emits rider:boost).
import { Euler, Quaternion, Vector3 } from 'three';
import { clamp01 } from '../core/math';
import { ChaseCam } from './chase';
import { ShakeKick } from './shake';
import { Blend, type Anchor } from './blend';
import { MenuOrbit } from './orbit';
import { listenRig } from './listeners';
import { boostKick, RIG, type RigState } from './rig-state';
import { round, simDebug } from '../sim/debug';
import type { AppContext, CameraRig } from '../core/contracts';
import { reducedMotion } from '../core/motion';
import type { RiderState } from '../core/types';

export { RIG } from './rig-state';

export function createCameraRig(app: AppContext): CameraRig {
  const camera = app.camera;
  const st: RigState = {
    app, chase: new ChaseCam(), fx: new ShakeKick(), blend: new Blend(),
    session: null, cine: null, boostKicked: false, scrapeUntil: 0,
  };
  const { chase, fx, blend } = st;
  const orbit = new MenuOrbit();
  let blendOut = RIG.blendOut;
  const move = new Vector3();
  const rot = new Vector3();
  const euler = new Euler();
  const q = new Quaternion();
  const anchor: Anchor = { pos: new Vector3(), quat: new Quaternion() };
  const pure = { pos: new Vector3(), quat: new Quaternion(), fov: camera.fov }; // chase pose before blend / shake
  const watch = { power: 0, time: 0, mul: 1 };

  const rig: CameraRig = {
    camera,
    mode: 'orbit',
    attach(s) {
      st.session = s;
      fx.clear();
      if (!s) {
        st.cine = null;
        blend.stop();
        if (rig.mode !== 'free') rig.mode = 'orbit';
        return;
      }
      chase.reset(s);
      watchBoost(s.player, false);
      if (rig.mode !== 'free') rig.mode = st.cine ? 'cinematic' : 'chase';
    },
    update(dtReal, dtSim) {
      // Paused: shakes, kicks and buzz hold still behind the menu (hit-stop and slow-mo keep real time).
      const live = app.clock.getScale('pause') > 0;
      if (live) fx.update(dtReal);
      fx.strength = clamp01(app.save.data.settings.shake) * (reducedMotion() ? 0.35 : 1);
      if (rig.mode === 'free') return;
      const session = st.session;
      if (!session) {
        if (st.cine && runCine(dtReal)) return;
        orbit.update(camera, dtReal, app.clock.realTime);
        rig.mode = 'orbit';
        return;
      }
      const p = session.player;
      chase.lookBack = session.controls.get(p.id)?.lookBack === true;
      watchBoost(p, true);
      // Behind a cinematic the chase springs run on real time, so the hand-back (cut or blend) lands on a settled
      // pose even after a long slow-mo (SHOWTIME's 8 m leap) instead of sinking into place afterwards.
      const pose = chase.update(session, dtReal, st.cine ? dtReal : dtSim, fx.fov);
      pure.pos.copy(pose.pos);
      pure.quat.copy(pose.quat);
      pure.fov = pose.fov;
      if (st.cine && runCine(dtReal)) return;
      blend.apply(pose, chase.anchor(anchor), dtReal);
      if (live) fx.buzz = buzzOf(p);
      fx.offsets(move, rot);
      camera.position.copy(pose.pos).add(move.applyQuaternion(pose.quat));
      camera.quaternion.copy(pose.quat).multiply(q.setFromEuler(euler.set(rot.x, rot.y, rot.z)));
      setFov(pose.fov);
      rig.mode = chase.lookBack && p.mode !== 'crashed' ? 'lookBack' : 'chase';
      publish();
    },
    shake(intensity, duration) {
      fx.shake(intensity, duration);
    },
    kick(fovDelta, duration) {
      fx.kick(fovDelta, duration);
    },
    override(fn, out = RIG.blendOut) {
      if (fn) {
        st.cine = fn;
        blendOut = out;
        blend.stop();
        if (rig.mode !== 'free') rig.mode = 'cinematic';
      } else if (st.cine) {
        endCine(out);
      }
    },
    chasePose(outPos, outQuat) {
      const live = st.session !== null;
      outPos.copy(live ? pure.pos : camera.position);
      outQuat.copy(live ? pure.quat : camera.quaternion);
      return live ? pure.fov : camera.fov;
    },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
  };

  function runCine(dtReal: number): boolean {
    const fn = st.cine;
    if (!fn) return false;
    let keep = false;
    try {
      keep = fn(camera, dtReal);
    } catch (err) {
      console.error('[camera] cinematic override threw; returning to chase', err);
    }
    if (keep && st.cine === fn) {
      rig.mode = 'cinematic';
      camera.updateProjectionMatrix();
      publish();
      return true;
    }
    if (st.cine === fn) endCine(blendOut);
    return st.cine !== null && st.cine !== fn && runCine(dtReal);
  }

  function endCine(out: number): void {
    st.cine = null;
    blend.start(camera, out);
  }

  function setFov(fov: number): void {
    if (Math.abs(camera.fov - fov) < 1e-4) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  /** Kick the FOV when the player's boost rises without a rider:boost event (any boost writer counts). */
  function watchBoost(p: RiderState, kick: boolean): void {
    const power = p.boostTime > 0 ? p.boostPower : 0;
    const mul = Math.max(1, p.mods.speedMul);
    const rose = power > watch.power + 0.02 || p.boostTime > watch.time + 0.2 || mul > watch.mul + 0.08;
    if (kick && rose && !st.boostKicked && p.mode === 'racing') {
      let time = p.boostTime;
      for (const s of p.statuses) if (s.id === 'boost') time = Math.max(time, s.time);
      boostKick(st, Math.max(power, mul - 1), time);
    }
    st.boostKicked = false;
    watch.power = power;
    watch.time = p.boostTime;
    watch.mul = mul;
  }

  /** Continuous buzz: curb rumble, rough ground and wall scraping scale with speed; a faint speed hum. */
  function buzzOf(p: RiderState): number {
    if (p.mode !== 'racing' || p.airborne || p.speed < 4) return 0;
    const vn = clamp01(p.speed / 20);
    let b = RIG.buzzSpeed * vn * vn;
    if (p.surface === 'curb') b = Math.max(b, RIG.buzzCurb * vn);
    else if (p.surface === 'grass' || p.surface === 'sand' || p.surface === 'dirt') b = Math.max(b, RIG.buzzRough * vn);
    if (app.clock.realTime < st.scrapeUntil) b = Math.max(b, RIG.buzzScrape);
    return b;
  }

  function publish(): void {
    const dbg = simDebug();
    if (!dbg) return;
    const cs = chase.state;
    dbg.cam = {
      mode: rig.mode, fov: round(camera.fov, 2), trauma: round(fx.trauma), kick: round(fx.fov, 2), buzz: round(fx.buzz),
      dist: round(cs.dist ?? 0), height: round(cs.height ?? 0, 7), roll: round(cs.roll ?? 0), surge: round(cs.surge ?? 0),
      offS: round(cs.offS ?? 0, 7), offX: round(cs.offX ?? 0, 7), dip: round(cs.dip ?? 0), lift: round(cs.lift ?? 0),
      occSide: round(cs.occSide ?? 0), occLift: round(cs.occLift ?? 0),
      blending: blend.active, cuts: blend.cuts,
      gapDeg: round((blend.lastGap.angle * 180) / Math.PI, 1), gapM: round(blend.lastGap.dist, 2),
      x: round(camera.position.x), y: round(camera.position.y), z: round(camera.position.z),
    };
  }

  listenRig(st);
  camera.position.set(0, 8, 20);
  camera.lookAt(0, 0, 0);
  return rig;
}
