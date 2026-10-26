// 戈壁公路 GOBI HIGHWAY dressing (r4, SPEC §20). The desert highway's scenery: dune fields, rock
// buttes, the wind-turbine ridge, the nodding oil pumpjacks, the camel caravans, the truck stop, the
// salt pan and the caravanserai finish. Everything lives under one group, `dress:gobi`.
import { BILLBOARDS, SIGNS } from '../../../data/track-content/gobi';
import { breathe } from '../../breathe';
import type { WorldCtx } from '../../ctx';
import { ensureFonts } from '../../fonts';
import { installFogCull } from '../../lod';
import { loadBillboardArt } from '../../scenery/signs/art';
import type { TerrainField } from '../../terrain/field';
import { megaOfGobi, megaSetPiece } from '../mega';
import { makeGobiCtx, type GobiCtx } from './gctx';
import { buildTurbineRotors, pumpjack, turbine, type TurbineSite } from './industry';
import { dunes, distantMesas, mesas, saltLake, scatter, shoulderTufts } from './land';
import { sandstorm } from './sandstorm';
import { billboards, billboardAt, camelCaravan, chevrons, distanceMarkers, dustDevils, poles, roadSign, warning } from './roadside';
import { caravanserai, oasis, startGantry, truckStop } from './town';

/** Every text the gobi signs draw (the world preload warms these fonts). */
export const GOBI_SIGN_TEXTS = [
  ...BILLBOARDS, ...SIGNS, '暴力鹈鹕', 'GOBI HIGHWAY', '戈壁公路', '急弯 别急', '前方沙丘 慢', '加油站 · 今日油价：一条鱼',
  'FINISH 终点 · 戈壁', '补水点', '风沙区 减速', '骆驼优先', '终点：还远着呢', '禁止放鸽子',
];

const SIGN_TEXT: Record<string, string> = {
  dune: '前方沙丘 慢', sharp: '急弯 别急', water: '补水点 ←', wind: '风沙区 减速',
};

/** The marks, in groups: each group is a loading stage (the browser paints between them). */
const MARK_GROUPS: string[][] = [
  ['startGantry', 'finishArch', 'truckStop', 'oasis'],
  ['camelCaravan', 'dunes', 'mesa', 'saltLake'],
  ['turbines', 'pumpjacks', 'poles', 'dustDevil'],
  ['chevrons', 'sign', 'warnRamp', 'billboard'],
];

/** Landscape and landmark marks → scenery (one group per stage). */
function marks(g: GobiCtx, group: Set<string>): { turbines: TurbineSite[]; boards: number[] } {
  const turbines: TurbineSite[] = [];
  const boards: number[] = [];
  const L = g.ctx.L;
  for (const mk of L.marks) {
    if (!group.has(mk.kind)) continue;
    const side: -1 | 1 = mk.x < 0 ? -1 : 1;
    const count = typeof mk.data.count === 'number' ? mk.data.count : 1;
    const len = typeof mk.data.len === 'number' ? mk.data.len : 100;
    switch (mk.kind) {
      case 'startGantry': startGantry(g, mk.s); break;
      case 'finishArch': caravanserai(g, mk.s); break;
      case 'truckStop': truckStop(g, mk.s, side); break;
      case 'oasis': oasis(g, mk.s, side); break;
      case 'camelCaravan': camelCaravan(g, mk.s, side); break;
      case 'saltLake': saltLake(g, mk.s, len); break;
      case 'dunes': dunes(g, mk.s, side, len); break;
      case 'mesa': mesas(g, mk.s, side, count); break;
      case 'poles': poles(g, mk.s, len, side); break;
      case 'dustDevil': dustDevils(g, mk.s, side, count); break;
      case 'chevrons': chevrons(g, side, mk.s, mk.s + len); break;
      case 'warnRamp': warning(g, mk.s, side, '跳', '跳台 · 别怂'); break;
      case 'sign': {
        const key = String(mk.data.sign ?? '');
        const text = SIGN_TEXT[key] ?? SIGNS[0] ?? '急弯 别急';
        if (key === 'sharp') warning(g, mk.s, side, '弯', text);
        else roadSign(g, mk.s, side, text);
        break;
      }
      case 'billboard': boards.push(mk.s); break;
      case 'turbines': {
        // A ridge of turbines: towers on the plain, rotors facing the road.
        for (let i = 0; i < count; i++) {
          const ss = mk.s + i * g.rng.range(70, 105);
          const u = g.rng.range(120, 250);
          const sp = g.place.spot(ss, side, u);
          const fr = g.ctx.q.frameVis(ss);
          const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
          const ax = -side * (fr.right.x / rl), az = -side * (fr.right.z / rl);
          turbines.push(turbine(g, sp.pos.x, sp.pos.y - 0.8, sp.pos.z, ax, az));
        }
        break;
      }
      case 'pumpjacks': {
        for (let i = 0; i < count; i++) {
          const ss = mk.s + i * g.rng.range(40, 60);
          const u = g.rng.range(30, 70);
          const sp = g.place.spot(ss, side, u);
          if (!g.place.free(sp.pos.x, sp.pos.z, 8, 6)) continue;
          pumpjack(g, sp.pos.x, sp.pos.y, sp.pos.z, sp.faceRoad + Math.PI / 2);
        }
        break;
      }
      default: console.warn('[gobi] unknown mark', mk.kind);
    }
  }
  return { turbines, boards };
}

