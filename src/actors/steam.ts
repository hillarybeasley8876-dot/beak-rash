// Zen steam puffs rising from a chilling rider's head (capybara chill): a few soft cloud sprites recycled in turn.
// Lives in the rider's body space like the other view-local extras (rides along with the bike).
import { CanvasTexture, Group, Sprite, SpriteMaterial, type Vector3 } from 'three';

let tex: CanvasTexture | null = null;

/** Three overlapping soft discs = a small cartoon cloud, drawn once. */
function puffTexture(): CanvasTexture {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    for (const [x, y, r] of [[24, 36, 18], [40, 34, 17], [32, 24, 16]] as const) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.6, 'rgba(240,248,255,0.8)');
      grad.addColorStop(1, 'rgba(230,240,250,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  tex = new CanvasTexture(c);
  return tex;
}

const N = 5, LIFE = 1.4;

interface Puff { sprite: Sprite; age: number; x: number; z: number; dx: number }

export class SteamPuffs {
  readonly group = new Group();
  private readonly puffs: Puff[] = [];
  private emit = 0;
  private seed = 0.37;

  constructor() {
    for (let i = 0; i < N; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      sprite.userData.noOutline = true;
      sprite.renderOrder = 2;
      sprite.visible = false;
      this.group.add(sprite);
      this.puffs.push({ sprite, age: LIFE, x: 0, z: 0, dx: 0 });
    }
  }

  private rand(): number {
    this.seed = (this.seed * 9301 + 0.49297) % 1;
    return this.seed;
  }

  /** `head` = head bone position in the parent's space; k = 0..1 steam strength (cue). */
  update(head: Vector3, k: number, dt: number): void {
    if (k > 0.3) this.emit += dt * (N / LIFE);
    let alive = false;
    for (const p of this.puffs) {
      if (p.age >= LIFE && this.emit >= 1) {
        this.emit -= 1;
        p.age = 0;
        p.x = head.x + (this.rand() - 0.5) * 0.12;
        p.z = head.z + (this.rand() - 0.5) * 0.08;
        p.dx = (this.rand() - 0.5) * 0.25;
      }
      const vis = p.age < LIFE;
      p.sprite.visible = vis;
      if (!vis) continue;
      alive = true;
      p.age += dt;
      const u = Math.min(1, p.age / LIFE);
      p.sprite.position.set(p.x + p.dx * u, head.y + 0.2 + 0.45 * u, p.z + 0.06 * u);
      p.sprite.scale.setScalar(0.09 + 0.2 * u);
      (p.sprite.material as SpriteMaterial).opacity = 0.75 * Math.sin(Math.PI * u) ** 0.7;
    }
    if (k <= 0.3) this.emit = 0;
    this.group.visible = alive;
  }

  dispose(): void {
    for (const p of this.puffs) (p.sprite.material as SpriteMaterial).dispose();
  }
}
