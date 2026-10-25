// The sandstorm finale: the last 500 m of the 戈壁公路 run into a dust storm. Curtains of orange
// haze stand across the highway, thickening towards the finish, so the run ends in the weather.
import { CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { Rng } from '../../../core/rng';
import type { GobiCtx } from './gctx';

/** The length of the dust run (m), the gap between the curtains and their size. */
const LAST = 500, EVERY = 62, WIDTH = 300, HEIGHT = 44;

/** A soft dust sheet: dense orange at the bottom, thinning out towards the top. */
function dustTexture(rng: Rng): CanvasTexture {
  const W = 128, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('[gobi] 2D canvas unavailable');
  const grad = g.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, 'rgba(224,166,96,0.95)');
  grad.addColorStop(0.45, 'rgba(214,152,84,0.6)');
  grad.addColorStop(1, 'rgba(206,146,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // A few soft billows so the sheet is not a flat wash.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, W), y = H - rng.range(0, H * 0.8), r = rng.range(8, 34);
    const blob = g.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, 'rgba(232,180,116,0.35)');
    blob.addColorStop(1, 'rgba(232,180,116,0)');
    g.fillStyle = blob;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The dust curtains over the last stretch of the track (one mesh per curtain). */
export function sandstorm(g: GobiCtx): void {
  const q = g.ctx.q;
  const L = g.ctx.L;
  const tex = g.ctx.own(dustTexture(g.rng));
  const geo = g.ctx.own(new PlaneGeometry(WIDTH, HEIGHT));
  const group = new Group();
  group.name = 'gobi-sandstorm';
  for (let s = L.length - LAST; s <= L.length + 60; s += EVERY) {
    const t = Math.min(1, (s - (L.length - LAST)) / LAST);
    const fr = q.frameVis(s);
    const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
    const mat = g.ctx.own(new MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, side: DoubleSide, fog: true,
      opacity: 0.18 + 0.55 * t * t, color: new Color('#e8b478'),
    }));
    const mesh = new Mesh(geo, mat);
    mesh.position.set(fr.pos.x, fr.pos.y + HEIGHT * 0.5 - 7, fr.pos.z);
    mesh.rotation.y = yaw;
    mesh.renderOrder = 3;
    group.add(mesh);
  }
  g.group.add(group);
  g.ctx.log(`sandstorm: ${group.children.length} dust curtains over the last ${LAST} m`);
}
