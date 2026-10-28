// Bus → audio, part 2: melee (swings, per-weapon hits, crits, blocks), KOs, combos, weapons,
// skills (cast / hit / end per id), SHOWTIME, pickups, rival taunts and the pelican's own lines.
import { SFX } from './sfx/bank';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/events-map';
import type { Host } from './host';

/** Skill sound id for an event suffix ('' = cast, '.hit', '.end'), falling back to generic sounds. */
function skillSfx(skillId: string, suffix: '' | '.hit' | '.end'): string | null {
  const id = `skill.${skillId}${suffix}`;
  if (id in SFX) return id;
  if (suffix === '') return 'skill.cast';
  if (suffix === '.hit') return 'skill.hit';
  return null;
}

/** The hit of a weapon (a weapon without its own sound yet gets the unarmed one). */
export function hitSfx(weapon: string): string {
  const id = `hit.${weapon}`;
  return id in SFX ? id : 'hit.none';
}

/** The cast sound of an ult: its own (a shared ult has one too), the pelican's SHOWTIME as the fallback. */
function ultCastSfx(skillId: string): string {
  const id = `skill.${skillId}`;
  return id in SFX ? id : 'skill.pelican.ult';
}

/** The impact sound of an ult: its own impact, its own hit, or the pelican's SHOWTIME impact. */
function ultImpactSfx(skillId: string): string {
  for (const id of [`skill.${skillId}.impact`, `skill.${skillId}.hit`, 'skill.pelican.ult.impact']) {
    if (id in SFX) return id;
  }
  return 'skill.pelican.ult.impact';
}

/** Skills that hit a whole pack at once: their hit sound does not machine-gun (s between hits). */
const HIT_GAP: Record<string, number> = {
  'pool.ducks': 0.2, 'pool.firecracker': 0.2, 'pool.boomerang': 0.12, 'pool.watergun': 0.12,
  'pool.firebreath': 0.1, 'pool.tornado': 0.12, 'pool.snowball': 0.12, 'pool.rocket': 0.12,
  'pool.bubble': 0.12, 'pool.pie': 0.12, 'pool.popup': 0.12, 'pool.warsong': 0.12,
  'moodeng.bounce': 0.12, 'pedro.trash': 0.12, 'ult.meteor': 0.12, 'ult.storm': 0.12,
};

function pickupSfx(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes('fish') && !k.includes('can')) return 'pickup.fish';
  if (k.includes('crate') || k.includes('weapon')) return 'pickup.crate';
  if (k.includes('can') || k.includes('sp') || k.includes('energy')) return 'pickup.can';
  return 'pickup.coin';
}

/** s a KO line may wait for the bark channel after the cinematic. */
const HELD_WAIT = 1.2;

