// The police corgi's bike: an actors RiderView (corgi on an MTB) plus a flashing red/blue beacon on
// a rack pole, posed from race-owned track-space state.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Sprite,
  SpriteMaterial, Vector3,
} from 'three';
import { outline, toon } from '../../render/toon';
import type { AppContext, RiderView } from '../../core/contracts';
import type { RiderState } from '../../core/types';

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error('[race] police: no 2D canvas context');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export class PoliceView {
  readonly view: RiderView;
  private beacon = new Group();
  private red: Mesh;
  private blue: Mesh;
  private glowR: Sprite;
  private glowB: Sprite;
  private tex = glowTexture();
  private disposables: Array<{ dispose(): void }> = [];
  private t = 0;

  constructor(app: AppContext, parent: Group) {
    this.view = app.modules.createRiderView(app, 'corgi', 'mtb', { isPlayer: false, quality: app.quality });
    this.view.root.name = 'race:police';
    parent.add(this.view.root);
    const pole = new Mesh(new CylinderGeometry(0.018, 0.018, 1.25, 8), toon('#2b2b33'));
    pole.position.set(0, 1.35, 0.55);
    const barGeo = new BoxGeometry(0.17, 0.1, 0.12);
    this.red = new Mesh(barGeo, new MeshBasicMaterial({ color: '#ff1a2e' }));
    this.blue = new Mesh(barGeo, new MeshBasicMaterial({ color: '#2a5bff' }));
    this.red.position.set(-0.09, 2.0, 0.55);
    this.blue.position.set(0.09, 2.0, 0.55);
    outline(pole, 0.02);
    outline(this.red, 0.02);
    outline(this.blue, 0.02);
    const glow = (color: string): Sprite => {
      const s = new Sprite(new SpriteMaterial({ map: this.tex, color, blending: AdditiveBlending, depthWrite: false, transparent: true }));
      s.scale.setScalar(0.8);
      this.disposables.push(s.material);
      return s;
    };
    this.glowR = glow('#ff2a3a');
    this.glowB = glow('#3a6bff');
    this.glowR.position.copy(this.red.position).add(new Vector3(-0.1, 0, 0));
    this.glowB.position.copy(this.blue.position).add(new Vector3(0.1, 0, 0));
    this.beacon.add(pole, this.red, this.blue, this.glowR, this.glowB);
    this.view.root.add(this.beacon);
    this.disposables.push(pole.geometry, barGeo, this.red.material as MeshBasicMaterial, this.blue.material as MeshBasicMaterial, this.tex);
  }

  set visible(v: boolean) {
    this.view.root.visible = v;
  }

  update(state: RiderState, pos: Vector3, quat: Quaternion, dtSim: number, dtReal: number, siren: boolean): void {
    this.view.update(state, pos, quat, dtSim, dtReal);
    this.t += dtReal;
    const phase = (this.t * 3.2) % 2;
    const redOn = siren && phase < 1 && (phase % 0.5) < 0.32;
    const blueOn = siren && phase >= 1 && (phase % 0.5) < 0.32;
    this.glowR.visible = redOn;
    this.glowB.visible = blueOn;
    (this.red.material as MeshBasicMaterial).color.set(redOn || !siren ? '#ff1a2e' : '#5a0a12');
    (this.blue.material as MeshBasicMaterial).color.set(blueOn || !siren ? '#2a5bff' : '#0c1a55');
  }

  dispose(): void {
    this.view.dispose();
    this.view.root.removeFromParent();
    for (const d of this.disposables) d.dispose();
  }
}
