// Riding event reactions: crashes, landings, hops, drift levels, boosts, bumps, near misses,
// off-road puffs, obstacle hits, respawns, finish confetti, busted.
import { clamp } from '../../core/math';
import { DRIFT_COLORS } from '../presets/speed';
import { bodyBits } from './species';
import type { RiderId } from '../../core/types';
import type { FxContext } from '../context';

const SURFACE_PUFF: Record<string, string> = { grass: 'grass', sand: 'sand', dirt: 'dirt', water: 'splash', curb: 'dust' };
const BOOST_COLOR: Record<string, string> = { pad: '#2ad1ff', land: '#ffe600', draft: '#ffffff', skill: '#ff1e3c', pickup: '#ffe600' };
const OBSTACLE_PUFF: Record<string, string> = { oil: 'oil', puddle: 'splash', cone: 'poof', crate: 'crate', barrel: 'debris' };

export function subscribeRide(ctx: FxContext): Array<() => void> {
  const { bus } = ctx.app;
  const isPlayer = (id: RiderId | null): boolean => id !== null && ctx.session()?.player.id === id;
  const rider = (id: RiderId) => ctx.session()?.rider(id);

  return [
    bus.on('rider:crash', (e) => {
      const t = ctx.tracker.get(e.riderId);
      const r = rider(e.riderId);
      if (isPlayer(e.riderId)) { ctx.post.hurt(0.9); ctx.post.punch(0.01); }
      if (e.cause === 'ko' || !r) return; // combat:ko already burst
      const o = { vel: t?.vel, ground: t?.ground };
      const at = t?.body ?? e.pos;
      if (e.cause === 'water') { ctx.burst('splash', e.pos, { ...o, scale: 1.4 }); return; }
      const bits = bodyBits(r.character);
      ctx.burst(bits.kind, at, { ...o, count: 6, color: bits.color, color2: bits.color2 });
      ctx.burst('debris', at, o);
      ctx.burst('smoke', e.pos, { ...o, count: 3 });
      if (e.cause !== 'police') ctx.burst('sparks', e.pos, o);
    }),
    bus.on('rider:land', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (!t) return;
      ctx.burst('landing', t.pos, { vel: t.vel, ground: t.ground, scale: clamp(0.55 + e.airTime * 0.9, 0.55, 1.6) });
      if (e.perfect) ctx.burst('sparkle', t.body, { vel: t.vel, color: '#ffe600' });
    }),
    bus.on('rider:hop', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t) ctx.burst('hopDust', t.pos, { vel: t.vel, ground: t.ground });
    }),
    bus.on('rider:drift', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t && e.phase === 'level') ctx.burst('driftPop', t.wheelR, { vel: t.vel, level: e.level, dir: t.fwd.clone().negate() });
    }),
    bus.on('rider:boost', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (!t) return;
      const level = clamp(Math.round(e.power / 0.1) - 1, 1, 3);
      const color = e.kind === 'drift' ? DRIFT_COLORS[level]?.[1] : BOOST_COLOR[e.kind];
      ctx.burst('boost', t.body, { vel: t.vel, dir: t.fwd, color });
      if (isPlayer(e.riderId)) ctx.post.punch(0.008);
    }),
    bus.on('rider:bump', (e) => {
      const t = ctx.tracker.get(e.a);
      ctx.burst(e.strength > 3 ? 'hit' : 'sparks', e.pos, { vel: t?.vel, scale: 0.6, count: e.strength > 3 ? undefined : 5 });
    }),
    bus.on('rider:nearMiss', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t && isPlayer(e.riderId)) ctx.burst('streaks', t.pos, { dir: t.fwd, count: 10 });
    }),
    bus.on('rider:offroad', (e) => {
      const t = ctx.tracker.get(e.riderId);
      const puff = SURFACE_PUFF[e.surface];
      if (t && puff) ctx.burst(puff, t.wheelR, { vel: t.vel, ground: t.ground, dir: t.fwd.clone().negate() });
    }),
    bus.on('rider:obstacleHit', (e) => {
      const t = ctx.tracker.get(e.riderId);
      const o = { vel: t?.vel, ground: t?.ground };
      const extra = OBSTACLE_PUFF[e.kind];
      if (extra) ctx.burst(extra, e.pos, o);
      if (!extra || e.kind === 'barrel') ctx.burst('sparks', e.pos, o);
    }),
    bus.on('rider:respawn', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t) ctx.burst('sparkle', t.body, { vel: t.vel, color: '#ffffff', scale: 1.3 });
    }),
    bus.on('race:finishLine', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (!t || !isPlayer(e.riderId)) return;
      ctx.burst('confetti', t.head, { vel: t.vel });
      ctx.burst('confetti', t.head, { vel: t.vel, color: e.place === 1 ? '#ffe600' : '#e5191c', dir: t.fwd });
    }),
    bus.on('police:busted', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (t) ctx.burst('poof', t.body, { vel: t.vel, scale: 1.4 });
    }),
  ];
}
