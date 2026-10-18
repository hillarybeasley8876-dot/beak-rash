// Pedal extenders for riders whose legs are too short for the pedals (corgi, penguin; meta.shortLegs): a
// telescoping toy rod from each pedal up to the paddling foot, so the stubby legs visibly drive the crank.
import { CylinderGeometry, Mesh, Quaternion, Vector3, type Group } from 'three';
import { outline, toon } from '../render/toon';

const UP = new Vector3(0, 1, 0), d = new Vector3(), q = new Quaternion();
let rodGeo: CylinderGeometry | null = null;

function rodGeometry(): CylinderGeometry {
  if (rodGeo) return rodGeo;
  rodGeo = new CylinderGeometry(0.013, 0.02, 1, 8);
  rodGeo.translate(0, 0.5, 0);
  return rodGeo;
}

export class PedalExtenders {
  private readonly rods: [Mesh, Mesh];

  constructor(private readonly body: Group, color = '#ff5a3c') {
    const make = (): Mesh => {
      const m = new Mesh(rodGeometry(), toon(color));
      m.castShadow = true;
      outline(m, 0.012);
      body.add(m);
      return m;
    };
    this.rods = [make(), make()];
  }

  /** Pedal centres and foot soles in the body's (character) space. */
  update(pedalL: Vector3, pedalR: Vector3, footL: Vector3, footR: Vector3): void {
    this.place(this.rods[0], pedalL, footL);
    this.place(this.rods[1], pedalR, footR);
  }

  private place(rod: Mesh, pedal: Vector3, foot: Vector3): void {
    d.subVectors(foot, pedal);
    const len = Math.max(0.01, d.length());
    rod.position.copy(pedal);
    rod.quaternion.copy(q.setFromUnitVectors(UP, d.multiplyScalar(1 / len)));
    rod.scale.set(1, len, 1);
  }

  dispose(): void {
    for (const r of this.rods) this.body.remove(r);
  }
}
