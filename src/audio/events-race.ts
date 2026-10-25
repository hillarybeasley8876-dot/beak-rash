// Bus → audio, part 1: race lifecycle (count-in + GO on the downbeat, places, final stretch,
// finish), riding (hops, landings, drift, boosts, crashes, walls), police, traffic and the KO /
// SHOWTIME cinematics. Gameplay code never needs to call sfx() itself. Screen music is the UI's
// call (AudioSystem.music).
import { hitSfx } from './events-combat';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/events-map';
import type { Host } from './host';

const OBSTACLE_SFX: Record<string, string> = {
  cone: 'obstacle.cone', crate: 'obstacle.crate', barrel: 'obstacle.barrel',
  car: 'obstacle.car', van: 'obstacle.car', truck: 'obstacle.car', bus: 'obstacle.car', police: 'obstacle.car',
  wall: 'bike.wall', wallScrape: 'bike.scrape',
};
const HORNS: Record<string, string> = {
  car: 'traffic.horn.car', van: 'traffic.horn.van', truck: 'traffic.horn.truck', bus: 'traffic.horn.bus', police: 'traffic.horn.police',
};
const BOOST_SFX: Record<string, string> = { drift: 'bike.miniturbo', pad: 'bike.pad', draft: 'bike.slingshot' };
const COUNT_LINES: Record<number, string> = { 3: 'ann_3', 2: 'ann_2', 1: 'ann_1', 0: 'ann_go' };
/** Rival boosts: only this close (m, track distance), this often (s) per rider, this loud. */
const RIVAL_BOOST = { range: 12, every: 3, volume: 0.5 };
/** The KO impact owns the sub while a cinematic runs: other crashes lose their low end. */
const CINE_HIGHPASS = 180;
/** Rate limits (s) of the corgi's whistle, knocks and let-go toot. */
const POLICE_GAP = { whistle: 0.8, knock: 0.25, horn: 1.5 };

