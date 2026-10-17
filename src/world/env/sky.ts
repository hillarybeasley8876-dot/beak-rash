// Sky dome (gradient + sun disc/halo) and a ring of flat cartoon clouds. Both follow the camera so
// they never get closer; drawn first (renderOrder) without depth so everything covers them.
import {
  BackSide, CanvasTexture, Color, DoubleSide, Mesh, MeshBasicMaterial, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3,
} from 'three';
import { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { MeshBuf } from '../geom';

const DOME_R = 1800;

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.7))
    : mix(uHorizon, uBottom, smoothstep(0.0, -0.25, h));
  float cs = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(cs, 48.0) * 0.45 + pow(cs, 6.0) * 0.10);
  // Toon sun: a hard-edged disc with a ring.
  float disc = smoothstep(0.99935, 0.99950, cs);
  float ring = smoothstep(0.9970, 0.9973, cs) * (1.0 - smoothstep(0.9978, 0.9981, cs));
  col = mix(col, vec3(1.0, 0.99, 0.93), max(disc, ring * 0.35));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function buildSky(ctx: WorldCtx): void {
  const { look } = ctx;
  const sunDir = new Vector3(-look.sun.dir.x, -look.sun.dir.y, -look.sun.dir.z).normalize();
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uTop: { value: new Color(look.sky.top) },
      uHorizon: { value: new Color(look.sky.horizon) },
      uBottom: { value: new Color(look.sky.bottom) },
      uSunDir: { value: sunDir },
      uSunColor: { value: new Color(look.sun.color) },
    },
  }));
  const dome = new Mesh(ctx.own(new SphereGeometry(DOME_R, 48, 24)), mat);
  dome.name = 'sky';
  dome.renderOrder = -100;
  dome.frustumCulled = false;
  ctx.group.add(dome);
  const clouds = buildClouds(ctx, sunDir);
  ctx.onUpdate((_dtSim, dtReal, camera) => {
    dome.position.copy(camera.position);
    clouds.position.copy(camera.position);
    clouds.rotation.y += dtReal * 0.0015;
  });
}

/** Four cartoon cloud silhouettes drawn into one canvas (white body, sky-tinted shade band, soft outline). */
function cloudAtlas(ctx: WorldCtx): CanvasTexture {
  const W = 1024, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  const rng = new Rng(0xc10d);
  const shade = new Color(ctx.look.sky.horizon).lerp(new Color('#9fb6d8'), 0.55).getStyle();
  for (let k = 0; k < 4; k++) {
    const ox = k * 256, base = 116;
    const puffs: Array<[number, number, number]> = [];
    const n = 5 + rng.int(0, 3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const r = 16 + Math.sin(t * Math.PI) * rng.range(18, 34);
      puffs.push([ox + 34 + t * 188, base - 10 - r * 0.5, r]);
    }
    const body = (grow: number): void => {
      g.beginPath();
      for (const [x, y, r] of puffs) { g.moveTo(x + r + grow, y); g.arc(x, y, r + grow, 0, Math.PI * 2); }
      g.rect(ox + 34 - grow, base - 18 - grow, 188 + grow * 2, 18 + grow * 2);
      g.fill();
    };
    g.fillStyle = new Color(ctx.look.sky.top).lerp(new Color('#7f9cc8'), 0.5).getStyle();
    body(4);
    g.fillStyle = shade;
    body(0);
    g.save();
    g.beginPath();
    g.rect(ox, 0, 256, base - 16);
    g.clip();
    g.fillStyle = '#ffffff';
    g.translate(0, -7);
    body(-4);
    g.restore();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function buildClouds(ctx: WorldCtx, sunDir: Vector3): Mesh {
  const rng = new Rng(0x5c1d);
  const buf = new MeshBuf();
  const white = new Color('#ffffff');
  const p = new Vector3(), n = new Vector3(), right = new Vector3(), up = new Vector3(0, 1, 0);
  const COUNT = 22;
  for (let i = 0; i < COUNT; i++) {
    const az = (i / COUNT) * Math.PI * 2 + rng.range(-0.12, 0.12);
    // Keep the sun clear of clouds.
    if (Math.abs(Math.atan2(sunDir.x, sunDir.z) - az) < 0.15) continue;
    const dist = rng.range(1100, 1450), height = rng.range(60, 300);
    const w = rng.range(300, 560), h = w * 0.5;
    const k = rng.int(0, 3);
    const cx = Math.sin(az) * dist, cz = Math.cos(az) * dist;
    n.set(-cx, 0, -cz).normalize();
    right.crossVectors(up, n).normalize();
    const base = buf.count;
    const corners: Array<[number, number, number, number]> = [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [sx, sy, u, v] of corners) {
      p.set(cx + right.x * sx * w * 0.5, height + sy * h, cz + right.z * sx * w * 0.5);
      buf.vert(p, n, white, (k + u) / 4, v);
    }
    buf.quad(base, base + 1, base + 2, base + 3);
  }
  // Clouds pick up the sky's mood: warm at sunset, dim violet at night.
  const tint = new Color('#ffffff').lerp(new Color(ctx.look.sky.horizon), 0.22);
  if (ctx.look.grade.night) tint.lerp(new Color(ctx.look.sky.top), 0.62);
  const mat = ctx.own(new MeshBasicMaterial({
    color: tint,
    // Cut-out (not transparent) so it stays in the opaque list and draws right after the dome.
    map: ctx.own(cloudAtlas(ctx)), alphaTest: 0.5, depthWrite: false, depthTest: false, fog: false, side: DoubleSide,
  }));
  const mesh = new Mesh(ctx.own(buf.build({ colors: false })), mat);
  mesh.name = 'clouds';
  mesh.renderOrder = -99;
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  return mesh;
}
