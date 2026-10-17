// Rider near misses: overtaking a rival within ~0.6 m of contact at > 4 m/s relative, without touching,
// fires rider:nearMiss {kind:'rider'} for the faster rider (SP +4 in combat). Traffic near misses live in
// obstacles.ts.
import { TUNING as T } from './tuning';
import { isRiding, type SimCtx } from './state';

interface Pass { clean: boolean; fast: number }

export class NearPasses {
  private passes = new Map<number, Pass>();
  private cooldown = new Map<number, number>();

  constructor(private ctx: SimCtx) {}

  step(dt: number): void {
    for (const [id, t] of this.cooldown) {
      if (t <= dt) this.cooldown.delete(id);
      else this.cooldown.set(id, t - dt);
    }
    const list = this.ctx.riders;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]?.r;
      if (!a || !isRiding(a) || a.mods.intangible) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]?.r;
        if (!b || !isRiding(b) || b.mods.intangible) continue;
        const key = a.id * 1024 + b.id;
        const ds = Math.abs(b.s - a.s);
        const dx = Math.abs(b.x - a.x);
        const pass = this.passes.get(key);
        if (ds < T.contactDs) {
          const rel = a.speed - b.speed;
          if (dx < T.contactDx) {
            if (pass) pass.clean = false;
            else this.passes.set(key, { clean: false, fast: rel > 0 ? a.id : b.id });
          } else if (!pass && dx < T.contactDx + T.nearPassGap && Math.abs(rel) > T.nearPassRel) {
            this.passes.set(key, { clean: true, fast: rel > 0 ? a.id : b.id });
          }
          continue;
        }
        if (!pass || ds < T.contactDs + 1) continue;
        this.passes.delete(key);
        const fast = this.ctx.session.rider(pass.fast);
        if (pass.clean && fast && fast.mode === 'racing' && !this.cooldown.has(pass.fast)) {
          this.cooldown.set(pass.fast, 0.8);
          this.ctx.bus.emit('rider:nearMiss', { riderId: pass.fast, kind: 'rider' });
        }
      }
    }
  }
}
