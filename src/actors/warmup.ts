// Shader warm-up (perf): every program a rider can need later in the race compiles in its first rendered frames (the
// race intro), not at the first respawn, skill or KO. Stage 1 draws the view as-is with frustum culling off (bikes,
// pedal extenders and weapons of riders the intro camera never shows) plus every hidden extra: a shrunken stand-in
// weapon when unarmed (riders pick weapons up mid-race), the glint and steam sprites at opacity 0, the dizzy stars
// shrunk to nothing and the empty swing smear. Stage 2 draws it faded (RiderFade at α 0.99: transparent clones, depth
// proxies, faded hulls). Both stages include the shadow pass, so its depth variants compile too. A stage ends once
// the body has really been rendered (onAfterRender) a few times (three.js keys the shadow pass on the light setup of
// the previous frame, so the first frame of a race compiles unlit variants); then everything is restored.
import { Color, type Mesh, type Object3D, type SpriteMaterial, type WebGLInfo } from 'three';
import type { RiderExtras } from './extras';
import type { RiderFade } from './fade';
import { createWeaponMesh } from './weapons';

const WHITE = new Color('#ffffff');
const TINY = 1e-4;
/** Rendered frames per stage, and the rendered frames without this body to give up after (a hidden view). */
const RENDERS = 3, MAX_WAIT = 120;

export class ShaderWarmup {
  private stage = 0;
  /** Renderer frames that drew the body in this stage (one count per frame), the last one counted, frames waited. */
  private renders = 0;
  private drawnAt = -1;
  private seenAt = -1;
  private waited = 0;
  private readonly culled = new Set<Object3D>();
  private stand: Mesh | null = null;
  private glintOpacity = 1;

  constructor(private readonly root: Object3D, private readonly body: Mesh, private readonly fade: RiderFade,
    private readonly extras: RiderExtras, private readonly info: WebGLInfo) {
    body.onAfterRender = (): void => {
      if (this.drawnAt === info.render.frame) return;
      this.drawnAt = info.render.frame;
      this.renders++;
    };
  }

  get done(): boolean {
    return this.stage >= 3;
  }

  /** Call at the end of every view update (after the fade and the extras have been updated). */
  update(): void {
    if (this.stage >= 3) return;
    // Frames that were not rendered at all (a frame that threw, a paused loop) do not count toward giving up.
    const frame = this.info.render.frame, rendered = frame !== this.seenAt;
    this.seenAt = frame;
    if (this.stage === 0) this.stage = 1;
    else if (this.renders >= RENDERS) {
      this.stage++;
      this.renders = 0;
      this.waited = 0;
    } else if (rendered && ++this.waited > MAX_WAIT) this.stage = 3;
    if (this.stage >= 3) this.finish();
    else this.apply(this.stage === 2);
  }

  /** Re-applied every update until rendered (the normal update hides the extras and restores the fade). */
  private apply(faded: boolean): void {
    const ex = this.extras;
    if (!ex.weapon.armed && !this.stand) {
      this.stand = createWeaponMesh('saltfish');
      this.stand.scale.setScalar(TINY);
      ex.weapon.pivot.add(this.stand);
    }
    const glint = ex.glint.sprite, gm = glint.material as SpriteMaterial;
    if (gm.opacity > 0) this.glintOpacity = gm.opacity;
    gm.opacity = 0;
    glint.visible = true;
    ex.steam.group.visible = true;
    for (const puff of ex.steam.group.children) puff.visible = true;
    ex.stars.group.visible = true;
    ex.stars.group.scale.setScalar(TINY);
    ex.smear.mesh.visible = true;
    if (faded) this.fade.set(0.99, WHITE, 0, 0);
    this.root.traverse((o) => {
      if (!o.frustumCulled) return;
      o.frustumCulled = false;
      this.culled.add(o);
    });
  }

  private finish(): void {
    for (const o of this.culled) o.frustumCulled = true;
    this.culled.clear();
    this.stand?.removeFromParent();
    this.stand = null;
    (this.extras.glint.sprite.material as SpriteMaterial).opacity = this.glintOpacity;
    this.body.onAfterRender = (): void => undefined;
  }
}
