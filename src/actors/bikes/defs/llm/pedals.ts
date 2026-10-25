// The LLM edition's loose pedals (SPEC §21 #2): two pedals that came loose and now drift around the
// frame, each on its own small orbit beside the bike. The pedal body is drawn at `centre` in bike space;
// the bone's pivot is the centre of its orbit, so the animator's turn swings it round that circle.
import { Euler } from 'three';
import { box, cyl, ellip, v, type Seg, type V3 } from '../../build/geo';
import type { PartSet } from '../../build/partset';

/** A pedal with no crank under it: a fat platform, a stub spindle and a reflector. */
export function loosePedal(ps: PartSet, centre: V3, color: string, seg: Seg): void {
  ps.add(ellip(centre, 0.25, 0.085, 0.175, seg(14, 10), seg(8, 6), new Euler(0.16, 0.5, 0.3)), { color, outline: 0.014 });
  ps.detail.add(cyl(centre.clone().add(v(-0.088, 0.006, 0.018)), centre.clone().add(v(-0.008, 0.003, 0.006)), 0.01, 0.01, seg(6, 5)), { color: '#9aa0a8' });
  ps.detail.add(box(centre.clone().add(v(0.018, 0.022, 0.05)), 0.082, 0.016, 0.012, new Euler(0.16, 0.5, 0.3)), { color: '#fffbe8', outline: 0.004 });
}
