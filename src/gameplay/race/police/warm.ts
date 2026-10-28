// The police's shader warm-up (SPEC §12): the roadblock goes up in the middle of a chase, and a mesh that
// is drawn for the first time compiles its shader program on that very frame — a 30–250 ms freeze on a
// mid GPU, right when the block appears in front of the player. So the police builds the stand-ins of the
// block with the race, before core's warm-up walks the scene: one hidden instance of every mesh kind the
// block draws, with the materials the block uses.
//
// The beacon and the riot shield hang off the officer's rider view, so actors' RiderFade (actors/fade.ts)
// re-clads them the first time an officer fades — a downed one, an invulnerable one — and each clone is a
// new material with a `|fade` program suffix: three more programs compiled in the middle of the chase. The
// clones belong to the fade and cannot be built here, but three shares one program between materials with
// the same cache key, so a stand-in built with the same recipe warms them (see `fadeClone`).
import { DoubleSide, Group, MeshBasicMaterial, type Material } from 'three';
import { outlineMaterial, toon } from '../../../render/toon';
import { warmProxy, warmTexture, type WarmKit } from '../events/warm';

const INK = '#0b0b0f';

/**
 * The transparent copy actors/fade.ts makes of `m` while a rider is faded: a clone keyed `<base>|<key>`, so
 * it compiles a program of its own. `tweak` applies what the fade does to that flavour of clone. The flags
 * themselves are render state, not part of the cache key — only the `<base>|<key>` suffix has to match.
 */
function fadeClone<T extends Material>(m: T, key: string, tweak: (c: T) => void): T {
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  const base = m.customProgramCacheKey.bind(m);
  c.customProgramCacheKey = () => `${base()}|${key}`;
  c.transparent = true;
  c.alphaTest = 0;
  tweak(c);
  return c;
}

/** The stand-ins of the roadblock: the sawhorses, the sign and its poles. */
export function buildPoliceWarmKit(): WarmKit {
  const group = new Group();
  group.name = 'race:police:warm';
  group.visible = false;
  // The sawhorse barrier: a toon mesh with its ink outline.
  warmProxy(group, toon('#ffffff', { vertexColors: true }), 'mesh');
  warmProxy(group, outlineMaterial(INK, 0.04), 'mesh');
  // The sign poles: a plain toon mesh with a thinner outline.
  warmProxy(group, toon('#8d8f96'), 'mesh');
  warmProxy(group, outlineMaterial(INK, 0.03), 'mesh');
  // The painted sign plate: it is seen from both sides, so it is a double-sided program of its own.
  const plateTexture = warmTexture();
  const plate = new MeshBasicMaterial({ map: plateTexture, side: DoubleSide });
  warmProxy(group, plate, 'mesh', true);
  // What an officer's own meshes need once it fades: the beacon's pole (a toon mesh) and its red and blue
  // bars (unlit), each in the fade's colour and depth-only flavours, and the ink hulls of the beacon
  // (0.02 m) and of the riot shield's plate (0.025 m) and stripe (0.02 m).
  const pole = toon('#2b2b33');
  const bar = new MeshBasicMaterial({ color: '#ff1a2e' });
  const fades: Material[] = [];
  for (const m of [pole, bar]) {
    fades.push(fadeClone(m, 'fade', (c) => { c.depthWrite = false; }));
    fades.push(fadeClone(m, 'fade-depth', (c) => { c.colorWrite = false; c.depthWrite = true; }));
  }
  for (const w of [0.02, 0.025]) {
    fades.push(fadeClone(outlineMaterial(INK, w), 'fade-hull', (c) => { c.depthWrite = false; }));
  }
  for (const m of fades) warmProxy(group, m, 'mesh');
  return {
    group,
    dispose(): void {
      group.removeFromParent();
      group.traverse((o) => {
        const mesh = o as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
      plate.dispose();
      plateTexture.dispose();
      for (const m of fades) m.dispose();
      bar.dispose();
    },
  };
}
