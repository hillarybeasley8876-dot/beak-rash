// Road marks (looks.ts RoadLook.marks): one every 70-150 m — flat tar / concrete patches and manholes in
// any lane; worn white arrows (curling into the bend before a sharp corner) and meme words in the two
// right-hand lanes, oriented for the riders; skid marks along the racing line through every sharp apex.
// Kept clear of features, the start / finish paint and the marks other painters own (road words,
// crossings). One merged decal mesh: a single draw call.
import { Color, Mesh, MeshToonMaterial, Vector3 } from 'three';
import { ROAD_SIGNS, TRACK_SIGNS } from '../../data/memes';
import { toonRamp } from '../../render/toon';
import type { TrackId } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { WorldCtx } from '../ctx';
import { START_LINE_S } from '../features/decals';
import { frameOffset, MeshBuf } from '../geom';
import type { RoadLook } from '../looks';
import type { AtlasRect } from '../scenery/signs/atlas';
import { GLYPH_M, markFaces, WORD_SPEC, type MarkDesign } from './marks-tex';

const LIFT = 0.011;
/** Layout marks whose road paint / stops other units draw: keep clear by [before, after] m. */
const CLEAR_MARKS: Record<string, [number, number]> = {
  paint: [4, 12], crossing: [14, 14], scramble: [28, 52], busStop: [14, 22], roundabout: [30, 30],
  startGantry: [12, 12], finishGantry: [12, 12],
};
const ARROW = { w: 1.35, len: 5.6 } as const;
const MANHOLE = 0.86;
/** Gap between the parts of a two-part phrase (m), and the most phrases a track paints. */
const PART_GAP = 3.5;
const MAX_PHRASES = 4;
/** Most painted words per track (the loudest mark: rarer than patches and arrows). */
const MAX_WORDS = 6;
/** Offsets (m) a blocked slot tries in turn. */
const RETRY = [0, 14, 28, -14, 42];
const WHITE = new Color('#ffffff');
/** Skid marks: corners tighter than `radius` m, at most one per `gap` m, ribbon width (m). */
const SKID = { radius: 70, gap: 90, w: 0.9 } as const;

/** Painted phrases for a track: content's track signs first, then general road signs; parts ≤ 5 glyphs, CJK only. */
export function roadWords(id: TrackId): string[][] {
  const ok = (t: string): boolean => /^[一-鿿]{2,5}$/.test(t);
  const phrases = [...TRACK_SIGNS[id], ...ROAD_SIGNS.slice(6)].map((p) => p.split(/\s+/)).filter((parts) => parts.length <= 2 && parts.every(ok));
  return phrases.slice(0, MAX_PHRASES);
}

interface Span { a: number; b: number }

function blocked(spans: Span[], a: number, b: number): boolean {
  return spans.some((sp) => b > sp.a && a < sp.b);
}

/** s ranges kept free of marks. */
function clearSpans(ctx: WorldCtx): Span[] {
  const { L } = ctx;
  const out: Span[] = [{ a: -Infinity, b: START_LINE_S + 30 }, { a: L.length - 24, b: Infinity }];
  for (const f of L.features) if (f.kind !== 'tunnel' && f.kind !== 'checkpoint') out.push({ a: f.s0 - 10, b: f.s1 + 10 });
  for (const m of L.marks) {
    const c = CLEAR_MARKS[m.kind];
    if (c) out.push({ a: m.s - c[0], b: m.s + c[1] });
  }
  return out;
}

/** Max |curvature| (signed) over [s0, s1]. */
function bendAhead(ctx: WorldCtx, s0: number, s1: number): number {
  let best = 0;
  for (let s = s0; s <= s1; s += 5) {
    const k = ctx.L.curv[ctx.q.sampleAt(s)] ?? 0;
    if (Math.abs(k) > Math.abs(best)) best = k;
  }
  return best;
}

class MarkBuf {
  readonly buf = new MeshBuf();
  private readonly p = new Vector3();
  constructor(private readonly ctx: WorldCtx) {}

