// pool.popup — 开屏广告: a pop-up ad blocks the view of the rider ahead for a few seconds.
import { Mesh, Vector3 } from 'three';
import type { RiderState } from '../../../../core/types';
import { nearest, targetable, type CombatCtx } from '../../ctx';
import { toonMesh } from '../../meshes/build';
import { addStatus } from '../../statuses';
import type { Visual, VisualSystem } from '../../visuals/visuals';
import { skillAffect } from '../common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.popup';
export const POPUP = { range: 24, dur: 3.5, blind: 3.5 } as const;

const AT = new Vector3();

/** The rider the ad is shown to (the nearest one ahead). */
const popupTarget = (ctx: CombatCtx, r: RiderState): RiderState | undefined =>
  nearest(ctx, r, (o, ds, dx) => targetable(ctx, o) && ds > 1.5 && ds <= POPUP.range && Math.abs(dx) < 5);

/** The ad itself: a bright panel floating in front of the victim's face, always turned to the camera. */
class AdPanel implements Visual {
  private mesh: Mesh;
  private t = 0;
  private dead = false;

  constructor(private vs: VisualSystem, private victim: RiderState | null) {
    this.mesh = toonMesh(vs.ctx.lib.get('gag:ad'), 0.02);
    this.mesh.renderOrder = 4;
    vs.ctx.root.add(this.mesh);
  }

  /** The ad is closed (the skill ended): the next update drops the panel. */
  stop(): void {
    this.dead = true;
  }

  update(dt: number): boolean {
    if (this.dead || !this.victim || this.victim.mode === 'crashed') return false;
    this.t += dt;
    // right in front of the victim's face, big enough to cover their whole view
    this.mesh.position.copy(this.vs.local(this.victim, 0, 1.95, -1, AT));
    this.mesh.lookAt(this.vs.cameraPos);
    const k = 1.3 * (1 + Math.sin(this.t * 9) * 0.04);
    this.mesh.scale.set(k, k, k);
    return true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
  }
}

class Popup extends TimedSkill {
  private target: RiderState | null;
  private panel: AdPanel;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, POPUP.dur, false);
    this.target = popupTarget(ctx, r) ?? null;
    this.panel = ctx.visuals.add(new AdPanel(ctx.visuals, this.target));
    if (this.target) skillAffect(ctx, r, this.target, ID, [['blind', POPUP.blind, 1]]);
  }

  protected tick(): void {
    if (!this.target) return;
    addStatus(this.target, 'blind', 0.3, 1, this.caster.id); // the ad is still up
  }

  protected override cleanup(): void {
    this.panel.stop();
  }
}

export const popup: SkillImpl = {
  id: ID, noTarget: '弹给谁看？', ready: (ctx, r) => popupTarget(ctx, r) !== undefined, cast: (ctx, r) => new Popup(ctx, r),
};
