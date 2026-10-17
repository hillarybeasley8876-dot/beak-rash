// Per-instance animation: wheels roll with speed, cranks follow the bike's gearing (freewheel stops them
// under hard braking, the fixie never stops), pedals stay level, the bars pivot about the head tube,
// balance-bike feet paddle / glide on the pegs / stand, plus the tandem fish and kid-bike streamers.
import { Euler, Quaternion, Vector3, type Object3D } from 'three';
import type { BikeTemplate } from './cache';
import type { GroupName, MarkerName } from './template';

export interface Animator {
  readonly crankAngle: number;
  update(dt: number, speed: number, steerAngle: number): void;
}

const TAU = Math.PI * 2;
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0);
const tmpQ = new Quaternion(), tmpE = new Euler();
const follow = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (k: number): number => k * k * (3 - 2 * k);

interface Spinner { node: Object3D; rest: Quaternion }

export function createAnimator(tpl: BikeTemplate, nodes: Map<GroupName, Object3D>, marks: Map<MarkerName, Object3D>): Animator {
  const { drive, wheelRadius } = tpl.def;
  const grab = (n: GroupName): Spinner | null => {
    const node = nodes.get(n);
    return node ? { node, rest: node.quaternion.clone() } : null;
  };
  const wheels = [grab('wheelR'), grab('wheelF')].filter((s): s is Spinner => s !== null);
  const cranks = [grab('crank'), grab('crank2')].filter((s): s is Spinner => s !== null);
  const pedals = (['pedalL', 'pedalR', 'pedal2L', 'pedal2R'] as const).map(grab).filter((s): s is Spinner => s !== null);
  const steer = grab('steer');
  const fish = grab('fish');
  const streamers = [grab('streamerL'), grab('streamerR')].filter((s): s is Spinner => s !== null);
  const footL = drive.kind === 'balance' ? marks.get('pedalL') ?? null : null;
  const footR = drive.kind === 'balance' ? marks.get('pedalR') ?? null : null;
  const saddle = marks.get('saddle')?.position.clone() ?? new Vector3();

  let wheelAngle = 0, crank = 0, lastSpeed = 0, accel = 0, pedalling = 1, paddle = 0, stand = 1, t = 0;
  const set = (s: Spinner, axis: Vector3, angle: number): void => {
    s.node.quaternion.copy(s.rest).multiply(tmpQ.setFromAxisAngle(axis, angle));
  };
  const foot = (out: Vector3, side: 1 | -1, phase: number): Vector3 => {
    const st = drive.stride as NonNullable<typeof drive.stride>;
    const za = saddle.z - st.ahead, zb = saddle.z + st.behind, ground = 0.035;
    const u = (((phase / TAU) % 1) + 1) % 1;
    if (u < 0.5) out.set(side * st.x, ground, za + (zb - za) * (u / 0.5));
    else {
      const k = (u - 0.5) / 0.5;
      out.set(side * st.x, ground + st.lift * Math.sin(Math.PI * k), zb + (za - zb) * smooth(k));
    }
    return out;
  };
  const tmpA = new Vector3(), tmpB = new Vector3();
  const placeFoot = (m: Object3D, side: 1 | -1, phase: number): void => {
    const peg = (drive.pegs as NonNullable<typeof drive.pegs>)[side > 0 ? 'R' : 'L'];
    foot(tmpA, side, phase);
    tmpB.set(side * 0.2, 0.035, saddle.z - 0.06);
    m.position.copy(peg).lerp(tmpA, paddle).lerp(tmpB, stand);
  };

  return {
    get crankAngle() { return crank; },
    update(dt, speed, steerAngle) {
      if (dt <= 0) return;
      t += dt;
      accel = follow(accel, (speed - lastSpeed) / dt, 6, dt);
      lastSpeed = speed;
      const roll = (speed * dt) / wheelRadius;
      wheelAngle = (wheelAngle + roll) % TAU;
      for (const w of wheels) set(w, X, -wheelAngle);
      if (drive.kind === 'balance') {
        paddle = follow(paddle, accel > 0.6 && speed > 0.25 ? 1 : 0, 5, dt);
        stand = follow(stand, speed < 0.35 && accel < 0.3 ? 1 : 0, 4, dt);
        crank = (crank + TAU * Math.min(Math.abs(speed) / drive.gear, 3.2) * dt) % TAU;
        if (footL) placeFoot(footL, -1, crank + Math.PI);
        if (footR) placeFoot(footR, 1, crank);
      } else {
        pedalling = follow(pedalling, drive.kind === 'fixed' || accel > -1.2 ? 1 : 0, 10, dt);
        const step = (roll / drive.gear) * pedalling;
        crank = (crank + (drive.kind === 'fixed' ? step : Math.max(0, step)) + TAU) % TAU;
        for (const c of cranks) set(c, X, -crank);
        for (const p of pedals) set(p, X, crank);
      }
      if (steer) set(steer, Y, -Math.max(-0.8, Math.min(0.8, steerAngle)));
      const sf = Math.min(1, Math.abs(speed) / 18);
      if (fish) {
        tmpE.set(-0.14 * sf + 0.035 * Math.sin(t * 7.3) * (0.3 + sf), 0, 0.05 * Math.sin(t * 4.1) + 0.25 * steerAngle);
        fish.node.quaternion.copy(fish.rest).multiply(tmpQ.setFromEuler(tmpE));
      }
      const lift = Math.min(1, Math.abs(speed) / 7);
      streamers.forEach((s, i) => set(s, X, 1.15 * (1 - lift) + 0.24 * Math.sin(t * (13 + speed) + i * 1.7) * Math.min(1, Math.abs(speed) / 4)));
    },
  };
}