  /** Rectangle s0..s1 × x0..x1 on the road, rows every metre; v runs along s (near → far), u across. */
  rect(s0: number, s1: number, x0: number, x1: number, r: AtlasRect): void {
    this.ribbon(s0, s1, () => (x0 + x1) / 2, x1 - x0, r);
  }

  /** Strip w m wide centred on x(s), rows every metre (follows a line that drifts across the road). */
  ribbon(s0: number, s1: number, x: (s: number) => number, w: number, r: AtlasRect): void {
    const { q } = this.ctx;
    const rows = Math.max(2, Math.ceil(s1 - s0) + 1);
    const fr = q.frameVis(s0);
    const base = this.buf.count;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1), s = s0 + (s1 - s0) * t, xc = x(s);
      q.frameVis(s, fr);
      const v = r.v0 + (r.v1 - r.v0) * t;
      this.buf.vert(frameOffset(fr, xc - w / 2, LIFT, this.p), fr.up, WHITE, r.u0, v);
      this.buf.vert(frameOffset(fr, xc + w / 2, LIFT, this.p), fr.up, WHITE, r.u1, v);
    }
    for (let i = 0; i < rows - 1; i++) {
      const a = base + i * 2;
      this.buf.quad(a, a + 1, a + 3, a + 2);
    }
  }
}

/** Weighted pick of a mark kind. */
function pickKind(rng: Rng, w: RoadLook['marks']): 'patch' | 'manhole' | 'arrow' | 'word' {
  const total = w.patch + w.manhole + w.arrow + w.word;
  let r = rng.range(0, total);
  for (const k of ['patch', 'manhole', 'arrow', 'word'] as const) {
    r -= w[k];
    if (r < 0) return k;
  }
  return 'patch';
}

