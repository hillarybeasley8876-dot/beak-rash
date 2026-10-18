// Far bank across the river: one continuous embankment with a lamp-lit promenade, a skyline of lit
// towers 275–420 m out on the left of the riverside (window-shader blocks in the far batch, neon crowns,
// rooftop kit) and shimmering additive light columns on the water toward the road.
import { AdditiveBlending, Color, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { box, trs } from '../../kit/shapes';
import { MeshBuf } from '../../geom';
import { skylineBlock } from '../../scenery/props/city-building';
import { CPAL } from '../../scenery/props/city-kit';
import type { City } from './city';
import { cityTime } from './mats';
import { hdr, zoneRuns } from './util';

const m = new Matrix4();
const BANK_Y = 1.6;                  // quay top above the water
const EDGE_U = 262;                  // far-bank edge, m from the riverside road
const DEPTH = 190;                   // embankment depth behind the edge (m)
const PROMENADE = hdr('#ffd9a0', 1.6), LAMP = hdr('#ffcf8a', 2.4);
const CROWNS = [hdr('#ff2d95', 2.4), hdr('#22e8ff', 2.4), hdr('#ffe600', 2.0), hdr('#b46bff', 2.2)];
const STREAKS = [new Color(1.0, 0.62, 0.3), new Color(0.35, 0.7, 1.0), new Color(1.0, 0.3, 0.75)];

/** Is the world point over open water (ground well below the street)? */
function water(c: City, x: number, z: number): boolean {
  return c.d.ctx.groundWorld(x, z) < 0.5;
}

/** Light column on the water from the tower foot toward the road (fades out). */
function streak(buf: MeshBuf, foot: Vector3, toRoad: Vector3, along: Vector3, w: number, len: number, col: Color): void {
  const up = new Vector3(0, 1, 0), black = new Color(0, 0, 0);
  const a = foot.clone().addScaledVector(along, -w / 2).setY(0.08), b = foot.clone().addScaledVector(along, w / 2).setY(0.08);
  const c2 = b.clone().addScaledVector(toRoad, len), d = a.clone().addScaledVector(toRoad, len);
  const i0 = buf.vert(a, up, col), i1 = buf.vert(b, up, col), i2 = buf.vert(c2, up, black), i3 = buf.vert(d, up, black);
  buf.quad(i0, i1, i2, i3);
}

/** Additive light columns on the river: fade with camera distance (not fog) and shimmer in ripples. */
function riverGlowMat(c: City): MeshBasicMaterial {
  const { ctx } = c.d;
  const time = cityTime(ctx);
  const mat = ctx.own(new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCityTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCityTime;\nvarying vec3 vRW;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  float rip = sin(vRW.x * 1.7 + uCityTime * 1.3) * sin(vRW.z * 2.3 - uCityTime * 1.1) + 0.5 * sin((vRW.x + vRW.z) * 0.6 + uCityTime * 0.7);
  gl_FragColor.rgb *= (0.5 + 0.35 * rip) * (1.0 - smoothstep(420.0, 760.0, length(vRW - cameraPosition)));`);
  };
  mat.customProgramCacheKey = () => 'city-river-glow';
  return mat;
}

/** One continuous embankment under the far-bank towers with a lamp-lit promenade along its edge. */
function embankment(c: City, s0: number, s1: number): void {
  const { ctx, b } = c.d;
  for (let s = s0; s < s1; s += 24) {
    const fr = ctx.q.frameVis(s);
    const right = new Vector3(fr.right.x, 0, fr.right.z).normalize();
    const edge = new Vector3(fr.pos.x, 0, fr.pos.z).addScaledVector(right, -EDGE_U);
    if (!water(c, edge.x, edge.z) || !water(c, edge.x - right.x * 60, edge.z - right.z * 60)) continue;
    const yaw = Math.atan2(right.x, right.z) + Math.PI;
    const mid = edge.clone().addScaledVector(right, -DEPTH / 2);
    box(c.cb.far.at(mid.x, mid.z).setAux(0), trs(mid.x, BANK_Y / 2 - 0.5, mid.z, yaw, 26, BANK_Y + 1, DEPTH, m), CPAL.roof);
    const rail = edge.clone().addScaledVector(right, -0.6);
    box(b.glow.at(rail.x, rail.z), trs(rail.x, BANK_Y + 1.0, rail.z, yaw, 24.5, 0.08, 0.08, m), PROMENADE);
    for (const k of [-6, 6]) {
      const along = new Vector3(fr.tangent.x, 0, fr.tangent.z).normalize();
      const lamp = rail.clone().addScaledVector(along, k).addScaledVector(right, -0.8);
      box(b.glow.at(lamp.x, lamp.z), trs(lamp.x, BANK_Y + 3.4, lamp.z, yaw, 0.4, 0.3, 0.4, m), LAMP);
    }
  }
}

export function farBank(c: City): number {
  const { ctx } = c.d;
  const rng = c.d.rng.fork(0xba4c);
  const streaks = new MeshBuf();
  let n = 0;
  for (const [s0, s1] of zoneRuns(ctx, ['drop', 'riverside', 'bridge'])) {
    embankment(c, s0 - 40, s1 + 60);
    for (let s = s0 - 40; s < s1 + 60; s += rng.range(20, 30)) {
      const fr = ctx.q.frameVis(s);
      const right = new Vector3(fr.right.x, 0, fr.right.z).normalize();
      const along = new Vector3(fr.tangent.x, 0, fr.tangent.z).normalize();
      const u = rng.range(EDGE_U + 12, 420);
      const p = new Vector3(fr.pos.x, 0, fr.pos.z).addScaledVector(right, -u);
      if (!water(c, p.x, p.z) || !water(c, p.x + right.x * 60, p.z + right.z * 60)) continue;
      const w = rng.range(18, 34), d = rng.range(16, 28), h = rng.chance(0.25) ? rng.range(80, 130) : rng.range(26, 70);
      const yaw = Math.atan2(right.x, right.z) + Math.PI; // front (local −Z) faces the road
      const buf = c.cb.far.at(p.x, p.z);
      skylineBlock(buf, p.x, BANK_Y, p.z, yaw, w, d, h, rng, c.cb.lights.at(p.x, p.z));
      if (h > 60) {
        const top = trs(p.x - right.x * (d / 2), BANK_Y + h + 0.6, p.z - right.z * (d / 2), yaw, w + 0.4, 1.2, d + 0.4, m);
        box(c.d.b.glow.at(p.x, p.z), top, CROWNS[n % CROWNS.length] as Color);
      }
      const col = (STREAKS[n % STREAKS.length] as Color).clone().multiplyScalar(h > 60 ? 1.1 : 0.7);
      streak(streaks, p.clone().addScaledVector(right, u - EDGE_U + 2), right, along, w * 0.55, EDGE_U - 50, col);
      n++;
    }
  }
  if (streaks.idx.length) {
    const mesh = new Mesh(ctx.own(streaks.build()), riverGlowMat(c));
    mesh.name = 'city:riverGlow';
    mesh.renderOrder = 2;
    ctx.group.add(mesh);
  }
  return n;
}
