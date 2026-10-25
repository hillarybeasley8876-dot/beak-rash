// The gobi landscape: dune ridges, rock buttes, the salt pan, distant snow peaks and the dry scatter
// (scrub bushes, boulders) that keeps the verges from being bare gradients.
import type { GobiCtx } from './gctx';
import { boulder, butte, dune, peak, rockCluster, saltPan, scrub } from './kit';

/** Yaw of the road at s (the direction of travel). */
function roadYaw(g: GobiCtx, s: number): number {
  const fr = g.ctx.q.frameVis(s);
  return Math.atan2(fr.tangent.x, fr.tangent.z);
}

/** A line of sand dunes beside the road, their ridges lying across the highway. */
export function dunes(g: GobiCtx, s: number, side: -1 | 1, len: number): void {
  const yaw = roadYaw(g, s) + Math.PI / 2;
  for (let ss = s; ss < s + len; ss += g.rng.range(34, 52)) {
    const u = g.rng.range(22, 62);
    const sp = g.place.spot(ss, side, u);
    if (!g.place.free(sp.pos.x, sp.pos.z, 12, 6)) continue;
    const h = g.rng.range(3.5, 9);
    dune(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y - 0.4, sp.pos.z, g.rng.range(30, 62), g.rng.range(16, 30), h, yaw + g.rng.range(-0.3, 0.3));
  }
}

/** Rock buttes (mesas) on the plain. */
export function mesas(g: GobiCtx, s: number, side: -1 | 1, count: number): void {
  for (let i = 0; i < count; i++) {
    const ss = s + i * g.rng.range(50, 110);
    const u = g.rng.range(150, 330);
    const sp = g.place.spot(ss, side, u);
    if (!g.place.free(sp.pos.x, sp.pos.z, 30, 20)) continue;
    const y = g.ctx.groundWorld(sp.pos.x, sp.pos.z);
    butte(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, y - 0.5, sp.pos.z, g.rng.range(16, 30), g.rng.range(26, 52), g.rng);
  }
}

/** The salt pan: a wide white sheet on the lake bed, following the ground. */
export function saltLake(g: GobiCtx, s: number, len: number): void {
  const sp = g.place.spot(s, g.side(1), 60);
  const yaw = roadYaw(g, s);
  const dx = Math.cos(yaw), dz = Math.sin(yaw);
  const w = 320, d = len + 200;
  saltPan(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.z, w, d, yaw,
    (wx, wz) => g.ctx.groundWorld(wx, wz), (wx, wz) => g.field.sampleWorld(wx, wz).u);
  // A few salt ridges and a stranded fence post on the pan.
  for (let i = 0; i < 14; i++) {
    const t = g.rng.range(-0.45, 0.45);
    const along = g.rng.range(-d / 2, d / 2);
    const px = sp.pos.x + dx * along - dz * w * t, pz = sp.pos.z + dz * along + dx * w * t;
    const py = g.ctx.groundWorld(px, pz);
    g.props.at(px, pz);
    boulder(g.props.at(px, pz), px, py, pz, g.rng.range(0.5, 1.6), g.rng);
  }
}

/** Distant snow-capped peaks on the horizon (far batch, no outline). */
export function horizonPeaks(g: GobiCtx): void {
  const L = g.ctx.L;
  for (let s = 120; s < L.length; s += g.rng.range(240, 420)) {
    for (const side of [-1, 1] as const) {
      if (!g.rng.chance(0.55)) continue;
      const sp = g.place.spot(s, side, g.rng.range(600, 1050));
      const y = g.ctx.groundWorld(sp.pos.x, sp.pos.z);
      const h = g.rng.range(180, 280);
      peak(g.far.at(sp.pos.x, sp.pos.z), sp.pos.x, y - 6, sp.pos.z, h * g.rng.range(0.4, 0.56), h, g.rng.range(0.6, 1));
    }
  }
}

/** Dry scrub and boulders along the verges: the desert is not empty. */
export function scatter(g: GobiCtx, s0: number, s1: number): void {
  for (let s = s0; s < s1; s += g.rng.range(12, 26)) {
    for (const side of [-1, 1] as const) {
      if (!g.rng.chance(0.7)) continue;
      const u = g.rng.range(6, 46);
      const sp = g.place.spot(s + g.rng.range(-3, 3), side, u);
      if (!g.place.free(sp.pos.x, sp.pos.z, 1.2, 1)) continue;
      if (g.rng.chance(0.62)) scrub(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, g.rng, g.rng.range(0.7, 1.4));
      else rockCluster(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, g.rng.range(0.8, 2.2), g.rng);
    }
  }
}

/** A few dry grass tufts right at the shoulder (the fastest way to read the edge at speed). */
export function shoulderTufts(g: GobiCtx, s0: number, s1: number): void {
  for (let s = s0; s < s1; s += g.rng.range(9, 18)) {
    const side = g.rng.chance(0.5) ? -1 : 1;
    const sp = g.place.spot(s, side, g.rng.range(3.4, 6.5));
    if (!g.place.free(sp.pos.x, sp.pos.z, 0.5, 0.6)) continue;
    scrub(g.props.at(sp.pos.x, sp.pos.z), sp.pos.x, sp.pos.y, sp.pos.z, g.rng, g.rng.range(0.45, 0.8));
  }
}