/** Build the road marks for the track (one mesh, one material); `line` = racing-line x per layout sample. */
export function buildRoadMarks(ctx: WorldCtx, look: RoadLook, line: Float32Array): void {
  const { L, q } = ctx;
  const hw = L.halfWidth, laneHalf = hw / 4;
  const lanes = [-3 * laneHalf, -laneHalf, laneHalf, 3 * laneHalf];
  const right = [laneHalf, 3 * laneHalf];
  const rng = ctx.rng.fork(0x0a5f);
  const phrases = rng.shuffle(roadWords(ctx.id));
  const faces = markFaces(phrases.flat());
  const spans = clearSpans(ctx);
  const out = new MarkBuf(ctx);
  const counts = { patch: 0, manhole: 0, arrow: 0, word: 0, skid: 0 };
  const at: string[] = [];
  let phrase = 0;
  const put = (s0: number, s1: number, x0: number, x1: number, r: AtlasRect | null): boolean => {
    if (!r || blocked(spans, s0, s1)) return false;
    out.rect(s0, s1, x0, x1, r);
    return true;
  };
  type Kind = ReturnType<typeof pickKind>;
  /** One mark of `kind` starting at s; false when it does not fit there. */
  const place = (kind: Kind, s: number): boolean => {
    if (kind === 'patch') {
      // A resurfaced strip a lane wide, or a small square repair inside one lane.
      const strip = rng.chance(0.3);
      const lane = rng.pick(lanes), w = strip ? 2 * laneHalf - 0.3 : rng.range(1.4, 2.6);
      const len = strip ? rng.range(10, 22) : rng.range(1.8, 6);
      const x = lane + (strip ? 0 : rng.range(-1, 1) * (laneHalf - w / 2 - 0.15));
      const design: MarkDesign = strip || rng.chance(0.7) ? 'patchDark' : 'patchLight';
      return put(s, s + len, x - w / 2, x + w / 2, faces.design(design));
    }
    if (kind === 'manhole') {
      // Cities group them (2-3 covers a few metres apart), elsewhere one at a time.
      const n = ctx.id === 'city' ? rng.int(1, 3) : 1;
      let placed = 0;
      for (let i = 0; i < n; i++) {
        const x = rng.pick(lanes) + rng.range(-0.7, 0.7), ss = s + i * rng.range(5, 9);
        if (put(ss, ss + MANHOLE, x - MANHOLE / 2, x + MANHOLE / 2, faces.design('manhole'))) placed++;
      }
      return placed > 0;
    }
    if (kind === 'arrow') {
      // Before a sharp corner the arrows curl into it (positive curvature turns right).
      const k = bendAhead(ctx, s + 25, s + 90);
      const design: MarkDesign = Math.abs(k) > 1 / 120 ? (k > 0 ? 'bendR' : 'bendL') : 'arrow';
      if (blocked(spans, s, s + ARROW.len)) return false;
      for (const x of right) put(s, s + ARROW.len, x - ARROW.w / 2, x + ARROW.w / 2, faces.design(design));
      return true;
    }
    const parts = phrases[phrase % Math.max(1, phrases.length)] ?? [];
    const lens = parts.map((t) => Array.from(t).length * GLYPH_M);
    const total = lens.reduce((a, b) => a + b, 0) + PART_GAP * (parts.length - 1);
    if (!parts.length || blocked(spans, s, s + total)) return false;
    const x = rng.pick(right), w = 2 * laneHalf - 0.9;
    let at = s;
    parts.forEach((t, i) => {
      put(at, at + (lens[i] ?? 0), x - w / 2, x + w / 2, faces.word(t));
      at += (lens[i] ?? 0) + PART_GAP;
    });
    phrase++;
    return true;
  };
  for (let s = START_LINE_S + 30 + rng.range(10, 50); s < L.length - 30; s += rng.range(look.marks.every[0], look.marks.every[1])) {
    const picked = pickKind(rng, look.marks);
    const kind: Kind = picked === 'word' && phrase >= MAX_WORDS ? 'patch' : picked;
    // A slot that lands on a feature or someone else's paint slides along the road before giving up.
    const ds = RETRY.find((d) => place(kind, s + d));
    if (ds === undefined) continue;
    counts[kind]++;
    at.push(`${kind[0]}${Math.round(s + ds)}`);
  }
  // Skid marks along the racing line through the apex of every sharp corner.
  const skid = faces.design('skid');
  let last = -Infinity;
  for (let s = START_LINE_S + 40; skid && s < L.length - 40; s += 2) {
    if (Math.abs(L.curv[q.sampleAt(s)] ?? 0) < 1 / SKID.radius || s - last < SKID.gap) continue;
    const s1 = s + rng.range(12, 22);
    if (blocked(spans, s - 4, s1)) continue;
    out.ribbon(s - 4, s1, (ss) => line[q.sampleAt(ss)] ?? 0, SKID.w, skid);
    last = s;
    counts.skid++;
  }
  const tex = ctx.own(faces.atlas.texture(ctx.app.renderer));
  const mat = ctx.own(new MeshToonMaterial({
    map: tex, gradientMap: toonRamp(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  const mesh = new Mesh(ctx.own(out.buf.build({ colors: false })), mat);
  mesh.name = 'roadMarks';
  mesh.renderOrder = 1;
  mesh.receiveShadow = true;
  ctx.group.add(mesh);
  repaintWhenWordsLoad(ctx, faces.atlas, tex, phrases.flat().join(''));
  ctx.log(`road marks: ${JSON.stringify(counts)} at ${at.join(',')}, atlas ${faces.atlas.usedHeight}/${faces.atlas.height} px`);
}

/** Words painted with fallback glyphs: repaint the mark atlas once their font is in (skipped once disposed). */
function repaintWhenWordsLoad(ctx: WorldCtx, atlas: ReturnType<typeof markFaces>['atlas'], tex: { needsUpdate: boolean }, text: string): void {
  if (!text || typeof document === 'undefined' || !document.fonts || document.fonts.check(WORD_SPEC, text)) return;
  let live = true;
  ctx.own({ dispose: () => { live = false; } });
  document.fonts.load(WORD_SPEC, text).then(() => {
    if (!live) return;
    atlas.repaint();
    tex.needsUpdate = true;
  }, (err: unknown) => console.warn('[track] road word font failed', err));
}
