// World-anchored layer: owns the projector and the tag / bubble / damage / edge modules, and turns
// bus events into overlay spawns. Pure presentation: reads session state, never writes it.
import '../css/world.css';
import { SKILLS } from '../../../data/skills';
import type { Session } from '../../../core/contracts';
import type { GameEvents } from '../../../core/events-map';
import { el } from '../dom';
import { Bubbles } from './bubbles';
import { DamageNumbers } from './damage';
import { EdgeWarnings } from './edges';
import { IncomingWarning } from './incoming';
import type { Projector } from './project';
import { NameTags } from './tags';

const WARN_RANGE = 30;

export class WorldOverlay {
  readonly root: HTMLDivElement;
  private tags: NameTags;
  private bubbles: Bubbles;
  private damage: DamageNumbers;
  readonly edges: EdgeWarnings;
  readonly incoming: IncomingWarning;
  private session: Session | null = null;

  constructor(private proj: Projector, parent: HTMLElement, edgesParent: HTMLElement) {
    this.root = el('div', 'brh-world', parent);
    this.tags = new NameTags(this.root);
    this.damage = new DamageNumbers(this.root);
    this.bubbles = new Bubbles(this.root);
    this.edges = new EdgeWarnings(edgesParent);
    this.incoming = new IncomingWarning(edgesParent);
  }

  attach(session: Session | null): void {
    this.session = session;
    this.bubbles.clear();
    this.damage.clear();
    this.edges.clear();
    this.incoming.clear();
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

  /** Call after proj.begin() for this frame. */
  update(dt: number, k: number): void {
    const s = this.session;
    if (!s) return;
    this.tags.update(s, this.proj, k, dt);
    this.bubbles.update(s, this.proj, k, dt, this.tags.boxes());
    this.damage.update(this.proj, k, dt);
    this.edges.update(s, this.proj, k, dt);
    this.incoming.update(s, this.proj, k, dt);
  }
}
