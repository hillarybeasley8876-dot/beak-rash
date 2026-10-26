// The set pieces' shader warm-up (SPEC §12): a track event's props (a fish truck, a roadworks sign, a
// market stall) and the police's roadblock appear in the middle of a race, and a mesh that is drawn for
// the first time compiles its shader program on that very frame — a 30–250 ms freeze on a mid GPU, at
// exactly the moment something happens. So the set pieces build their stand-ins with the race, before
// core's warm-up walks the scene: one hidden instance of every mesh kind they draw, with the materials
// the props use. The props draw with the same materials and the same kind of object, so the program is
// already compiled when they appear (three shares one program between materials with the same settings).
//
// This file holds the shared helper (the track events and the police both need it), the stand-ins of
// the four track events and the warm-up of the track's reflection layer.
import {
  BufferAttribute, DataTexture, Group, HalfFloatType, InstancedMesh, Line, LineSegments, Matrix4, Mesh,
  MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Points, RGBAFormat, SkinnedMesh, Sprite, WebGLRenderTarget,
  type BufferGeometry, type Material, type Object3D, type SpriteMaterial,
} from 'three';
import { outlineMaterial, toon } from '../../../render/toon';
import type { Session } from '../../../core/contracts';
import { REFLECT_LAYER } from '../../../world/dressing/city/batch';

const INK = '#0b0b0f';

/** A one-pixel texture: a stand-in only needs a material with a map, not a picture. */
export function warmTexture(): DataTexture {
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** The geometry of a stand-in: a tiny plane with the attributes the merged props have — position, normal
 *  and vertex colours, and no UVs (the merged props drop theirs). */
function standGeo(uv: boolean): BufferGeometry {
  const geo = new PlaneGeometry(0.02, 0.02);
  if (!uv) geo.deleteAttribute('uv');
  const n = geo.getAttribute('position').count;
  geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return geo;
}

/** A hidden stand-in for one mesh kind: the renderer compiles the program of `material` for this kind of
 *  object while the race is built, behind the loading screen. A mesh and an instanced mesh of the same
 *  material are two different programs, so the kind is part of the stand-in. */
export function warmProxy(parent: Object3D, material: Material, kind: 'mesh' | 'instanced', uv = false): void {
  const geo = standGeo(uv);
  if (kind === 'mesh') {
    parent.add(new Mesh(geo, material));
    return;
  }
  const mesh = new InstancedMesh(geo, material, 1);
  mesh.setMatrixAt(0, new Matrix4());
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  parent.add(mesh);
}

/** A hidden group of stand-ins: it lives in the world, so core's warm-up draws it (and compiles its
 *  programs) before the loading screen lifts. */
export interface WarmKit {
  group: Group;
  dispose(): void;
}

/** A stand-in for one mesh kind: the same object type, the same geometry and the same material, so the
 *  renderer compiles the program the real mesh will need. */
function standIn(o: Object3D): Object3D {
  const mesh = o as Mesh;
  const geo = mesh.geometry;
  const mat = mesh.material;
  if (o instanceof InstancedMesh) {
    const p = new InstancedMesh(geo, mat, Math.max(1, o.count));
    p.instanceColor = o.instanceColor;
    return p;
  }
  if (o instanceof SkinnedMesh) {
    const p = new SkinnedMesh(geo, mat);
    if (o.skeleton) p.bind(o.skeleton, o.bindMatrix);
    return p;
  }
  if (o instanceof Points) return new Points(geo, mat);
  if (o instanceof LineSegments) return new LineSegments(geo, mat);
  if (o instanceof Line) return new Line(geo, mat);
  if (o instanceof Sprite) return new Sprite(mat as SpriteMaterial);
  return new Mesh(geo, mat);
}

/**
 * The wet city road mirrors its neon into the asphalt with a camera of its own, and that camera sees no
 * lights: the mirrored meshes need a second shader program (no directional, no hemisphere light). The
 * mirror only draws what is in its frustum, so those programs were compiled the first time the player
 * rode past a retaining wall — a 30–250 ms freeze, 70 s into a city race. Warm them with the race:
 * compile the reflect layer once, through a camera that sees no lights, behind the loading screen.
 */
export function warmReflectLayer(session: Session): void {
  const { app } = session;
  const group = new Group();
  session.track.group.traverse((o) => {
    if (!o.layers.isEnabled(REFLECT_LAYER)) return;
    if (!(o as Mesh).material) return;
    group.add(standIn(o));
  });
  if (!group.children.length) return;   // a track without a wet road has no reflection layer
  // A camera on the reflect layer: the scene's lights live on layer 0, so it sees none of them — exactly
  // like the mirror's own camera, which is what makes its programs different from the main render's.
  const camera = new PerspectiveCamera();
  camera.layers.set(REFLECT_LAYER);
  // The programs have to be the ones the mirror's render needs: it draws into a render target (its own
  // colour space, no tone mapping).
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  const prev = app.renderer.getRenderTarget();
  try {
    app.renderer.setRenderTarget(target);
    void app.renderer.compileAsync(group, camera, app.scene).catch((err: unknown) => {
      console.warn('[race] events: the reflect layer did not compile', err);
    });
  } finally {
    app.renderer.setRenderTarget(prev);
    target.dispose();
  }
}

/** The stand-ins of the track events: one per mesh kind the four events draw. */
export function buildEventWarmKit(): WarmKit {
  const group = new Group();
  group.name = 'race:events:warm';
  group.visible = false;
  const prop = toon('#ffffff', { vertexColors: true });
  // A prop and its ink outline: the truck (0.05 m), the roadworks crew, the stalls and the sign (0.03 m).
  warmProxy(group, prop, 'mesh');
  warmProxy(group, outlineMaterial(INK, 0.05), 'mesh');
  warmProxy(group, outlineMaterial(INK, 0.03), 'mesh');
  // The instanced pools: the barrier wall (0.03 m), the geese, the cones, the slick patches and the fruit (0.02 m).
  warmProxy(group, prop, 'instanced');
  warmProxy(group, outlineMaterial(INK, 0.03), 'instanced');
  warmProxy(group, outlineMaterial(INK, 0.02), 'instanced');
  // The painted face of the roadworks sign.
  const signTexture = warmTexture();
  const signMaterial = new MeshBasicMaterial({ map: signTexture });
  warmProxy(group, signMaterial, 'mesh', true);
  return {
    group,
    dispose(): void {
      group.removeFromParent();
      group.traverse((o) => {
        const mesh = o as Mesh;
        mesh.geometry?.dispose();
      });
      signMaterial.dispose();
      signTexture.dispose();
    },
  };
}
