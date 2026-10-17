// STUB kept by core for isolation tests (?stub=...) and as load fallback. The sim unit owns index.ts: bare-bones kinematics so the game runs end to end.
// Contract: createPhysics(session) → PhysicsSystem (core/contracts.ts).
import { Matrix4, Quaternion, Vector3 } from 'three';
import { BIKES } from '../data/bikes';
import { clamp } from '../core/math';
import type { PhysicsSystem, Session } from '../core/contracts';
import type { CrashCause, RiderId, RiderState } from '../core/types';

export function createPhysics(session: Session): PhysicsSystem {
  const { track, bus } = { track: session.track, bus: session.app.bus };
  const m = new Matrix4(), t = new Vector3(), u = new Vector3(), r = new Vector3(), q = new Quaternion();

  const crash = (rd: RiderState, cause: CrashCause, attacker: RiderId | null): void => {
    if (rd.mode === 'crashed') return;
    const p = track.toWorld(rd.s, rd.x, rd.y, new Vector3());
    rd.mode = 'crashed';
    rd.modeTime = 0;
    rd.crash = { cause, vel: { x: 0, y: 6, z: 0 }, spin: { x: 6, y: 2, z: 0 }, origin: { x: p.x, y: p.y, z: p.z }, attacker };
    bus.emit('rider:crash', { riderId: rd.id, cause, speed: rd.speed, pos: p, attacker });
  };

  const respawn = (rd: RiderState): void => {
    rd.mode = 'racing';
    rd.modeTime = 0;
    rd.crash = null;
    rd.x = clamp(rd.x, -5, 5);
    rd.y = 0;
    rd.hp = rd.maxHp;
    rd.invuln = 2;
    bus.emit('rider:respawn', { riderId: rd.id });
  };

  return {
    step(dt) {
      for (const rd of session.riders) {
        rd.modeTime += dt;
        rd.invuln = Math.max(0, rd.invuln - dt);
        if (rd.mode === 'crashed') {
          rd.speed = Math.max(0, rd.speed - 20 * dt);
          rd.s += rd.speed * dt;
          if (rd.modeTime > 2.5) respawn(rd);
          continue;
        }
        if (rd.mode !== 'racing' && rd.mode !== 'finished') continue;
        const c = session.controls.get(rd.id);
        const bike = BIKES[rd.bike];
        const top = bike.topSpeed * rd.mods.speedMul * (rd.mode === 'finished' ? 0.4 : 1);
        const want = (c?.throttle ?? 0) * top;
        rd.speed += clamp(want - rd.speed, -bike.brake * dt, bike.accel * dt) - (c?.brake ?? 0) * bike.brake * dt;
        rd.speed = Math.max(0, rd.speed);
        rd.vx = (c?.steer ?? 0) * 6 * rd.mods.steerMul;
        rd.x = clamp(rd.x + rd.vx * dt, -track.bounds(rd.s).halfWidth - 3, track.bounds(rd.s).halfWidth + 3);
        rd.s += rd.speed * dt;
        rd.lean = (c?.steer ?? 0) * 0.4;
        rd.yaw = (c?.steer ?? 0) * 0.15;
      }
    },
    applyImpulse(rd, imp) {
      rd.speed = Math.max(0, rd.speed + (imp.forward ?? 0));
      rd.x += (imp.lateral ?? 0) * 0.1;
    },
    crash,
    respawn,
    pose(rd, outPos, outQuat) {
      const fr = track.frameAt(rd.s);
      track.toWorld(rd.s, rd.x, rd.y, outPos);
      t.set(fr.tangent.x, fr.tangent.y, fr.tangent.z);
      u.set(fr.up.x, fr.up.y, fr.up.z);
      r.set(fr.right.x, fr.right.y, fr.right.z);
      // Basis: +X right, +Y up, -Z forward (three.js convention).
      m.makeBasis(r, u, t.clone().negate());
      outQuat.setFromRotationMatrix(m);
      q.setFromAxisAngle(new Vector3(0, 1, 0), -rd.yaw);
      outQuat.multiply(q);
      q.setFromAxisAngle(new Vector3(0, 0, 1), -rd.lean);
      outQuat.multiply(q);
    },
    dispose() {},
  };
}
