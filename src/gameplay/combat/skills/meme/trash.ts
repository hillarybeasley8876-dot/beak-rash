// pedro.trash — 垃圾桶盲盒: pedro spins and rummages in a bin and comes up with one random prize: a missile, a
// weapon, a handful of coins or a stink cloud. The bin is a lottery, not a plan: what comes out is what it is —
// and what comes out is always shown (r7 SPEC §29): the prize rises out of the bin and hangs over pedro's head,
// and `skill:result` names it, so a prize nobody can see is never a prize nobody knows about.
import type { RiderState, WeaponId } from '../../../../core/types';
import { WEAPONS } from '../../../../data/weapons';
import { equip, rollWeapon } from '../../armory';
import { nearest, targetable, type CombatCtx } from '../../ctx';
import type { PropKey } from '../../meshes/catalog';
import { SpinSwirl } from '../../visuals/auras';
import { skillAffect, skillHit, skillObstacleHit } from '../common';
import { TimedSkill, type SkillImpl } from '../types';
import { BinRummage, PrizePop } from './visuals';

/** A weapon the racer can hold (never bare wings). */
type ArmedWeapon = Exclude<WeaponId, 'none'>;

const ID = 'pedro.trash';
export const TRASH = {
  dur: 0.9,        // s of rummaging
  launchAt: 0.45,  // s the tin can leaves the bin (once the reveal has been seen)
  rise: 0.35,      // s the prize takes to come up out of the bin
  hang: 0.6,       // s it hangs over pedro's head
  height: 2.5,     // m above the road it hangs at
  size: 1.4,       // how big the prize reads over his head
  radius: 12,      // m the stink cloud reaches
  damage: 10,      // the stink bites
  slow: 0.3,
  slowTime: 2,
  coins: 40,       // 小鱼干 in the coin prize
  missileSpeed: 18,   // m/s over the rider's own speed
  missileDamage: 12,
  missileLife: 3,
  missileTurn: 6,
} as const;

type Prize = 'missile' | 'weapon' | 'coins' | 'stink';
const PRIZES: readonly Prize[] = ['missile', 'weapon', 'coins', 'stink'];

class Trash extends TimedSkill {
  private fuse: (() => void) | null = null;

  constructor(ctx: CombatCtx, r: RiderState) {
    super(ctx, r, ID, TRASH.dur, false);
    ctx.visuals.add(new BinRummage(ctx.visuals, r, TRASH.dur));
    ctx.visuals.add(new SpinSwirl(ctx.visuals, r, 2.2, TRASH.dur, ['#c9cbd0', '#5c6672']));
    this.rummage(ctx, r);
    ctx.bus.emit('taunt', { riderId: r.id, text: '开盲盒！', character: r.character });
  }

  protected tick(): void {
    if (!this.fuse || this.t < TRASH.launchAt) return;
    const fire = this.fuse;
    this.fuse = null;
    fire();
  }

  private rummage(ctx: CombatCtx, r: RiderState): void {
    const prize = ctx.rng.pick(PRIZES);
    if (prize === 'missile') this.missile(ctx, r);
    else if (prize === 'weapon') this.weapon(ctx, r);
    else if (prize === 'coins') this.coins(ctx, r);
    else this.stink(ctx, r);
  }

  /** The prize comes up out of the bin, hangs over pedro's head, and is named. */
  private reveal(ctx: CombatCtx, r: RiderState, key: PropKey, text: string): void {
    ctx.visuals.add(new PrizePop(ctx.visuals, r, key, TRASH));
    ctx.bus.emit('skill:result', { riderId: r.id, skillId: ID, text, good: true });
    ctx.session.app.fx.burst('sparkle', ctx.pos(r, 2), { count: 6 });
  }

  /** A tin can with a rocket tail: it flies at the nearest rider ahead. */
  private missile(ctx: CombatCtx, r: RiderState): void {
    this.reveal(ctx, r, 'meme:can', '掏到 飞弹！');
    this.fuse = () => {
      const target = nearest(ctx, r, (o, ds) => targetable(ctx, o) && ds > 1 && ds < 40) ?? null;
      ctx.projectiles.spawn({
        skillId: ID, owner: r, target, s: r.s + 1.1, x: r.x, y: r.y + 1.5,
        speed: r.speed + TRASH.missileSpeed, turn: TRASH.missileTurn, life: TRASH.missileLife, radius: 0.4,
        geometry: ctx.lib.get('meme:can'), trail: '#ffb347',
        onHit: (victim) => {
          skillHit(ctx, r, victim, ID, { damage: TRASH.missileDamage, knock: 3, speedLoss: 0.1 });
        },
        onObstacle: (o) => {
          skillObstacleHit(ctx, r, o, ID, TRASH.missileDamage);
        },
      });
    };
  }

  /** A weapon out of the bin: the racer keeps it. */
  private weapon(ctx: CombatCtx, r: RiderState): void {
    const rolled = rollWeapon(ctx);
    const weapon: ArmedWeapon = rolled === 'none' ? 'saltfish' : rolled;
    this.reveal(ctx, r, `weapon:${weapon}`, `掏到 ${WEAPONS[weapon].name}`);
    equip(ctx, r, weapon);
  }

  /** Coins (小鱼干) in the bin: they go straight into the pocket. */
  private coins(ctx: CombatCtx, r: RiderState): void {
    this.reveal(ctx, r, 'meme:coins', `+${TRASH.coins} 小鱼干`);
    r.coins += TRASH.coins;
    ctx.session.app.fx.burst('coin', ctx.pos(r, 1.2), { count: 10 });
  }

  /** The stink: it hits everybody around and slows them down. */
  private stink(ctx: CombatCtx, r: RiderState): void {
    this.reveal(ctx, r, 'meme:stink', '臭气熏天！');
    for (const v of ctx.session.riders) {
      if (v === r || !targetable(ctx, v)) continue;
      if (Math.hypot(v.s - r.s, v.x - r.x) > TRASH.radius) continue;
      skillHit(ctx, r, v, ID, { damage: TRASH.damage, speedLoss: 0.1, countCombo: true });
      skillAffect(ctx, r, v, ID, [['slow', TRASH.slowTime, TRASH.slow]]);
      ctx.session.app.fx.burst('smoke', ctx.pos(v, 1), { count: 8 });
    }
  }
}

export const trash: SkillImpl = { id: ID, cast: (ctx, r) => new Trash(ctx, r) };
