// pool.warsong — 战歌起: the war song starts. The singer speeds up; the rivals around go weak in the knees.
import { Mesh, Vector3, type Material } from 'three';
import type { RiderState } from '../../../../core/types';
import { type CombatCtx } from '../../ctx';
import { addStatus } from '../../statuses';
import { AuraDisc } from '../../visuals/auras';
import type { Visual, VisualSystem } from '../../visuals/visuals';
import { inRadius, skillAffect, skillBoost } from '../common';
import { TimedSkill, type SkillImpl } from '../types';

const ID = 'pool.warsong';
export const WARSONG = {
  radius: 6,     // m: who hears the song
  dur: 3,        // s of the song
  boost: 0.25,   // the singer's extra top speed
  slow: 0.3,     // the rivals' speed loss
  slowTime: 2.5, // s
} as const;

const AT = new Vector3();

/** Three little notes circling the singer. */
class Notes implements Visual {
  private meshes: Mesh[] = [];
  private t = 0;

  constructor(private vs: VisualSystem, private r: RiderState, private dur: number) {
    for (let i = 0; i < 3; i++) {
      const m = new Mesh(vs.ctx.lib.get('gag:note'), vs.materials.glow('#ffe066', 0.95, { additive: true }));
      m.renderOrder = 3;
      vs.ctx.root.add(m);
      this.meshes.push(m);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.dur || this.r.mode === 'crashed') return false;
    const env = Math.max(0, Math.min(1, this.t / 0.2, (this.dur - this.t) / 0.2));
    this.meshes.forEach((m, i) => {
      const a = this.t * 2.4 + (i * Math.PI * 2) / 3;
      m.position.copy(this.vs.local(this.r, Math.cos(a) * 0.9, 1.8 + Math.sin(this.t * 3 + i) * 0.25, Math.sin(a) * 0.9, AT));
      m.lookAt(this.vs.cameraPos);
      m.scale.setScalar(0.45 * env);
    });
    return true;
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.removeFromParent();
      this.vs.materials.release(m.material as Material);
    }
  }
}

class WarSong extends TimedSkill {
  private slowed = new Set<number>();

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, WARSONG.dur, false);
    skillBoost(ctx, r, WARSONG.dur, WARSONG.boost);
    ctx.visuals.add(new AuraDisc(ctx.visuals, r, WARSONG.radius, WARSONG.dur, '#ffd36b', '#ff9f1a'));
    ctx.visuals.add(new Notes(ctx.visuals, r, WARSONG.dur));
  }

  protected tick(): void {
    const { ctx, caster: r } = this;
    for (const v of inRadius(ctx, r, WARSONG.radius)) {
      if (this.slowed.has(v.id)) {
        addStatus(v, 'slow', 0.3, WARSONG.slow, r.id);
        continue;
      }
      this.slowed.add(v.id);
      skillAffect(ctx, r, v, ID, [['slow', WARSONG.slowTime, WARSONG.slow]]);
    }
  }
}

export const warsong: SkillImpl = { id: ID, cast: (ctx, r) => new WarSong(ctx, r) };
