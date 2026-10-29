// World-anchored layer: owns the projector and the tag / bubble / damage / edge modules, and turns
// bus events into overlay spawns. Pure presentation: reads session state, never writes it.
import '../css/world.css';
import { SKILLS } from '../../../data/skills';
import type { Session } from '../../../core/contracts';
import type { GameEvents } from '../../../core/events-map';
import type { RiderId } from '../../../core/types';
import { el } from '../dom';
import { Bubbles, type BubbleObstacles } from './bubbles';
import { DamageNumbers } from './damage';
import { EdgeWarnings } from './edges';
import { ElementLayer } from './elements';
import { IncomingWarning } from './incoming';
import type { Projector } from './project';
import { GaugeOcclusion } from './occlusion';
import { StatusWords } from './statuswords';
import { NameTags, type TagMark } from './tags';
import { HudZones } from './zones';

const WARN_RANGE = 30;

export class WorldOverlay {
  readonly root: HTMLDivElement;
  private tags: NameTags;
  private bubbles: Bubbles;
  private damage: DamageNumbers;
  /** The element badges over the riders and the reaction callouts (SPEC §24). */
  private elements: ElementLayer;
  /** r7 (SPEC §29): the status word that slams in over a rider the moment a status takes hold. */
  private words: StatusWords;
  readonly edges: EdgeWarnings;
  readonly incoming: IncomingWarning;
  /** Static HUD module rects + the keep-clear area above the vanishing point, for this viewport. */
  readonly zones = new HudZones();
  private occlusion = new GaugeOcclusion();
  /** A rider or a name tag is behind the battle cluster's gauges this frame (the HUD dims them). */
  gaugesCovered = false;
  private session: Session | null = null;

  constructor(private proj: Projector, parent: HTMLElement, edgesParent: HTMLElement) {
    this.root = el('div', 'brh-world', parent);
    this.tags = new NameTags(this.root);
    this.damage = new DamageNumbers(this.root);
    this.elements = new ElementLayer(this.root);
    this.words = new StatusWords(this.root);
    this.bubbles = new Bubbles(this.root);
    this.edges = new EdgeWarnings(edgesParent, this.root);
    this.incoming = new IncomingWarning(edgesParent);
  }

  /** A warning (incoming projectile, rear chevron) holds the bottom band between speedometer and cluster. */
  get bottomBusy(): boolean {
    return this.incoming.up || this.edges.rearUp;
  }

  attach(session: Session | null): void {
    this.session = session;
    this.bubbles.clear();
    this.damage.clear();
    this.edges.clear();
    this.incoming.clear();
    this.elements.attach(session);
    this.words.attach();
    const riders = session?.riders ?? [];
    this.tags.setRiders(riders);
    this.edges.setRiders(riders);
  }

  onProjectile(e: GameEvents['projectile:spawn']): void {
    if (this.session) this.incoming.spawn(this.session, e);
  }

  onTaunt(e: GameEvents['taunt']): void {
    if (this.session) this.bubbles.show(this.session, e.riderId, e.text);
  }

  /** A line from a non-rider riding an obstacle (the police corgi): a bubble that follows that obstacle. */
  onNpcSay(e: GameEvents['npc:say']): void {
    if (this.session) this.bubbles.showNpc(this.session, e.obstacleId, e.character, e.text);
  }

  onHit(e: GameEvents['combat:hit']): void {
    const s = this.session;
    if (!s) return;
    const me = s.player.id;
    this.damage.spawn({
      pos: e.pos, damage: e.damage, crit: e.crit, heavy: e.heavy, blocked: e.blocked,
      hurt: e.victim === me, minor: e.victim !== me && e.attacker !== me,
    });
  }

  onSkillCast(e: GameEvents['skill:cast']): void {
    const s = this.session;
    const r = s?.rider(e.riderId);
    if (!s || !r || r.isPlayer) return;
    if (Math.abs(r.s - s.player.s) > WARN_RANGE) return;
    const glyph = SKILLS[e.skillId]?.glyph ?? '!';
    this.edges.skillWarn(r.id, glyph);
    this.tags.castFlash(r.id, glyph);
  }

  /** police:hurt (SPEC §14): the player hit the corgi — a damage number over it. */
  onPoliceHurt(e: GameEvents['police:hurt']): void {
    this.damage.spawn({
      pos: e.pos, damage: e.damage, crit: false, heavy: false, blocked: false, hurt: false, minor: false,
    });
  }

  /** SPEC §18: mark a rival's name tag (宿敌 / the alliance's chain link). */
  setTagMark(rider: RiderId, kind: TagMark): void {
    this.tags.setMark(rider, kind);
  }

  dispose(): void {
    this.tags.dispose();
    this.elements.dispose();
  }

  /** Layout reads (tag sizes): call at the start of the HUD frame, before any DOM writes. */
  measure(): void {
    this.tags.measure();
  }

  /** Call after proj.begin() for this frame; `dyn` = the quip and chip-column rects (bubbles avoid them). */
  update(dt: number, k: number, dyn: BubbleObstacles): void {
    const s = this.session;
    if (!s) return;
    this.zones.update(this.proj.width, this.proj.height, k);
    this.tags.update(s, this.proj, this.zones, dyn.callouts, k, dt);
    this.elements.update(s, this.proj, k, dt, this.tags.boxes());
    this.edges.update(s, this.proj, this.zones, k, dt);
    this.bubbles.update(s, this.proj, k, dt, [...this.tags.boxes(), ...this.edges.boxes()], this.zones, dyn);
    this.damage.update(this.proj, k, dt);
    this.words.update(s, this.proj, k, dt, this.tags.boxes());
    this.gaugesCovered = this.occlusion.covered(s, this.proj, this.zones.gauges, this.tags.boxes());
    this.incoming.update(s, this.proj, k, dt);
  }

  /** r7 (SPEC §29): what the status layer shows right now — the words over riders and their chips. */
  statusWords(): ReturnType<StatusWords['words']> {
    return this.words.words();
  }

  /** The statuses chipped over each rival's plate. */
  statusChips(): ReturnType<NameTags['chips']> {
    return this.tags.chips();
  }
}
