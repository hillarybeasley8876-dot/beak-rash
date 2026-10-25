// The scene's lights, found once per race (and again when one has left the scene). The subject mask draws with
// them (post/mask.ts), and the KO cast look reads how bright a white surface is under them (composite-cast.ts).
import type { AmbientLight, DirectionalLight, HemisphereLight, Light, Object3D, Scene } from 'three';

const luma = (c: { r: number; g: number; b: number }): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export class SceneLights {
  private lights: Light[] | null = null;

  /** A new race: look the lights up again on the next call. */
  forget(): void {
    this.lights = null;
  }

  of(scene: Scene): Light[] {
    const inScene = (o: Object3D): boolean => {
      let p: Object3D | null = o;
      while (p.parent) p = p.parent;
      return p === scene;
    };
    if (this.lights && this.lights.every(inScene)) return this.lights;
    const found: Light[] = [];
    scene.traverse((o) => {
      if ((o as Partial<Light>).isLight === true) found.push(o as Light);
    });
    this.lights = found;
    return found;
  }

  /**
   * Linear luminance of a white surface in the toon lit band under the scene's lights right now (tunnels dim them):
   * the strongest directional light plus the hemisphere / ambient light seen sideways, over π (three's toon diffuse
   * is irradiance × albedo / π). 1 when the scene has no lights (menus).
   */
  litWhite(scene: Scene): number {
    let key = 0;
    let fill = 0;
    for (const l of this.of(scene)) {
      if (!l.visible) continue;
      const lum = luma(l.color) * l.intensity;
      const hemi = l as Partial<HemisphereLight>;
      if ((l as Partial<DirectionalLight>).isDirectionalLight === true) key = Math.max(key, lum);
      else if (hemi.isHemisphereLight === true && hemi.groundColor) fill += 0.5 * (lum + luma(hemi.groundColor) * l.intensity);
      else if ((l as Partial<AmbientLight>).isAmbientLight === true) fill += lum;
    }
    return key + fill > 0 ? (key + fill) / Math.PI : 1;
  }
}
