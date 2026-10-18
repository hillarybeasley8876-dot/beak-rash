// Weapon ownership rules: loadouts, uses and breaking, knock-loose → steal or drop (SPEC §7).
import { ARMORY, WEAPONS } from '../../data/weapons';
import type { RiderState, WeaponId } from '../../core/types';
import type { CombatCtx } from './ctx';
import { WEAPON_RULES } from './tuning';

/** Hand `weapon` to r with `uses` hits left (a fresh one by default); RiderState.weaponUses is combat's to write. */
export function equip(ctx: CombatCtx, r: RiderState, weapon: WeaponId, uses?: number): void {
  r.weapon = weapon;
  r.weaponUses = weapon === 'none' ? Infinity : uses ?? WEAPONS[weapon].uses;
  ctx.view(r)?.setWeapon(weapon);
}

/** Weighted random weapon from the armory. */
export function rollWeapon(ctx: CombatCtx): WeaponId {
  const total = ARMORY.reduce((sum, id) => sum + WEAPONS[id].weight, 0);
  let pick = ctx.rng.range(0, total);
  for (const id of ARMORY) {
    pick -= WEAPONS[id].weight;
    if (pick <= 0) return id;
  }
  return ARMORY[ARMORY.length - 1] ?? 'saltfish';
}

/** Rivals start armed by career level; the player starts with bare wings. */
export function armRivals(ctx: CombatCtx): void {
  const odds = WEAPON_RULES.armedByLevel;
  const p = odds[Math.max(0, Math.min(odds.length - 1, ctx.session.config.level))] ?? 0.5;
  for (const r of ctx.session.riders) {
    if (r.isPlayer) equip(ctx, r, 'none');
    else equip(ctx, r, ctx.rng.chance(p) ? rollWeapon(ctx) : 'none');
  }
}

/** fx preset per weapon for the moment it breaks (debris matching the weapon). */
const BREAK_BURST: Partial<Record<WeaponId, string>> = { baguette: 'crumbs', keyboard: 'keys', leek: 'leaves', saltfish: 'scales' };

/** One landed hit wears the weapon; it breaks at 0 uses (combat:weaponBreak, then bare wings). */
export function consumeUse(ctx: CombatCtx, r: RiderState): void {
  if (r.weapon === 'none') return;
  r.weaponUses -= 1;
  if (r.weaponUses > 0) return;
  const pos = ctx.pos(r, 1.3);
  ctx.bus.emit('combat:weaponBreak', { riderId: r.id, weapon: r.weapon, pos });
  ctx.session.app.fx.burst(BREAK_BURST[r.weapon] ?? 'debris', pos, { count: 14 });
  ctx.session.app.fx.burst('poof', pos, { scale: 0.5 });
  equip(ctx, r, 'none');
}

/** After a landed melee hit: maybe knock the victim's weapon loose (unarmed attackers steal it). */
export function knockLoose(ctx: CombatCtx, a: RiderState, v: RiderState, heavy: boolean): void {
  if (v.weapon === 'none') return;
  if (!ctx.roll(heavy ? WEAPON_RULES.looseHeavy : WEAPON_RULES.looseLight, ctx.force.loose)) return;
  takeWeapon(ctx, a, v);
}

/** Move v's weapon to a (if unarmed) or onto the road (never a forced swap). Knock-loose, bites and steals. */
export function takeWeapon(ctx: CombatCtx, a: RiderState, v: RiderState): void {
  const weapon = v.weapon;
  if (weapon === 'none') return;
  const uses = v.weaponUses;
  equip(ctx, v, 'none');
  if (a.weapon === 'none') {
    equip(ctx, a, weapon, uses);
    ctx.bus.emit('combat:weaponPick', { riderId: a.id, weapon, stolenFrom: v.id });
  } else {
    dropWeapon(ctx, v, weapon, uses);
  }
}

export function dropWeapon(ctx: CombatCtx, from: RiderState, weapon: WeaponId, uses: number): void {
  const pos = ctx.pos(from, 1.2);
  ctx.pickups.dropWeapon(weapon, uses, from);
  ctx.bus.emit('combat:weaponDrop', { riderId: from.id, weapon, pos });
}
