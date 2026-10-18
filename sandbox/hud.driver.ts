// window.__hud — sandbox driver: pose the player's HUD-relevant state and fire the bus events that
// drive every cut-in, so sandbox/hud.shots.mjs can screenshot each state deterministically.
import { Vector3 } from 'three';
import type { Game } from '../src/core/game';
import type { RiderState, WeaponId } from '../src/core/types';
import { SKILLS } from '../src/data/skills';
import { ROSTER } from '../src/data/roster';

export interface HudDriver {
  pose(name: string): void;
  fire(name: string, opts?: Record<string, number | string | boolean>): void;
  /** Put rival `idx` (1-based rider id) `ds` metres ahead of the player at lateral `x`. */
  place(id: number, ds: number, x: number): void;
  names(): { poses: string[]; cuts: string[] };
  /** Re-attach the HUD: drops every live cut-in/overlay (clean slate between screenshots). */
  reset(): void;
  /** Freeze sim time (HUD keeps animating on real time) — e.g. to hold session.phase = 'intro'. */
  freezeSim(on: boolean): void;
  /** Dispose the HUD; returns how many DOM nodes are left in its layer (expect 0). */
  dispose(): number;
}

export interface HudHooks {
  reattach(): void;
  dispose(): number;
}

declare global {
  interface Window { __hud?: HudDriver }
}

type Pose = (p: RiderState) => void;

const POSES: Record<string, Pose> = {
  cruise: (p) => Object.assign(p, { hp: p.maxHp, sp: 40, cooldowns: [0, 0, 0], drifting: false, driftCharge: 0, boostTime: 0, draft: 0 }),
  drift1: (p) => Object.assign(p, { drifting: true, driftCharge: 0.8 }),
  drift2: (p) => Object.assign(p, { drifting: true, driftCharge: 1.6 }),
  drift3: (p) => Object.assign(p, { drifting: true, driftCharge: 2.4 }),
  boost: (p) => Object.assign(p, { boostTime: 0.9, boostPower: 0.3 }),
  draft: (p) => Object.assign(p, { draft: 0.55 }),
  draftReady: (p) => Object.assign(p, { draft: 0.92 }),
  lowhp: (p) => Object.assign(p, { hp: Math.round(p.maxHp * 0.18) }),
  spfull: (p) => Object.assign(p, { sp: 100 }),
  cooldowns: (p) => Object.assign(p, { cooldowns: [3.4, 7.6, 0.4] }),
  weapon: (p) => Object.assign(p, { weapon: 'saltfish' as WeaponId, weaponUses: 5 }),
  slipper: (p) => Object.assign(p, { weapon: 'slipper' as WeaponId, weaponUses: 1 }),
  /** A weapon whose wear combat never reported: the slot shows '?'. */
  weaponUnknown: (p) => Object.assign(p, { weapon: 'pan' as WeaponId, weaponUses: Infinity }),
  rich: (p) => Object.assign(p, { kos: 3, coins: 420 }),
};

