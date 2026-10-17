// FxSystem: render pipeline (post), particles, bus reactions, continuous emitters and the KO director.
import { Vector3 } from 'three';
import { updateGrade, SpeedFeel } from './grade';
import { Particles } from './particles/system';
import { PostPipeline } from './post/pipeline';
import { PRESETS } from './presets';
import { createKit, type BurstOpts } from './presets/kit';
import { RiderTracker } from './react/tracker';
import { PostState } from './state';
import type { AppContext, FxSystem, Session } from '../core/contracts';
import type { Vec3Like } from '../core/types';
import type { FxContext } from './context';

/** A module plugged into the fx frame loop (reactions, emitters, directors). */
export interface FxPart {
  attach?(session: Session | null): void;
  update?(dtSim: number, dtReal: number): void;
  dispose?(): void;
}

export interface FxInternals extends FxContext {
  readonly pipeline: PostPipeline;
  readonly parts: FxPart[];
}

export function createFxCore(app: AppContext): { fx: FxSystem; ctx: FxInternals } {
  const post = new PostState();
  post.reducedFlashes = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pipeline = new PostPipeline(app.renderer, app.quality);
  const particles = new Particles(app.quality);
  app.scene.add(particles.group);
  const kit = createKit(particles);
  const tracker = new RiderTracker(particles);
  const speed = new SpeedFeel();
  const camPos = new Vector3();
  const warned = new Set<string>();
  let session: Session | null = null;
  let snapGrade = true;

  const burst = (name: string, pos: Vec3Like, opts: BurstOpts = {}): void => {
    const preset = PRESETS[name];
    if (!preset) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`[fx] unknown burst "${name}"`);
      }
      return;
    }
    preset(kit, pos, opts);
  };

  const ctx: FxInternals = {
    app, post, particles, tracker, pipeline, parts: [],
    session: () => session,
    burst,
  };

  const fx: FxSystem = {
    attach(s) {
      session = s;
      particles.clear();
      tracker.reset();
      speed.reset();
      post.reset();
      snapGrade = true;
      for (const part of ctx.parts) part.attach?.(s);
    },
    update(dtSim, dtReal) {
      post.tick(dtReal);
      camPos.copy(app.camera.position);
      if (session) tracker.update(session, dtSim, camPos);
      for (const part of ctx.parts) part.update?.(dtSim, dtReal);
      updateGrade(post, session?.track.look ?? null, app.renderer, dtReal, snapGrade);
      snapGrade = false;
      speed.update(post, session?.player ?? null, dtReal);
      particles.update(dtSim, dtReal);
    },
    render() {
      pipeline.render(app.scene, app.camera, post, app.clock.realTime);
    },
    resize(width, height, dpr) {
      pipeline.setSize(width, height, dpr);
    },
    burst: (name, pos, opts) => burst(name, pos, opts),
  };
  return { fx, ctx };
}
