// The police's shader warm-up (SPEC §12): the roadblock goes up in the middle of a chase, and a mesh that
// is drawn for the first time compiles its shader program on that very frame — a 30–250 ms freeze on a
// mid GPU, right when the block appears in front of the player. So the police builds the stand-ins of the
// block with the race, before core's warm-up walks the scene: one hidden instance of every mesh kind the
// block draws, with the materials the block uses.
import { DoubleSide, Group, MeshBasicMaterial } from 'three';
import { outlineMaterial, toon } from '../../../render/toon';
import { warmProxy, warmTexture, type WarmKit } from '../events/warm';

const INK = '#0b0b0f';

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
    },
  };
}
