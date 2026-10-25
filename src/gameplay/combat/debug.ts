// window.__br.combat — test hooks for tools/combat-check.mjs and critics. Lives only while a session does.
import type { DebugApi } from '../../core/debug';
import type { RiderState, Side, StatusId, WeaponId } from '../../core/types';
import { equip } from './armory';
import type { CombatCtx, ForcedRolls, RiderCombat } from './ctx';
import { startSwing } from './melee';
import type { PickupKind } from './pickups/items';
import { addStatus } from './statuses';

export interface CombatDebug {
  /** Hold rider `id` at (player.s + ds, player.x + dx) at the player's speed; passive = never attacks. */
  pin(id: number, ds: number, dx: number, passive?: boolean): void;
  unpin(id?: number): void;
  give(id: number, weapon: WeaponId, uses?: number): void;
  set(id: number, fields: { hp?: number; sp?: number; x?: number; s?: number; speed?: number }): void;
  status(id: number, status: StatusId, time: number, strength?: number): void;
  /** Queue a skill cast (normal cooldown / SP / state checks; slot 4 = ult). */
  cast(id: number, slot: number): void;
  /** Start a swing now if the rider can swing (side 0 = auto). Returns false if it couldn't. */
  swing(id: number, side: Side | 0, heavy?: boolean): boolean;
  /** Skill cooldowns, the bell cooldown and the SP lockouts (bell and swing per rival, after SHOWTIME). */
  resetCooldowns(id?: number): void;
  force(rolls: ForcedRolls | null): void;
  spawn(kind: PickupKind, s: number, x: number, weapon?: WeaponId): number;
  /** Remove every pickup (tests that measure coins / HP / SP exactly). */
  clearItems(): void;
  items(near?: number): Array<{ id: number; kind: string; s: number; x: number; y: number; alive: boolean; weapon: WeaponId }>;
  projectiles(): Array<{ id: number; skillId: string; s: number; x: number; y: number; target: number | null }>;
  /** The weapons in the air (SPEC §15). */
  thrown(): Array<{ id: number; weapon: WeaponId; owner: number; dir: number; s: number; x: number; y: number; age: number }>;
  running(): Array<{ caster: number; id: string }>;
  data(id: number): RiderCombat | undefined;
  counts(): { visuals: number; projectiles: number; skills: number; items: number; meshes: number };
}

type WithCombat = DebugApi & { combat?: CombatDebug };

/** Called first in preStep for every rider: apply a test pin. */
export function applyPin(ctx: CombatCtx, r: RiderState): void {
  const pin = ctx.rd(r).pin;
  if (!pin || r.isPlayer) return;
  const p = ctx.session.player;
  r.s = p.s + pin.ds;
  r.x = p.x + pin.dx;
  r.speed = p.speed;
  r.vx = 0;
  const c = ctx.session.controls.get(r.id);
  if (pin.passive && c) c.attackL = c.attackR = c.heavy = c.skill1 = c.skill2 = c.skill3 = c.ult = c.bell = false;
}

export function installCombatDebug(ctx: CombatCtx): () => void {
  const br = window.__br as WithCombat | undefined;
  if (!br) return () => undefined;
  const rider = (id: number): RiderState => {
    const r = ctx.session.rider(id);
    if (!r) throw new Error(`[combat] debug: no rider ${id}`);
    return r;
  };
  const api: CombatDebug = {
    pin: (id, ds, dx, passive = true) => {
      ctx.rd(rider(id)).pin = { ds, dx, passive };
    },
    unpin: (id) => {
      for (const r of ctx.session.riders) if (id === undefined || r.id === id) ctx.rd(r).pin = null;
    },
    give: (id, weapon, uses) => equip(ctx, rider(id), weapon, uses),
    set: (id, f) => Object.assign(rider(id), f),
    status: (id, status, time, strength = 1) => {
      addStatus(rider(id), status, time, strength, null, true);
    },
    cast: (id, slot) => ctx.skills.queue(rider(id), slot),
    swing: (id, side, heavy = false) => {
      const r = rider(id);
      if (r.action || !r.mods.canAttack || r.mode !== 'racing') return false;
      startSwing(ctx, r, heavy, side);
      return true;
    },
    resetCooldowns: (id) => {
      for (const r of ctx.session.riders) {
        if (id !== undefined && r.id !== id) continue;
        r.cooldowns.fill(0);
        const d = ctx.rd(r);
        d.bellCd = 0;
        d.bellPaid.fill(-Infinity);
        d.hitPaid.fill(-Infinity);
        d.spSpentAt = -Infinity;
      }
    },
    force: (rolls) => {
      for (const k of Object.keys(ctx.force) as Array<keyof ForcedRolls>) delete ctx.force[k];
      if (rolls) Object.assign(ctx.force, rolls);
    },
    spawn: (kind, s, x, weapon) => ctx.pickups.spawn(kind, s, x, weapon).id,
    clearItems: () => ctx.pickups.clear(),
    items: (near) => ctx.pickups.items
      .filter((it) => near === undefined || Math.abs(it.s - ctx.session.player.s) < near)
      .map((it) => ({ id: it.id, kind: it.kind, s: it.s, x: it.x, y: it.y, alive: it.alive, weapon: it.weapon })),
    projectiles: () => ctx.projectiles.list.map((p) => ({ id: p.id, skillId: p.skillId, s: p.s, x: p.x, y: p.y, target: p.target?.id ?? null })),
    thrown: () => ctx.thrown.list.map((p) => ({ id: p.id, weapon: p.weapon, owner: p.owner.id, dir: p.dir, s: p.s, x: p.x, y: p.y, age: p.age })),
    running: () => ctx.skills.list(),
    data: (id) => ctx.data[id],
    counts: () => {
      let meshes = 0;
      ctx.root.traverse(() => meshes++);
      return { visuals: ctx.visuals.count, projectiles: ctx.projectiles.list.length, skills: ctx.skills.count, items: ctx.pickups.items.length, meshes };
    },
  };
  br.combat = api;
  return () => {
    if (br.combat === api) delete br.combat;
  };
}