export function wireCombat(bus: EventBus<GameEvents>, h: Host): void {
  const isPlayer = (id: number | null): boolean => h.isPlayer(id);
  let lastCine = -Infinity;
  /** Lines from a KO the cinematic is showing: they wait for its end (the announcer has the peak),
   *  then for the bark channel (a short cinematic ends before the announcer's line), up to HELD_WAIT. */
  let heldBarks: Array<() => void> = [];
  const releaseBarks = (): void => {
    for (const bark of heldBarks.splice(0)) bark();
  };
  bus.on('combat:swing', ({ riderId, side, heavy }) => {
    h.play(heavy ? 'swing.heavy' : 'swing.light', riderId, { pan: isPlayer(riderId) ? side * 0.3 : 0 });
  });
  bus.on('combat:hit', (e) => {
    const opts = { volume: e.heavy ? 1.15 : 1, pitch: e.heavy ? 0.9 : 1 };
    if (e.blocked) h.play('hit.block', e.pos, opts);
    else if (e.skillId) h.play(skillSfx(e.skillId, '.hit') ?? 'skill.hit', e.pos, opts);
    else h.play(hitSfx(e.weapon), e.pos, opts);
    if (e.crit && !e.blocked) h.play('hit.crit', e.pos);
  });
  bus.on('combat:ko', ({ attacker, victim, pos }) => {
    const mine = isPlayer(attacker) || isPlayer(victim);
    // The KO boom owns the low end (a second boom within 0.4 s, e.g. a chain, loses its sub); the
    // player's KOs are cinematic: full-size and centred wherever the victim is.
    h.boom('ko.boom', mine ? null : pos, { volume: mine ? 1 : 0.8 });
    const barks: Array<() => void> = [];
    // At most one line every 6 s is the pelican's own (its KO quip or its groan); it goes first,
    // and the bark gap then drops the rival's line.
    if (mine && h.cooldown('pelicanLine', 6)) {
      const won = attacker !== null && isPlayer(attacker);
      barks.push(() => h.bark(won ? attacker : victim, won ? 'ko' : 'hurt', undefined, HELD_WAIT));
    }
    if (attacker !== null && !isPlayer(attacker)) barks.push(() => h.bark(attacker, 'ko', undefined, HELD_WAIT));
    if (!isPlayer(victim)) barks.push(() => h.bark(victim, 'hurt', undefined, HELD_WAIT));
    if (!mine) {
      for (const bark of barks) bark();
      return;
    }
    // The player's KO: fx's director runs the cinematic (stinger, announcer at the peak); the
    // characters' lines wait for its end.
    heldBarks.push(...barks);
    const at = performance.now();
    const session = h.session();
    // fx may emit cine:ko synchronously from its own combat:ko handler, i.e. just before `at`.
    setTimeout(() => {
      if (lastCine >= at - 100 || h.session() !== session || session === null) return;
      if (isPlayer(attacker)) {
        h.stinger('ko');
        h.announce('ann_ko', 3);
      }
      releaseBarks();
    }, 350);
  });
  bus.on('cine:ko', ({ phase }) => {
    if (phase === 'start') lastCine = performance.now();
    else if (phase === 'end') releaseBarks();
  });
  bus.on('combat:combo', ({ riderId, count }) => {
    if (!isPlayer(riderId) || count !== 3) return;
    h.stinger('onemore');
    h.announce('ann_onemore', 1);
  });
  bus.on('combat:weaponDrop', ({ pos }) => h.play('weapon.drop', pos));
  bus.on('combat:weaponBreak', ({ pos }) => h.play('weapon.break', pos));
  bus.on('combat:bell', ({ riderId, angered }) => {
    if (h.cooldown(`bell${riderId}`, 0.6)) h.play('bike.bell', riderId);
    // A bell that riled someone up: the pelican's taunt right after it (rate-limited).
    if (isPlayer(riderId) && angered.length > 0 && h.cooldown('pelicanTaunt', 8)) setTimeout(() => h.bark(riderId, 'taunt'), 350);
  });
  bus.on('projectile:spawn', ({ target, pos }) => {
    // Something is homing in on the player: a short two-tone warning from where it was fired.
    if (isPlayer(target) && h.cooldown('incoming', 0.8)) h.play('ui.incoming', pos);
  });
  bus.on('projectile:end', ({ hit, pos }) => {
    if (hit === null) h.play('projectile.miss', pos);
  });
  bus.on('combat:weaponPick', ({ riderId }) => h.play('weapon.pick', riderId));
  bus.on('skill:cast', ({ riderId, skillId }) => {
    const id = skillSfx(skillId, '');
    if (id) h.play(id, riderId);
    if (isPlayer(riderId)) h.play('ui.cutin', null, { volume: 0.8 });
  });
  bus.on('skill:hit', ({ skillId, pos }) => {
    const gap = HIT_GAP[skillId];
    if (gap !== undefined && !h.cooldown(`hit${skillId}`, gap)) return;
    h.play(skillSfx(skillId, '.hit') ?? 'skill.hit', pos);
  });
  bus.on('skill:end', ({ riderId, skillId }) => {
    const id = skillSfx(skillId, '.end');
    if (id) h.play(id, riderId);
  });
  bus.on('skill:denied', ({ riderId }) => {
    if (isPlayer(riderId) && h.cooldown('deny', 0.3)) h.play('ui.deny');
  });
  bus.on('ult:start', ({ riderId, skillId }) => {
    if (!isPlayer(riderId)) return;
    // the ult's own sound (a shared ult has one), never the pelican's SHOWTIME whoosh
    h.play(ultCastSfx(skillId), riderId);
    h.play('ui.cutin');
    h.stinger('showtime');
    h.announce('ann_showtime', 3);
  });
  bus.on('ult:impact', ({ skillId, pos }) => h.boom(ultImpactSfx(skillId), pos, { volume: 1.1 }));
  bus.on('pickup:take', ({ riderId, kind, pos }) => {
    h.play(pickupSfx(kind), isPlayer(riderId) ? riderId : pos, { volume: isPlayer(riderId) ? 1 : 0.5 });
  });
  bus.on('taunt', ({ riderId, text }) => h.bark(riderId, 'taunt', text));
}