export function wireRace(bus: EventBus<GameEvents>, h: Host): void {
  const isPlayer = (id: number): boolean => h.isPlayer(id);
  let inCine = false;
  let goMs = -Infinity;
  const near = (id: number, range: number): boolean => {
    const s = h.session();
    const r = s?.rider(id);
    return !!s && !!r && Math.abs(r.s - s.player.s) <= range;
  };
  bus.on('race:intro', ({ trackId }) => h.song(`race-${trackId}`, 1.2));
  bus.on('race:countdown', ({ n }) => {
    if (n === 0) goMs = performance.now();
    h.countdown(n);
    const line = COUNT_LINES[n];
    if (line) h.announce(line, 3);
  });
  bus.on('race:placeChange', ({ riderId, from, to }) => {
    if (isPlayer(riderId) && to === 1 && from > 1 && h.cooldown('lead', 8)) h.announce('ann_lead', 1);
  });
  bus.on('race:finalStretch', ({ riderId }) => {
    if (isPlayer(riderId)) h.announce('ann_final', 2);
  });
  bus.on('race:finishLine', ({ riderId, place }) => {
    if (!isPlayer(riderId)) return;
    h.stinger(place <= 3 ? 'finish' : 'finishLow');
    h.announce(place <= 3 ? `ann_place${place}` : 'ann_finish', 3);
  });
  bus.on('rider:bump', ({ a, b, strength, pos }) => {
    if (h.cooldown(`bump${Math.min(a, b)}-${Math.max(a, b)}`, 0.25)) h.play('bike.bump', pos, { volume: Math.min(1, 0.35 + strength * 0.15) });
  });
  bus.on('rider:crash', ({ riderId, cause, pos }) => {
    // A KO crash is covered by the KO boom: no second sub hit.
    h.play(cause === 'water' ? 'bike.splash' : 'bike.crash', pos, inCine || cause === 'ko' ? { highpass: CINE_HIGHPASS } : {});
    if (isPlayer(riderId) && cause !== 'ko' && cause !== 'skill') h.announce('ann_wrecked', 2);
  });
  bus.on('rider:respawn', ({ riderId }) => {
    if (isPlayer(riderId)) h.play('bike.respawn', riderId);
  });
  bus.on('rider:hop', ({ riderId }) => h.play('bike.hop', riderId));
  bus.on('rider:land', ({ riderId, airTime, perfect }) => {
    h.play(airTime > 0.9 ? 'bike.land.hard' : 'bike.land', riderId, { volume: Math.min(1, 0.5 + airTime * 0.5) });
    if (!perfect || !isPlayer(riderId)) return;
    h.play('bike.perfect', riderId);
    if (h.cooldown('perfect', 5)) h.announce('ann_perfect', 1);
  });
  bus.on('rider:drift', ({ riderId, phase, level }) => {
    if (!isPlayer(riderId)) return;
    if (phase === 'start') h.play('bike.drift.start', riderId);
    else if (phase === 'level') h.play('bike.drift.level', riderId, { pitch: 1 + 0.26 * Math.max(0, level - 1) });
  });
  bus.on('rider:boost', ({ riderId, kind }) => {
    if (kind === 'skill') return;
    // Reward cues are the player's; the GO launch is one sound, not eight.
    if (isPlayer(riderId)) h.play(BOOST_SFX[kind] ?? 'bike.boost', riderId);
    else if (performance.now() - goMs > 600 && near(riderId, RIVAL_BOOST.range) && h.cooldown(`boost${riderId}`, RIVAL_BOOST.every)) {
      h.play('bike.passby', riderId, { volume: RIVAL_BOOST.volume, lowpass: 2600 });
    }
  });
  bus.on('rider:nearMiss', ({ riderId, kind }) => {
    if (!isPlayer(riderId)) return;
    h.play(kind === 'traffic' ? 'traffic.whoosh' : 'bike.nearmiss', riderId);
    if (h.cooldown('nearmiss', 9)) h.announce('ann_nearmiss', 0);
  });
  bus.on('rider:obstacleHit', ({ riderId, kind, speed, pos }) => {
    if (kind === 'wallScrape' && !h.cooldown(`scrape${riderId}`, 0.3)) return;
    h.play(OBSTACLE_SFX[kind] ?? 'obstacle.hit', pos, { volume: Math.min(1, 0.4 + speed / 20) });
  });
  bus.on('police:alert', ({ reason }) => {
    if (reason === 'lost') h.play('police.lost');
  });
  bus.on('police:busted', ({ riderId }) => {
    if (!isPlayer(riderId)) return;
    h.play('police.busted');
    h.stinger('busted');
    h.announce('ann_busted', 3);
  });
  // The corgi's own sounds, placed where it rides (race emits them; nothing calls sfx() for them).
  bus.on('police:whistle', ({ pos }) => {
    if (h.cooldown('policeWhistle', POLICE_GAP.whistle)) h.play('police.whistle', pos);
  });
  bus.on('police:knock', ({ weapon, pos }) => {
    if (!h.cooldown('policeKnock', POLICE_GAP.knock)) return;
    h.play(hitSfx(weapon), pos);
    // Unarmed (a shove or the Wing Dash ram): the thump plus the corgi's bike clattering back.
    if (weapon === 'none') h.play('bike.bump', pos, { volume: 0.7 });
  });
  bus.on('police:horn', ({ pos }) => {
    if (h.cooldown('policeHorn', POLICE_GAP.horn)) h.play('traffic.horn.police', pos);
  });
  bus.on('traffic:honk', ({ obstacleId, pos }) => {
    const kind = h.session()?.obstacles.find((o) => o.id === obstacleId)?.kind ?? 'car';
    if (h.cooldown(`honk${obstacleId}`, 1.5)) h.play(HORNS[kind] ?? 'traffic.horn.car', pos);
  });
  bus.on('cine:ko', ({ phase, chain, victim }) => {
    const wrecked = isPlayer(victim);
    if (phase === 'start') {
      // The impact must punch through: music −11 dB in 5 ms and its sub gone at once (full drop at the peak).
      inCine = true;
      h.setCine(0.85);
      h.duckMusic(-11, 0.35);
      h.dropBass(0.4, 0.004);
      h.play('cine.impact');
      h.stinger(wrecked ? 'wrecked' : 'ko');
    } else if (phase === 'peak') {
      h.dropBass(1);
      h.play('ui.slash', null, { volume: 0.7 });
      h.announce(wrecked ? 'ann_wrecked' : chain >= 3 ? 'ann_triple' : chain === 2 ? 'ann_double' : 'ann_ko', 3);
    } else {
      inCine = false;
      h.setCine(0);
      h.dropBass(0);
      h.play('cine.whoosh');
    }
  });
  bus.on('cine:ult', ({ phase }) => {
    if (phase === 'start') h.setCine(0.6);
    else if (phase === 'end') {
      h.setCine(0);
      h.play('cine.whoosh');
    }
  });
}
