// window.__br.fx — test/debug surface for critics and the sandbox.
import { Vector3 } from 'three';
import { PRESET_NAMES } from './presets';
import { GpuTimer } from './post/timer';
import { reactionBursts } from './react/bus-r6';
import type { DebugApi } from '../core/debug';
import type { Vec3Like } from '../core/types';
import type { FxInternals, FxPart } from './system';
import type { BurstOpts } from './presets/kit';
import type { PostState } from './state';
import type { PostToggles } from './post/pipeline';
import type { KoDirector } from './ko/director';
import type { KoTester, KoTestOpts } from './ko/tester';

/** Where to spawn a debug burst: a world point, or track-relative to the player. */
export type BurstAt = Vec3Like | { ahead: number; lateral?: number; up?: number };

export interface FxDebug {
  presets: string[];
  post: PostState;
  toggles: PostToggles;
  /** Spawn a preset at a world point / track offset from the player (default 2.2 m ahead, 1.2 m up). */
  burst(name: string, opts?: BurstOpts, at?: BurstAt): void;
  /** Knock out the nearest rival (staged next to the player); `chainAfter` adds a second KO. */
  testKo(opts?: KoTestOpts): number | null;
  /** Knock out the player (WRECKED variant). */
  testWrecked(opts?: KoTestOpts): number | null;
  /** SHOWTIME rise + dive impact with chain KOs. */
  testUlt(direct?: boolean): void;
  /** Average ms per frame for N renders with post on vs. off (GPU-synchronised wall clock). */
  bench(frames?: number): { postOn: number; postOff: number; post: number };
  /** GPU timer-query averages per pass (scene / bloom / composite) over N renders. */
  gpu(frames?: number): Promise<Record<string, number>>;
  stats(): Record<string, unknown>;
}

type WithFx = DebugApi & { fx?: FxDebug };

const tmp = new Vector3();
const px = new Uint8Array(4);

/** Hooks the debug API onto window.__br once it exists (it is installed after the systems). */
export function fxDebugPart(ctx: FxInternals, tester: KoTester, director: KoDirector): FxPart {
  const api: FxDebug = {
    presets: PRESET_NAMES,
    post: ctx.post,
    toggles: ctx.pipeline.toggles,
    burst(name, opts = {}, at = { ahead: 2.2 }) {
      const s = ctx.session();
      const t = s ? ctx.tracker.get(s.player.id) : undefined;
      let pos: Vec3Like = { x: 0, y: 1, z: 0 };
      let ground = t?.ground;
      if ('ahead' in at) {
        if (s) {
          const p = s.player;
          ground = s.track.toWorld(p.s + at.ahead, p.x + (at.lateral ?? 0), 0, tmp).y;
          pos = s.track.toWorld(p.s + at.ahead, p.x + (at.lateral ?? 0), at.up ?? 1.2, new Vector3());
        }
      } else pos = at;
      ctx.burst(name, pos, { ground, ...opts });
    },
    testKo: (o = {}) => tester.ko(o),
    testWrecked: (o = {}) => {
      const s = ctx.session();
      return s ? tester.ko({ ...o, victim: s.player.id }) : null;
    },
    testUlt: (direct = false) => tester.ult(direct),
    bench(frames = 120) {
      const { renderer, scene, camera } = ctx.app;
      const gl = renderer.getContext();
      const time = (on: boolean): number => {
        ctx.pipeline.toggles.enabled = on;
        ctx.pipeline.render(scene, camera, ctx.post, ctx.app.clock.realTime);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const t0 = performance.now();
        for (let i = 0; i < frames; i++) ctx.pipeline.render(scene, camera, ctx.post, ctx.app.clock.realTime);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return (performance.now() - t0) / frames;
      };
      const was = ctx.pipeline.toggles.enabled;
      // Interleave and keep the best of three runs each: wall-clock noise only ever adds time.
      let postOff = Infinity;
      let postOn = Infinity;
      for (let i = 0; i < 3; i++) {
        postOff = Math.min(postOff, time(false));
        postOn = Math.min(postOn, time(true));
      }
      ctx.pipeline.toggles.enabled = was;
      return { postOn: +postOn.toFixed(3), postOff: +postOff.toFixed(3), post: +(postOn - postOff).toFixed(3) };
    },
    async gpu(frames = 60) {
      const timer = new GpuTimer(ctx.app.renderer.getContext() as WebGL2RenderingContext);
      if (!timer.supported) return {};
      ctx.pipeline.timer = timer;
      const { scene, camera } = ctx.app;
      for (let i = 0; i < frames; i++) {
        ctx.pipeline.render(scene, camera, ctx.post, ctx.app.clock.realTime);
        timer.poll();
        await new Promise((r) => setTimeout(r, 0));
      }
      ctx.pipeline.timer = null;
      for (let i = 0; i < 50 && timer.poll() > 0; i++) await new Promise((r) => setTimeout(r, 10));
      return timer.averages();
    },
    stats() {
      return {
        scene: { ...ctx.pipeline.sceneStats },
        particles: ctx.particles.alive(),
        cine: director.info(),
        post: { ...ctx.post.cine, focus: ctx.post.cine.focus.toArray(), cast: ctx.post.cine.cast.size },
        // r6 (SPEC §24): the element reactions that burst since this race started.
        reactionBursts: reactionBursts(ctx.session()),
      };
    },
  };
  let installed = false;
  const install = (): void => {
    const br = window.__br as WithFx | undefined;
    if (installed || !br) return;
    br.fx = api;
    installed = true;
  };
  return {
    attach: install,
    update: install,
  };
}
