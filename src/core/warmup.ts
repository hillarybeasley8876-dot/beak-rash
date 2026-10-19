// Race warm-up behind the loading screen. Compiles every shader program the new race needs — with
// KHR_parallel_shader_compile the driver builds them while the loading screen keeps animating — so the
// intro's first frame does not stall on 50+ synchronous compiles. Hidden objects (LOD / fog-culled props)
// are included: three's compile walks the whole graph. Programs are keyed for the post pipeline's
// off-screen target (fx draws the scene into a render target, which changes the tone-mapping and
// colour-space program keys), unless fx runs on its stub, which draws straight to the canvas.
import { HalfFloatType, WebGLRenderTarget, type Light, type Object3D } from 'three';
import type { AppContext } from './contracts';

export interface WarmupStats {
  /** Programs created by the warm-up (cache hits from the previous race are not counted). */
  programs: number;
  /** Main-thread time spent inside compile calls (ms). */
  compileMs: number;
  /** Until every program reported ready (ms). */
  readyMs: number;
  /** The hidden draw-everything frame (ms). */
  drawMs: number;
}

const SLICE_MS = 12;   // main-thread budget per loading-screen frame

/** Compile the programs of everything in app.scene; yields a frame whenever a slice exceeds SLICE_MS. */
export async function compileScene(app: AppContext, yieldFrame: () => Promise<void>): Promise<WarmupStats> {
  const { renderer, scene, camera } = app;
  const target = app.modules.stubbed.includes('fx') ? null : new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  const before = renderer.info.programs?.length ?? 0;
  const t0 = performance.now();
  const pending: Array<Promise<unknown>> = [];
  let compileMs = 0;
  let slice = t0;
  try {
    for (const chunk of lightFreeChunks(scene)) {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      try {
        // targetScene = scene: lights, fog and environment come from the scene the chunk renders in.
        pending.push(renderer.compileAsync(chunk, camera, scene));
      } finally {
        renderer.setRenderTarget(prev);
      }
      if (performance.now() - slice > SLICE_MS) {
        compileMs += performance.now() - slice;
        await yieldFrame();
        slice = performance.now();
      }
    }
    compileMs += performance.now() - slice;
    await Promise.all(pending);
  } finally {
    target?.dispose();
  }
  return { programs: (renderer.info.programs?.length ?? 0) - before, compileMs, readyMs: performance.now() - t0, drawMs: 0 };
}

/** One frame with every object drawn (visibility and frustum culling forced on just for this call), so
 *  shadow-depth programs and texture uploads of props that are off-screen, fog-culled or pooled happen
 *  behind the loading screen instead of when they first come into view. Returns the frame time (ms). */
export function drawEverything(app: AppContext): number {
  const saved: Array<[Object3D, boolean, boolean]> = [];
  app.scene.traverse((o) => {
    saved.push([o, o.visible, o.frustumCulled]);
    o.visible = true;
    o.frustumCulled = false;
  });
  const t0 = performance.now();
  try {
    app.fx.render();
  } finally {
    for (const [o, visible, culled] of saved) {
      o.visible = visible;
      o.frustumCulled = culled;
    }
  }
  return performance.now() - t0;
}

const isLight = (o: Object3D): o is Light => (o as Partial<Light>).isLight === true;

function hasLight(o: Object3D): boolean {
  if (isLight(o)) return true;
  return o.children.some(hasLight);
}

/** Subtrees covering the scene's renderables without any light inside: compile(chunk, camera, scene)
 *  counts the chunk's own lights on top of the scene's, so a chunk holding a light would double it and
 *  compile programs with the wrong light counts. Nodes that both render and parent a light (rare) are
 *  left to the first real frame. */
function lightFreeChunks(root: Object3D, out: Object3D[] = []): Object3D[] {
  for (const child of root.children) {
    if (!hasLight(child)) out.push(child);
    else lightFreeChunks(child, out);
  }
  return out;
}

/** Next animation frame, or 100 ms when frames are not running (hidden tab), so a start never hangs. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 100);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
