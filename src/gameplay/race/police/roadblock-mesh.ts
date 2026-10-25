// The roadblock's meshes (SPEC §14): red/white sawhorse barriers, traffic cones and the
// 「柯基执勤 POLICE」 sign. Everything is merged into one geometry (plus its outline hull) and the
// sign, so a block on the road costs a handful of draw calls.
import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type BufferGeometry } from 'three';
import { outline, toon } from '../../../render/toon';
import { box, cone, cylinder, merge, rbox } from '../traffic/kit';

const RED = '#e5191c';
const CREAM = '#f4f1ea';
const WOOD = '#d9cfb8';

/** One sawhorse: a striped board on two splayed legs, `width` wide, centred on `x`. */
function sawhorse(width: number, x: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const half = width / 2;
  const stripes = Math.max(2, Math.round(width / 0.55));
  const sw = width / stripes;
  for (let i = 0; i < stripes; i++) {
    const color = i % 2 === 0 ? RED : CREAM;
    parts.push(rbox([sw * 0.94, 0.3, 0.1], color, [x - half + sw * (i + 0.5), 0.98, 0], 0.04));
  }
  for (const lx of [x - half + 0.24, x + half - 0.24]) {
    parts.push(box([0.09, 1.05, 0.09], WOOD, [lx, 0.5, 0.2], [0.26, 0, 0]));
    parts.push(box([0.09, 1.05, 0.09], WOOD, [lx, 0.5, -0.2], [-0.26, 0, 0]));
    parts.push(box([0.11, 0.07, 0.9], WOOD, [lx, 0.05, 0]));
  }
  parts.push(box([0.16, 0.12, 0.16], '#ffab1a', [x, 1.22, 0], [0, 0, 0.3]));
  return parts;
}

/** The sign face: 「柯基执勤」 over POLICE, on a white plate with a red frame. */
function signTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 200;
  const g = c.getContext('2d');
  if (!g) throw new Error('[race] police: no 2D canvas context');
  g.fillStyle = CREAM;
  g.fillRect(0, 0, 512, 200);
  g.strokeStyle = RED;
  g.lineWidth = 14;
  g.strokeRect(8, 8, 496, 184);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#15151a';
  g.font = 'bold 92px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  g.fillText('柯基执勤', 256, 78);
  g.fillStyle = RED;
  g.font = 'bold 54px Arial, sans-serif';
  g.fillText('POLICE', 256, 152);
  const tex = new CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export interface RoadblockMesh {
  group: Group;
  dispose(): void;
}

/** The block's meshes in local space: X = across the road, Z = along it (the player comes from +Z). */
export function buildRoadblockMesh(bars: readonly { x: number; width: number }[], gapX: number): RoadblockMesh {
  const group = new Group();
  const parts: BufferGeometry[] = [];
  for (const b of bars) parts.push(...sawhorse(b.width, b.x));
  for (const cx of [gapX - 1.9, gapX, gapX + 1.9]) parts.push(cone(0.28, 0.62, '#ff7a1a', [cx, 0.31, 2.6]));
  const geo = merge(parts);
  const mesh = new Mesh(geo, toon('#ffffff', { vertexColors: true }));
  mesh.name = 'police:roadblock';
  outline(mesh, 0.04);
  group.add(mesh);

  const sign = new Group();
  const tex = signTexture();
  const plate = new Mesh(new PlaneGeometry(2.6, 1.0), new MeshBasicMaterial({ map: tex, side: DoubleSide }));
  plate.position.set(0, 2.25, 0);
  const poleGeo = cylinder(0.05, 0.05, 1.9, '#8d8f96', [-1.1, 0.95, 0]);
  const poleGeo2 = cylinder(0.05, 0.05, 1.9, '#8d8f96', [1.1, 0.95, 0]);
  const poles = new Mesh(merge([poleGeo, poleGeo2]), toon('#8d8f96'));
  outline(poles, 0.03);
  sign.add(plate, poles);
  group.add(sign);

  return {
    group,
    dispose(): void {
      geo.dispose();
      plate.geometry.dispose();
      (plate.material as MeshBasicMaterial).dispose();
      tex.dispose();
      poles.geometry.dispose();
      group.removeFromParent();
    },
  };
}
