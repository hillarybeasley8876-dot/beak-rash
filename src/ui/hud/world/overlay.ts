// World-anchored layer: owns the projector and the tag / bubble / damage / edge modules, and turns
// bus events into overlay spawns. Pure presentation: reads session state, never writes it.
import '../css/world.css';
import { SKILLS } from '../../../data/skills';
import type { AppContext, Session } from '../../../core/contracts';
import type { GameEvents } from '../../../core/events-map';
import { el } from '../dom';
import { Bubbles } from './bubbles';
import { DamageNumbers } from './damage';
import { EdgeWarnings } from './edges';
import type { Projector } from './project';
import { NameTags } from './tags';

const WARN_RANGE = 30;

export class WorldOverlay {
  readonly root: HTMLDivElement;
  private tags: NameTags;
  private bubbles: Bubbles;
  private damage: DamageNumbers;
  readonly edges: EdgeWarnings;
  private session: Session | null = null;

  constructor(private app: AppContext, private proj: Projector, parent: HTMLElement, edgesParent: HTMLElement) {
    this.root = el('div', 'brh-world', parent);
    this.tags = new NameTags(this.root);
    this.damage = new DamageNumbers(this.root);
    this.bubbles = new Bubbles(this.root);
    this.edges = new EdgeWarnings(edgesParent);
  }

  attach(session: Session | null): void {
    this.session = session;
    this.bubbles.clear();
    this.damage.clear();
    this.edges.clear();
    const riders = session?.riders ?? [];
    this.tags.setRiders(riders);
    this.edges.setRiders(riders);
  }

  onTaunt(e: GameEvents['taunt']): void {
    if (this.session) this.bubbles.show(this.session, e.riderId, e.text);
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
    this.edges.skillWarn(r.id, SKILLS[e.skillId]?.glyph ?? '!');
  }

  /** Call after proj.begin() for this frame. */
  update(dt: number, k: number): void {
    const s = this.session;
    if (!s) return;
    const { width, height } = this.app.size;
    this.tags.update(s, this.proj, k, dt);
    this.bubbles.update(s, this.proj, k, dt);
    this.damage.update(this.proj, k, dt);
    this.edges.update(s, width, height, k, dt);
  }
}
