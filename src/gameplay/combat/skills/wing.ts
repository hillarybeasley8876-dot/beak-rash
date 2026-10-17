// pelican.wing — wings out for 2.2 s: +40 % top speed; ramming knocks riders aside (8 dmg) without slowing
// the pelican down. Only the speed a rear-end contact takes is handed back; brakes, grass, slopes and walls
// still slow you as usual.
import { Vector3 } from 'three';
import type { RiderState } from '../../../core/types';
import { others, targetable, type CombatCtx } from '../ctx';
import { Trail } from '../visuals/trail';
import { skillBoost, skillHit } from './common';
import { TimedSkill, type SkillImpl } from './types';

const ID = 'pelican.wing';
export const WING = { dur: 2.2, boost: 0.4, damage: 8, knock: 7, ramAhead: 2.1, ramBack: -0.5, ramDx: 1.7 } as const;
/** Sim's rider contact box (|ds| < 1.7, |dx| < 0.75) plus one substep of closing distance. */
const CONTACT = { ds: 1.85, dx: 0.85, dy: 1 } as const;
/** Brake deceleration (m/s², SPEC §6) still allowed on a contact substep. */
const BRAKE = 12;

/** Would sim resolve a rear-end contact with `r` behind `o` this substep? (mirrors sim's solid-rider rule) */
function rearEnding(r: RiderState, o: RiderState): boolean {
  const solid = (o.mode === 'racing' || o.mode === 'finished') && !o.mods.intangible && o.invuln <= 0 &&
    !o.statuses.some((st) => st.id === 'gulped' && st.time > 0);
  const ds = o.s - r.s;
  return solid && ds > 0 && ds < CONTACT.ds && Math.abs(o.x - r.x) < CONTACT.dx && Math.abs(o.y - r.y) < CONTACT.dy;
}

class WingDash extends TimedSkill {
  private rammed = new Set<number>();
  private preSpeed = 0;
  private contact = false;
  private trails: Trail[];

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, WING.dur, true);
    skillBoost(ctx, r, WING.dur, WING.boost);
    const vs = ctx.visuals;
    this.trails = [1, -1].map((side) => vs.add(new Trail(vs, (out: Vector3) => {
      if (r.mode === 'crashed') return false;
      vs.local(r, side * 1.35, 1.5, 0.25, out);
      return true;
    }, { color: '#bdf4ff', width: 0.16, life: 0.3, max: 20, alpha: 0.85, additive: true })));
  }

  override pre(): void {
    const r = this.caster;
    this.preSpeed = r.speed;
    this.contact = this.ctx.session.riders.some((o) => o !== r && rearEnding(r, o));
  }

  protected tick(dt: number): void {
    const { ctx, caster: r } = this;
    if (this.contact) {
      const brake = ctx.session.controls.get(r.id)?.brake ?? 0;
      r.speed = Math.max(r.speed, this.preSpeed - BRAKE * brake * dt);
    }
    const hits = others(ctx, r, (o, ds, dx) => targetable(ctx, o) && !this.rammed.has(o.id) &&
      ds > WING.ramBack && ds < WING.ramAhead && Math.abs(dx) < WING.ramDx);
    for (const v of hits) {
      this.rammed.add(v.id);
      skillHit(ctx, r, v, ID, { damage: WING.damage, knock: WING.knock, speedLoss: 0.15, countCombo: this.rammed.size === 1 });
    }
  }

  protected override cleanup(): void {
    for (const t of this.trails) t.stop();
  }
}

export const wing: SkillImpl = { id: ID, cast: (ctx, r) => new WingDash(ctx, r) };