export async function dressGobi(ctx: WorldCtx, field: TerrainField): Promise<void> {
  // Fonts load while the scenery builds: every sign face is painted as it is created, and the atlas
  // is repainted once more if the fonts were late (the faces fell back to a system font).
  const fonts = ensureFonts(GOBI_SIGN_TEXTS, 4000);
  const art = await loadBillboardArt(ctx.id);
  const g = makeGobiCtx(ctx, field, ctx.rng.fork(0x9051));
  const L = ctx.L;

  const turbines: TurbineSite[] = [];
  const boards: number[] = [];
  const t0 = performance.now();
  for (const [i, group] of MARK_GROUPS.entries()) {
    const out = marks(g, new Set(group));
    turbines.push(...out.turbines);
    boards.push(...out.boards);
    await breathe();
    ctx.progress(0.08 + 0.1 * i);
    ctx.log(`gobi stage ${i} (${group[0]}…): ${Math.round(performance.now() - t0)} ms`);
  }

  buildTurbineRotors(g, turbines);
  distantMesas(g);
  sandstorm(g);
  await breathe();
  ctx.progress(0.5);

  // The verges: dry scrub, boulders and the odd tuft right at the shoulder (in slices, so no
  // single loading task gets long).
  const s0 = L.sMin, s1 = L.sMin + L.n - 1;
  for (let k = 0; k < 4; k++) {
    const a = s0 + ((s1 - s0) * k) / 4, b = s0 + ((s1 - s0) * (k + 1)) / 4;
    scatter(g, a, b);
    shoulderTufts(g, a, b);
    await breathe();
    ctx.log(`gobi scatter ${k}: ${Math.round(performance.now() - t0)} ms`);
  }
  ctx.progress(0.66);

  distanceMarkers(g);
  billboards(g, [...BILLBOARDS, ...BILLBOARDS], art);
  let bi = 0;
  for (const s of boards) {
    billboardAt(g, s, bi % 2 ? 1 : -1, BILLBOARDS[bi % BILLBOARDS.length] ?? '戈壁欢迎你', art);
    bi++;
  }
  await breathe();
  ctx.progress(0.74);

  // Animation: the turbine rotors spin on the GPU; the pumpjack beams nod and the dust devils turn.
  let t = 0;
  ctx.onUpdate((dtSim) => {
    t += dtSim;
    for (const s of g.spin) s.obj.rotation.y = t * s.speed;
    for (const n of g.nod) n.obj.rotation.z = Math.sin(t * n.speed + n.phase) * n.amp;
  });

  // The mega jump's set piece: the giant dune ramp with its flag poles and the watching caravan.
  megaSetPiece(megaOfGobi(g));
  const fontsReady = await fonts;
  g.faceTex.needsUpdate = true;
  if (!fontsReady) repaintWhenFontsLoad(g);
  const meshes = [
    ...await g.props.finishYielding(), ...await g.thin.finishYielding(), ...await g.far.finishYielding(),
    ...await g.glow.finishYielding(), ...await g.faces.finishYielding(),
  ];
  ctx.progress(0.94);
  ctx.log(`gobi batches: ${Math.round(performance.now() - t0)} ms`);
  installFogCull(ctx, g.group);
  ctx.log(`gobi dressing: ${meshes.length} batched meshes under dress:gobi`);
}

/** Repaint the atlas once the fonts land (unless the track is gone). */
function repaintWhenFontsLoad(g: GobiCtx): void {
  if (typeof document === 'undefined' || !document.fonts) return;
  let live = true;
  g.ctx.own({ dispose: () => { live = false; } });
  void document.fonts.ready.then(() => {
    if (!live) return;
    g.atlas.repaintAll();
    g.faceTex.needsUpdate = true;
    g.ctx.log('gobi sign atlas repainted after late fonts');
  });
}
