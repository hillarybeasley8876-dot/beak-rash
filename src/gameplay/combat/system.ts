// createCombat(session): statuses → mods, melee, skills, projectiles, pickups, bell, SP and the KO pipeline,
// stepped in the session order (preStep before physics, postStep after it).
import type { CombatSystem, Session } from '../../core/contracts';
import type { RiderState } from '../../core/types';
import { armRivals } from './armory';
import { requestBell } from './bell';
import { active, CombatCtx } from './ctx';
import { applyPin, installCombatDebug } from './debug';
import { listenExternal } from './external';
import { flushImpacts } from './feedback';
import { tickElements } from './elements';
import { checkKos, listenKo } from './ko';
import { PropLibrary } from './meshes/library';
import { requestSwing, resolveSwings, runBuffered, tickAction } from './melee';
import { PickupSystem } from './pickups/pickups';
import { ProjectileSystem } from './projectiles/projectiles';
import { ThrownWeaponSystem } from './projectiles/thrown';
import { listenRewards } from './rewards';
import { SkillRunner } from './skills/runner';
import { listenSp, tickSp } from './sp';
import { applyMods, tickStatuses } from './statuses';
import { tickThrow } from './throw';
import { VisualSystem } from './visuals/visuals';

function tickTimers(ctx: CombatCtx, r: RiderState, dt: number): void {
  for (let i = 0; i < r.cooldowns.length; i++) r.cooldowns[i] = Math.max(0, (r.cooldowns[i] ?? 0) - dt);
  const d = ctx.rd(r);
  d.bellCd = Math.max(0, d.bellCd - dt);
  if (r.comboTimer > 0) {
    r.comboTimer = Math.max(0, r.comboTimer - dt);
    if (r.comboTimer === 0) r.combo = 0;
  }
  tickSp(r, dt);
}

/** A wreck stops whatever the rider was doing (skills, swing, buffs/debuffs except 'angry'). */
function onCrash(ctx: CombatCtx, r: RiderState): void {
  ctx.skills.interrupt(r);
  r.action = null;
  ctx.rd(r).aim = null;
  ctx.rd(r).buffered = null;
  ctx.rd(r).skillBuf.length = 0;
  ctx.rd(r).bellBuf = null;
  r.combo = 0;
  r.comboTimer = 0;
  for (let i = r.statuses.length - 1; i >= 0; i--) if (r.statuses[i]?.id !== 'angry') r.statuses.splice(i, 1);
  applyMods(r);
}

export function createCombat(session: Session): CombatSystem {
  const ctx = new CombatCtx(session, session.rng.fork(0xc0b4));
  ctx.lib = new PropLibrary();
  ctx.lib.prebuild();
  ctx.visuals = new VisualSystem(ctx);
  ctx.skills = new SkillRunner(ctx);
  ctx.projectiles = new ProjectileSystem(ctx);
  ctx.thrown = new ThrownWeaponSystem(ctx);
  ctx.pickups = new PickupSystem(ctx, ctx.lib);
  armRivals(ctx);
  const offs = [listenSp(ctx), listenKo(ctx, (r) => onCrash(ctx, r)), installCombatDebug(ctx), listenExternal(ctx), listenRewards(ctx)];
  let disposed = false;
  let visualDt = 0; // sim seconds stepped since the last rendered frame (visuals live in sim time)

  return {
    preStep(dt) {
      if (disposed) return;
      ctx.time += dt;
      for (const r of session.riders) {
        applyPin(ctx, r);
        tickStatuses(r, dt);
        tickTimers(ctx, r, dt);
        tickAction(ctx, r, dt);
        tickThrow(ctx, r, dt);
        const c = session.controls.get(r.id);
        if (ctx.racing && active(r) && c) {
          requestBell(ctx, r, c.bell, dt);
          ctx.skills.request(r, c, dt);
          requestSwing(ctx, r, c);
          runBuffered(ctx, r);
        }
        applyMods(r);
      }
      if (ctx.racing) tickElements(ctx, dt);
      ctx.skills.pre(dt);
      flushImpacts(ctx);
    },
    postStep(dt) {
      if (disposed) return;
      resolveSwings(ctx);
      ctx.skills.post(dt);
      ctx.projectiles.update(dt);
      ctx.thrown.update(dt);
      ctx.pickups.update(dt, ctx.racing);
      visualDt += dt;
      checkKos(ctx);
      ctx.skills.updateUltTargets();
      flushImpacts(ctx);
    },
    /** Render-only work, once per rendered frame on final poses (update(0) re-faces ribbons in hit-stop). */
    frame() {
      if (disposed) return;
      ctx.visuals.update(visualDt);
      visualDt = 0;
      ctx.pickups.sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const off of offs) off();
      ctx.skills.dispose();
      ctx.projectiles.dispose();
      ctx.thrown.dispose();
      ctx.visuals.dispose();
      ctx.pickups.dispose();
      ctx.lib.dispose();
      ctx.root.removeFromParent();
    },
  };
}
