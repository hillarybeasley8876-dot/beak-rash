// Per-instance animation: wheels roll with speed, cranks follow the bike's gearing (freewheel stops them
// under hard braking, the fixie never stops), pedals stay level, the bars pivot about the head tube,
// balance-bike feet paddle / glide on the pegs / stand, plus the tandem fish and kid-bike streamers.
// Anti-strobe: once the per-frame wheel turn nears the spoke spacing, the spokes dissolve (bone X-scale read by
// the materials as a dither fade) into a slowly turning speed-blur disc, and tread blocks turn at a capped rate.
import { Euler, Quaternion, Vector3, type Object3D } from 'three';
import type { BikeTemplate } from './cache';
import { swayChains } from './defs/llm-chain';
import { SPOKE_PERIOD } from './parts/wheel';
import type { GroupName, MarkerName } from './template';

export interface Animator {
  readonly crankAngle: number;
  update(dt: number, speed: number, steerAngle: number): void;
}

const TAU = Math.PI * 2;
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const tmpQ = new Quaternion(), tmpE = new Euler();
const follow = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (k: number): number => k * k * (3 - 2 * k);
/** Streamer droop at rest per chain link (root → tip), radians: together they hang the ribbons down. */
const DROOP = [0.75, 0.3, 0.15];

interface Spinner { node: Object3D; rest: Quaternion }
interface WheelFx { spokes: Spinner | null; blur: Spinner | null; tread: Spinner | null; period: number; treadPeriod: number; tread0: number }

export function createAnimator(tpl: BikeTemplate, nodes: Map<GroupName, Object3D>, marks: Map<MarkerName, Object3D>): Animator {
  const { drive, wheelRadius } = tpl.def;
  // The LLM edition reuses the tandem's spare groups for its own moving parts: 'crank2' is the third wheel
  // on the top tube and 'pedal2L/R' are the two pedals that got loose, so they are animated apart.
  const llm = tpl.def.id === 'llm';
  const grab = (n: GroupName): Spinner | null => {
    const node = nodes.get(n);
    return node ? { node, rest: node.quaternion.clone() } : null;
  };
  const wheels = [grab('wheelR'), grab('wheelF')].filter((s): s is Spinner => s !== null);
  const crankNames: GroupName[] = llm ? ['crank'] : ['crank', 'crank2'];
  const pedalNames: GroupName[] = llm ? ['pedalL', 'pedalR'] : ['pedalL', 'pedalR', 'pedal2L', 'pedal2R'];
  const cranks = crankNames.map(grab).filter((s): s is Spinner => s !== null);
  const pedals = pedalNames.map(grab).filter((s): s is Spinner => s !== null);
  const third = llm ? grab('crank2') : null;
  const orbitL = llm ? grab('pedal2L') : null;
  const orbitR = llm ? grab('pedal2R') : null;
  const periodOf = (n: GroupName, fallback: number): number => tpl.groups.find((g) => g.name === n)?.period ?? fallback;
  const wheelFx: WheelFx[] = (['R', 'F'] as const).map((s) => ({
    spokes: grab(`spokes${s}`), blur: grab(`blur${s}`), tread: grab(`tread${s}`),
    period: periodOf(`spokes${s}`, SPOKE_PERIOD), treadPeriod: periodOf(`tread${s}`, 1), tread0: 0,
  }));
  const steer = grab('steer');
  const fish = grab('fish');
  const streamers = ([['streamerL', 'streamerL2', 'streamerL3'], ['streamerR', 'streamerR2', 'streamerR3']] as const)
    .map((chain) => chain.map(grab).filter((s): s is Spinner => s !== null));
  const footL = drive.kind === 'balance' ? marks.get('pedalL') ?? null : null;
  const footR = drive.kind === 'balance' ? marks.get('pedalR') ?? null : null;
  const saddle = marks.get('saddle')?.position.clone() ?? new Vector3();

  let wheelAngle = 0, crank = 0, lastSpeed = 0, accel = 0, pedalling = 1, paddle = 0, stand = 1, t = 0;
  let turn = 0, blurAngle = 0; // smoothed |wheel turn| per frame (rad), blur-disc angle
  const set = (s: Spinner, axis: Vector3, angle: number): void => {
    s.node.quaternion.copy(s.rest).multiply(tmpQ.setFromAxisAngle(axis, angle));
  };
  const spin = (roll: number): void => {
    turn += (Math.abs(roll) - turn) * 0.2;
    blurAngle = (blurAngle + Math.sign(roll) * Math.min(Math.abs(roll), 0.07)) % TAU;
    for (const f of wheelFx) {
      const k = smooth(Math.max(0, Math.min(1, (turn - 0.15 * f.period) / (0.2 * f.period))));
      if (f.spokes) f.spokes.node.scale.x = Math.max(0.002, 1 - k);
      if (f.blur) { f.blur.node.scale.x = Math.max(0.002, k); set(f.blur, X, -blurAngle); }
      if (f.tread) {
        f.tread0 = (f.tread0 + Math.sign(roll) * Math.min(Math.abs(roll), 0.3 * f.treadPeriod)) % TAU;
        set(f.tread, X, -f.tread0);
      }
    }
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
      spin(roll);
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
        // Pivot = the strap: the wind leans it back, bumps bob the head, corners swing it outward.
        tmpE.set(0.12 * sf + 0.035 * Math.sin(t * 7.3) * (0.3 + sf), 0.05 * Math.sin(t * 5.3) * sf, 0.06 * Math.sin(t * 4.1) + 0.22 * steerAngle);
        fish.node.quaternion.copy(fish.rest).multiply(tmpQ.setFromEuler(tmpE));
      }
      const lift = Math.min(1, Math.abs(speed) / 7);
      const flap = Math.min(1, Math.abs(speed) / 4);
      if (llm) {
        // The LLM edition: the third wheel on the top tube spins about its axle, the two loose pedals
        // drift around their own little orbits, and the chain to the rider's neck sways.
        if (third) set(third, Z, -t * 2.6);
        if (orbitL) set(orbitL, Y, t * 0.85);
        if (orbitR) set(orbitR, Y, -t * 0.7);
        swayChains(t, speed);
      }
      streamers.forEach((chain, i) => chain.forEach((s, j) => {
        const ph = t * (13 + speed) + i * 1.7 - j * 1.1;
        tmpE.set(DROOP[j] as number * (1 - lift) + (0.14 + 0.08 * j) * Math.sin(ph) * flap, 0.2 * (1 + j) * Math.sin(ph * 0.8 + 0.6) * flap, 0);
        s.node.quaternion.copy(s.rest).multiply(tmpQ.setFromEuler(tmpE));
      }));
    },
  };
}
