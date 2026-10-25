// Sun (directional, shadow map following the camera with a small texel-snapped frustum), hemisphere
// ambient, fog and background from the look. Restores the scene's fog/background on dispose.
// While the camera is inside a tunnel both lights dim and sun shadows fade out (no sunlit rider
// shadows on the tunnel road; riders darken, lamp pools flash over them).
import { Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap, Vector3, type PerspectiveCamera } from 'three';
import type { WorldCtx } from '../ctx';

const SHADOW = { high: { size: 2048, half: 46 }, medium: { size: 1024, half: 36 } } as const;
/** Receiver normal offset in shadow texels (acne on faces near-parallel to the sun) and depth bias. */
const NORMAL_BIAS_TEXELS = 1.5;
const DEPTH_BIAS = -0.0004;
/** Light kept inside tunnels (day / night looks) and the dimming time constant (s). */
const TUNNEL_KEEP = { day: 0.4, night: 0.7 } as const;
const TUNNEL_TAU = 0.1;
const LOW_FOG = 0.8;
/** Fog / background objects set by track builds: a restart builds the new track while the old one is still
 *  alive, so the scene's fog there is the old track's; restoring to it on quit would leave a dead track's fog. */
const trackEnv = new WeakSet<object>();

/** Fraction of light to keep for a camera at p: `keep` under a tunnel roof, else 1. */
function tunnelLight(ctx: WorldCtx, keep: number): (p: Vector3) => number {
  if (!ctx.L.roof.some((r) => r > 0)) return () => 1;
  let hint = 0;
  return (p) => {
    const t = ctx.q.project(p, hint);
    hint = t.s;
    const roof = ctx.L.roof[ctx.q.sampleAt(t.s)] ?? 0;
    return roof > 0 && t.y < roof - 1 && Math.abs(t.x) < ctx.L.halfWidth + 3 ? keep : 1;
  };
}

export function buildLights(ctx: WorldCtx): () => void {
  const { look, app, quality } = ctx;
  const hemi = new HemisphereLight(look.ambient.sky, look.ambient.ground, look.ambient.intensity);
  hemi.name = 'ambient';
  const sun = new DirectionalLight(look.sun.color, look.sun.intensity);
  sun.name = 'sun';
  const dir = new Vector3(look.sun.dir.x, look.sun.dir.y, look.sun.dir.z).normalize();
  ctx.group.add(hemi, sun, sun.target);
  const cfg = quality === 'low' ? null : SHADOW[quality];
  if (cfg) {
    app.renderer.shadowMap.enabled = true;
    app.renderer.shadowMap.type = PCFShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(cfg.size, cfg.size);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -cfg.half;
    cam.right = cam.top = cfg.half;
    cam.near = 1;
    cam.far = 400;
    sun.shadow.bias = DEPTH_BIAS;
    sun.shadow.normalBias = NORMAL_BIAS_TEXELS * (cfg.half * 2) / cfg.size;
    cam.updateProjectionMatrix();
  }
  // Light-space basis for texel snapping (shadow edges do not crawl as the camera moves).
  const lz = dir.clone(), lx = new Vector3(), ly = new Vector3();
  lx.crossVectors(Math.abs(lz.y) > 0.99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0), lz).normalize();
  ly.crossVectors(lz, lx).normalize();
  const focus = new Vector3(), fwd = new Vector3();
  const texel = cfg ? (cfg.half * 2) / cfg.size : 1;
  const keep = look.grade.night ? TUNNEL_KEEP.night : TUNNEL_KEEP.day;
  const lightAt = tunnelLight(ctx, keep);
  let light = 1;
  ctx.onUpdate((_dtSim, dtReal, camera: PerspectiveCamera) => {
    light += (lightAt(camera.position) - light) * (1 - Math.exp(-Math.max(0, dtReal) / TUNNEL_TAU));
    sun.intensity = look.sun.intensity * light;
    hemi.intensity = look.ambient.intensity * (0.35 + 0.65 * light);
    sun.shadow.intensity = Math.min(1, Math.max(0, (light - keep) / (1 - keep)));
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    focus.copy(camera.position).addScaledVector(fwd, cfg ? cfg.half * 0.55 : 20);
    // Snap the focus in light space.
    const a = Math.round(focus.dot(lx) / texel) * texel, b = Math.round(focus.dot(ly) / texel) * texel, c = focus.dot(lz);
    focus.copy(lx).multiplyScalar(a).addScaledVector(ly, b).addScaledVector(lz, c);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(dir, -200);
    sun.target.updateMatrixWorld();
  });
  // Fog + background.
  const prevFog = app.scene.fog && trackEnv.has(app.scene.fog) ? null : app.scene.fog;
  const prevBg = app.scene.background && trackEnv.has(app.scene.background) ? null : app.scene.background;
  // quality=low pulls the fog in, and with it the fog-distance culling (world/lod.ts).
  const fogK = quality === 'low' ? LOW_FOG : 1;
  const fog = new Fog(look.fog.color, look.fog.near * fogK, look.fog.far * fogK);
  const bg = new Color(look.sky.horizon);
  trackEnv.add(fog).add(bg);
  app.scene.fog = fog;
  app.scene.background = bg;
  return () => {
    if (app.scene.fog === fog) app.scene.fog = prevFog;
    if (app.scene.background === bg) app.scene.background = prevBg;
    sun.dispose();
    hemi.dispose();
  };
}
