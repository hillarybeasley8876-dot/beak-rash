// The props the easter eggs put into the race world (SPEC §21): the rubber duck, the SVG easel and the cloud
// pelican god. This file owns their placement, their look and their removal; the rules live in runner.ts.
import { Group, Vector3, type CanvasTexture, type MeshBasicMaterial } from 'three';
import type { Session } from '../../core/contracts';
import type { Obstacle } from '../../core/types';
import { buildDuck, buildEasel, buildGod } from './mesh';
import { duckSpot, easelSpot, yawToRoad, type Spot } from './placement';
import { EASEL } from './tuning';

export interface DuckProp {
  id: string;
  spot: Spot;
  group: Group;
  base: Vector3;
  yaw: number;
  t: number;
  found: boolean;
}

export interface EaselProp {
  id: string;
  spot: Spot;
  group: Group;
  texture: CanvasTexture | null;
  picture: MeshBasicMaterial;
  obstacle: Obstacle;
  yaw: number;
  spin: number;
  spinning: boolean;
  found: boolean;
}

/** The obstacle ids of the secrets sit below the traffic's (1000+) and the police's (900+). */
let nextObstacleId = 400;

export class SecretProps {
  duck: DuckProp | null = null;
  easel: EaselProp | null = null;
  god: Group | null = null;

  constructor(private readonly session: Session) {}

  /** Put the duck and the easel into the race world. */
  place(): void {
    this.placeDuck();
    this.placeEasel();
  }

  /** Take everything out of the world again (the race ended or restarted). */
  remove(): void {
    this.removeDuck();
    this.removeEasel();
    this.removeGod();
  }

  private placeDuck(): void {
    const session = this.session;
    const spot = duckSpot(session.track);
    const group = buildDuck();
    group.name = 'secret-duck';
    const base = session.track.toWorld(spot.s, spot.x, 0, new Vector3());
    group.position.copy(base);
    const yaw = yawToRoad(session.track, spot.s, spot.side);
    group.rotation.y = yaw;
    session.world.add(group);
    this.duck = { id: `duck_${session.track.id}`, spot, group, base, yaw, t: 0, found: false };
  }

  private placeEasel(): void {
    const session = this.session;
    const spot = easelSpot(session.track);
    const { group, texture, picture } = buildEasel();
    group.name = 'secret-easel';
    const pos = session.track.toWorld(spot.s, spot.x, -0.1, new Vector3());
    group.position.copy(pos);
    const yaw = yawToRoad(session.track, spot.s, spot.side);
    group.rotation.y = yaw;
    session.world.add(group);
    const obstacle: Obstacle = {
      id: nextObstacleId++, kind: 'prop', s: spot.s, x: spot.x, speed: 0,
      halfWidth: EASEL.halfWidth, halfLength: EASEL.halfLength, height: EASEL.height,
      solid: false, active: true,
    };
    session.obstacles.push(obstacle);
    this.easel = { id: `svg_${session.track.id}`, spot, group, texture, picture, obstacle, yaw, spin: 0, spinning: false, found: false };
  }

  private removeDuck(): void {
    const duck = this.duck;
    if (!duck) return;
    duck.group.parent?.remove(duck.group);
    disposeGroup(duck.group);
    this.duck = null;
  }

  private removeEasel(): void {
    const easel = this.easel;
    if (!easel) return;
    const i = this.session.obstacles.indexOf(easel.obstacle);
    if (i >= 0) this.session.obstacles.splice(i, 1);
    easel.group.parent?.remove(easel.group);
    disposeGroup(easel.group);
    easel.texture?.dispose();
    easel.picture.dispose();
    this.easel = null;
  }

  /** The cloud pelican (SPEC §21 #7): it lives in the sky, high above the road. */
  showGod(): Group {
    if (!this.god) {
      const group = buildGod();
      group.name = 'pelican-god';
      group.scale.setScalar(2.6);
      this.god = group;
    }
    if (!this.god.parent) this.session.world.add(this.god);
    this.god.visible = true;
    return this.god;
  }

  /** The god has crossed the sky (or the race ended). */
  hideGod(): void {
    if (!this.god) return;
    this.god.visible = false;
    this.god.parent?.remove(this.god);
  }

  removeGod(): void {
    if (!this.god) return;
    this.god.parent?.remove(this.god);
    disposeGroup(this.god);
    this.god = null;
  }
}

/** Dispose the geometries of a prop (the toon materials are shared and stay alive). */
export function disposeGroup(group: Group): void {
  group.traverse((o) => {
    const mesh = o as { geometry?: { dispose(): void } };
    mesh.geometry?.dispose();
  });
}
