// Sun (directional, shadow map following the camera with a small texel-snapped frustum), hemisphere
// ambient, fog and background from the look. Restores the scene's fog/background on dispose.
import { Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap, Vector3, type PerspectiveCamera } from 'three';
import type { WorldCtx } from '../ctx';

const SHADOW = { high: { size: 2048, half: 46 }, medium: { size: 1024, half: 36 } } as const;

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
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    cam.updateProjectionMatrix();
  }
  // Light-space basis for texel snapping (shadow edges do not crawl as the camera moves).
  const lz = dir.clone(), lx = new Vector3(), ly = new Vector3();
  lx.crossVectors(Math.abs(lz.y) > 0.99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0), lz).normalize();
  ly.crossVectors(lz, lx).normalize();
  const focus = new Vector3(), fwd = new Vector3();
  const texel = cfg ? (cfg.half * 2) / cfg.size : 1;
  ctx.onUpdate((_dtSim, _dtReal, camera: PerspectiveCamera) => {
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
  const prevFog = app.scene.fog, prevBg = app.scene.background;
  const fog = new Fog(look.fog.color, look.fog.near, look.fog.far);
  const bg = new Color(look.sky.horizon);
  app.scene.fog = fog;
  app.scene.background = bg;
  return () => {
    if (app.scene.fog === fog) app.scene.fog = prevFog;
    if (app.scene.background === bg) app.scene.background = prevBg;
    sun.dispose();
    hemi.dispose();
  };
}
