// Combat event reactions: hit bursts (+ weapon bits), player pulses, KO bursts, pickups, skills.
import { Vector3 } from 'three';
import { clamp } from '../../core/math';
import { bodyBits } from './species';
import { skillFlair } from './skills';
import type { RiderId, Vec3Like, WeaponId } from '../../core/types';
import type { FxContext } from '../context';

const WEAPON_BITS: Partial<Record<WeaponId, string>> = {
  saltfish: 'scales', baguette: 'crumbs', leek: 'leaves', keyboard: 'keys', pan: 'sparks', slipper: 'poof', umbrella: 'sparks',
};

const PICKUPS: Record<string, string> = { coin: 'coin', coins: 'coin', fish: 'heal', crate: 'crate', weapon: 'crate', can: 'sparkle', sp: 'sparkle' };

const dir = new Vector3();

export function subscribeCombat(ctx: FxContext): Array<() => void> {
  const { bus } = ctx.app;
  const isPlayer = (id: RiderId | null): boolean => id !== null && ctx.session()?.player.id === id;

  const hitDir = (attacker: RiderId, side: number): Vec3Like | undefined => {
    const a = ctx.tracker.get(attacker);
    return a ? dir.copy(a.right).multiplyScalar(side).setY(0.35) : undefined;
  };

  return [
    bus.on('combat:hit', (e) => {
      const v = ctx.tracker.get(e.victim);
      const scale = clamp(0.8 + e.damage / 30, 0.8, 1.5);
      // A lethal blow skips its impact lines: the KO punctuation (koPow) brings its own.
      const lethal = !e.blocked && (ctx.session()?.rider(e.victim)?.hp ?? 1) <= 0;
      const preset = e.blocked ? 'block' : lethal ? 'hitKo' : e.crit ? 'crit' : e.heavy ? 'hitHeavy' : 'hit';
      const opts = { vel: v?.vel, ground: v?.ground, dir: hitDir(e.attacker, e.side), scale };
      ctx.burst(preset, e.pos, opts);
      const bits = WEAPON_BITS[e.weapon];
      if (bits && !e.blocked) ctx.burst(bits, e.pos, { ...opts, scale: 1 });
      if (e.weapon === 'selfie' && !e.blocked) ctx.post.flash(0.35, '#ffffff');
      if (isPlayer(e.victim) && !e.blocked) {
        ctx.post.hurt(clamp(e.damage / 22 + (e.heavy || e.crit ? 0.3 : 0), 0.35, 1));
        ctx.post.punch(0.006);
        if (e.heavy || e.crit) ctx.post.impact(e.crit ? 0.034 : 0.02, '#ff1e3c');
      } else if (isPlayer(e.attacker)) {
        ctx.post.punch(e.crit ? 0.012 : e.heavy ? 0.009 : 0.004);
        if (e.heavy || e.crit) ctx.post.impact(e.crit ? 0.034 : 0.02, '#ffffff');
      }
    }),
    bus.on('combat:ko', (e) => {
      const r = ctx.session()?.rider(e.victim);
      const v = ctx.tracker.get(e.victim);
      if (!r) return;
      const bits = bodyBits(r.character);
      ctx.burst(bits.kind === 'feathers' ? 'koFeathers' : 'koFur', v?.body ?? e.pos, {
        vel: v?.vel, ground: v?.ground, color: bits.color, color2: bits.color2,
      });
    }),
    bus.on('pickup:take', (e) => {
      const t = ctx.tracker.get(e.riderId);
      ctx.burst(PICKUPS[e.kind] ?? 'sparkle', t?.body ?? e.pos, { vel: t?.vel, ground: t?.ground });
    }),
    bus.on('combat:weaponDrop', (e) => ctx.burst('poof', e.pos, { scale: 0.6, ground: ctx.tracker.get(e.riderId)?.ground })),
    bus.on('combat:weaponPick', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t) ctx.burst('sparkle', t.body, { vel: t.vel, scale: 0.7 });
    }),
    bus.on('combat:combo', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t && e.count >= 3 && isPlayer(e.riderId)) ctx.burst('sparkle', t.head, { vel: t.vel, color: '#ff1e3c' });
    }),
    bus.on('skill:cast', (e) => skillFlair(ctx, 'cast', e.skillId, e.riderId)),
    bus.on('skill:hit', (e) => skillFlair(ctx, 'hit', e.skillId, e.riderId, e.pos, e.victim)),
    bus.on('skill:end', (e) => skillFlair(ctx, 'end', e.skillId, e.riderId)),
  ];
}