export function installDriver(game: Game, hooks: HudHooks): void {
  const bus = game.app.bus;
  const sess = () => {
    const s = game.session;
    if (!s) throw new Error('[hud-driver] no session');
    return s;
  };
  const nearestRival = (): RiderState => {
    const s = sess();
    const rivals = s.riders.filter((r) => !r.isPlayer);
    rivals.sort((a, b) => Math.abs(a.s - s.player.s) - Math.abs(b.s - s.player.s));
    const r = rivals[0];
    if (!r) throw new Error('[hud-driver] no rivals');
    return r;
  };
  const posOf = (r: RiderState): Vector3 => sess().track.toWorld(r.s, r.x, 1.2, new Vector3());
  const sigOf = (r: RiderState): string =>
    Object.values(SKILLS).find((k) => k.owner === r.character && k.slot === 'sig')?.id ?? ROSTER[r.character].skill;

  const cuts: Record<string, (o: Record<string, number | string | boolean>) => void> = {
    countdown: (o) => bus.emit('race:countdown', { n: Number(o.n ?? 3) }),
    skill: (o) => bus.emit('skill:cast', { riderId: sess().player.id, skillId: String(o.id ?? 'pelican.torpedo'), slot: Number(o.slot ?? 1) }),
    angry: (o) => {
      const s = sess();
      const r = s.rider(Number(o.id ?? 1));
      if (r) r.statuses.push({ id: 'angry', time: 5, strength: 1, source: s.player.id });
    },
    rivalSkill: () => {
      const r = nearestRival();
      bus.emit('skill:cast', { riderId: r.id, skillId: sigOf(r), slot: 1 });
    },
    showtime: () => bus.emit('ult:start', { riderId: sess().player.id, skillId: 'pelican.ult' }),
    koStart: (o) => bus.emit('cine:ko', { phase: 'start', attacker: sess().player.id, victim: nearestRival().id, chain: Number(o.chain ?? 1) }),
    koPeak: (o) => bus.emit('cine:ko', { phase: 'peak', attacker: sess().player.id, victim: nearestRival().id, chain: Number(o.chain ?? 1) }),
    koEnd: (o) => bus.emit('cine:ko', { phase: 'end', attacker: sess().player.id, victim: nearestRival().id, chain: Number(o.chain ?? 1) }),
    wreckedPeak: () => bus.emit('cine:ko', { phase: 'peak', attacker: nearestRival().id, victim: sess().player.id, chain: 1 }),
    crash: (o) => {
      const p = sess().player;
      bus.emit('rider:crash', { riderId: p.id, cause: (String(o.cause ?? 'traffic')) as 'traffic', speed: p.speed, pos: posOf(p), attacker: null });
    },
    busted: () => bus.emit('police:busted', { riderId: sess().player.id, fine: 100 }),
    police: (o) => bus.emit('police:alert', { riderId: sess().player.id, level: Number(o.level ?? 2) }),
    finish: (o) => bus.emit('race:finishLine', { riderId: sess().player.id, place: Number(o.place ?? 1), time: Number(o.time ?? 154.32) }),
    perfect: () => bus.emit('rider:land', { riderId: sess().player.id, airTime: 0.9, perfect: true }),
    drift: (o) => bus.emit('rider:drift', { riderId: sess().player.id, phase: 'level', level: Number(o.level ?? 1) }),
    driftEnd: () => bus.emit('rider:drift', { riderId: sess().player.id, phase: 'end', level: 0 }),
    nearMiss: () => bus.emit('rider:nearMiss', { riderId: sess().player.id, kind: 'traffic' }),
    slingshot: () => bus.emit('rider:boost', { riderId: sess().player.id, kind: 'draft', power: 0.15, time: 0.8 }),
    launch: (o) => bus.emit('rider:boost', { riderId: sess().player.id, kind: 'launch', power: Number(o.power ?? 0.3), time: 1.1 }),
    combo: (o) => bus.emit('combat:combo', { riderId: sess().player.id, count: Number(o.count ?? 3) }),
    placeChange: (o) => bus.emit('race:placeChange', { riderId: sess().player.id, from: Number(o.from ?? 4), to: Number(o.to ?? 3) }),
    finalStretch: () => bus.emit('race:finalStretch', { riderId: sess().player.id }),
    achievement: (o) => bus.emit('achievement:unlock', { id: String(o.id ?? 'first_ko') }),
    taunt: (o) => {
      const r = o.id !== undefined ? sess().rider(Number(o.id)) ?? nearestRival() : nearestRival();
      bus.emit('taunt', { riderId: r.id, text: String(o.text ?? ROSTER[r.character].taunts[0] ?? '…'), character: r.character });
    },
    hit: (o) => {
      const s = sess();
      const victim = o.me ? s.player : nearestRival();
      const attacker = o.me ? nearestRival() : s.player;
      bus.emit('combat:hit', {
        attacker: attacker.id, victim: victim.id, damage: Number(o.dmg ?? 12), side: 1, weapon: attacker.weapon,
        heavy: Boolean(o.heavy), crit: Boolean(o.crit), blocked: Boolean(o.blocked), pos: posOf(victim), skillId: null,
      });
    },
    incoming: (o) => {
      const s = sess();
      const r = o.owner !== undefined ? s.rider(Number(o.owner)) ?? nearestRival() : nearestRival();
      bus.emit('projectile:spawn', { id: Number(o.id ?? 1), owner: r.id, target: s.player.id, kind: String(o.kind ?? 'pelican.torpedo'), pos: posOf(r) });
    },
    projEnd: (o) => bus.emit('projectile:end', { id: Number(o.id ?? 1), hit: null, pos: posOf(sess().player) }),
    denied: (o) => bus.emit('skill:denied', { riderId: sess().player.id, slot: Number(o.slot ?? 1), reason: (String(o.reason ?? 'cooldown')) as 'cooldown' }),
    pick: (o) => {
      // Like combat's equip(): the weapon arrives with its remaining uses, then the pick event fires.
      const p = sess().player;
      const weapon = String(o.weapon ?? 'saltfish') as WeaponId;
      Object.assign(p, { weapon, weaponUses: Number(o.uses ?? 3) });
      bus.emit('combat:weaponPick', { riderId: p.id, weapon, stolenFrom: null });
    },
  };

  window.__hud = {
    pose(name) {
      const fn = POSES[name];
      if (!fn) throw new Error(`[hud-driver] unknown pose ${name}`);
      fn(sess().player);
    },
    fire(name, opts = {}) {
      const fn = cuts[name];
      if (!fn) throw new Error(`[hud-driver] unknown cut ${name}`);
      fn(opts);
    },
    place(id, ds, x) {
      const s = sess();
      const r = s.rider(id);
      if (!r) return;
      r.s = s.player.s + ds;
      r.x = x;
    },
    names: () => ({ poses: Object.keys(POSES), cuts: Object.keys(cuts) }),
    reset: hooks.reattach,
    dispose: hooks.dispose,
    freezeSim(on) {
      game.app.clock.setScale('hud-sandbox', on ? 0 : 1);
    },
  };
}
