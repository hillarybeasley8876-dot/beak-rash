"""r7 feel audit, part 2: compare each CAST ride with the CONTROL ride (tools/r7/feel.mjs writes both).

    python tools/r7/feel_diff.py <out> [skill ...]

screen  share of the frame that changed (8x8 blocks of a half-size frame, any channel > 40 in > 1/4 of the block),
        whole frame and the middle (the road and the riders, without the HUD corners); the CONTROL-vs-CONTROL figure
        is the noise floor
hud     texts that appear only in the CAST ride (continuous HUD readouts filtered out)
sound   sounds heard only in the CAST ride
sim     per rival: metres lost, HP lost, statuses gained; the player's metres gained, HP, statuses
Writes <out>/summary.json and <out>/sheet-<n>.jpg (one row of six frames per skill).
"""
import json
import os
import re
import sys
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
OUT = sys.argv[1]
MARKS = [6, 18, 36, 72, 144, 210]
SECS = [m / 60 for m in MARKS]
# HUD readouts that change every frame in both rides (speed, time, distance, places, bars): not a skill's feedback
CONTINUOUS = re.compile(r'(spd|speed|time|clock|dist|km|place|pos-|rank|sp-|hp-|bar|meter|progress|gauge|count|cd|cool|fps|minimap|lap)', re.I)
NUMERIC = re.compile(r'^[\d\s.:/,+\-x×%]*$')


def load_run(name):
    p = os.path.join(OUT, name, 'run.json')
    if not os.path.exists(p):
        return None
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def frame(name, m):
    p = os.path.join(OUT, name, f'w{m:03d}.jpg')   # the world drawn from the CONTROL camera (no HUD)
    return np.asarray(Image.open(p).convert('RGB').resize((640, 360), Image.BILINEAR), dtype=np.int16)


def changed(a, b):
    d = np.abs(a - b).max(axis=2) > 40
    h, w = d.shape
    blocks = d[: h // 8 * 8, : w // 8 * 8].reshape(h // 8, 8, w // 8, 8).mean(axis=(1, 3)) > 0.25
    whole = float(blocks.mean())
    bh, bw = blocks.shape
    mid = float(blocks[int(bh * 0.15): int(bh * 0.85), int(bw * 0.15): int(bw * 0.85)].mean())
    return whole, mid


def texts_of(run, with_cls=False):
    out = set()
    for _f, cls, t in run.get('texts', []):
        if CONTINUOUS.search(cls or ''):
            continue
        out.add(f'{cls}|{t}' if with_cls else t)
    return out


def main():
    ctl = load_run('control-a')
    ctl_b = load_run('control-b')
    if not ctl:
        print('no control ride')
        sys.exit(1)
    skills = sys.argv[2:] or sorted(d for d in os.listdir(OUT) if os.path.isdir(os.path.join(OUT, d)) and not d.startswith('control'))
    noise = [changed(frame('control-a', m), frame('control-b', m)) for m in MARKS] if ctl_b else [(0, 0)] * len(MARKS)
    ctl_texts = texts_of(ctl) | (texts_of(ctl_b) if ctl_b else set())
    ctl_sounds = Counter(ctl.get('sounds', []))
    summary = {'noise': noise, 'marks': SECS, 'skills': {}}
    for sk in skills:
        run = load_run(sk)
        if not run:
            summary['skills'][sk] = {'error': 'no ride'}
            continue
        scr = [changed(frame('control-a', m), frame(sk, m)) for m in MARKS]
        new_texts = sorted(t for t in texts_of(run) - ctl_texts if not NUMERIC.match(t))
        hud_cls = sorted({ct for ct in texts_of(run, True) if ct.split('|', 1)[1] in new_texts})
        nums = sorted({t for t in texts_of(run) - ctl_texts if NUMERIC.match(t)})
        snd = Counter(run.get('sounds', [])) - ctl_sounds
        # sim deltas at each sample (index 0 = t0)
        rivals = {}
        player = []
        for i, (cs, rs) in enumerate(zip(ctl['samples'], run['samples'])):
            byc = {r['id']: r for r in cs['riders']}
            for r in rs['riders']:
                c = byc.get(r['id'])
                if not c:
                    continue
                if r['id'] == 0:
                    player.append({'gain': round(r['s'] - c['s'], 2), 'hp': round(r['hp'] - c['hp'], 1),
                                   'st': sorted(set(r['st']) - set(c['st'])), 'dv': round(r['v'] - c['v'], 2),
                                   'sp': round(r.get('sp', 0) - c.get('sp', 0), 1), 'coins': r.get('coins', 0) - c.get('coins', 0),
                                   'w': r.get('w') if r.get('w') != c.get('w') else None})
                    continue
                e = rivals.setdefault(r['id'], {'c': r['c'], 'lost': [], 'hp': [], 'sp': [], 'st': set(), 'crash': False, 'w': None})
                e['lost'].append(round(c['s'] - r['s'], 2))
                e['hp'].append(round(c['hp'] - r['hp'], 1))
                e['sp'].append(round(c.get('sp', 0) - r.get('sp', 0), 1))
                if r.get('w') != c.get('w'):
                    e['w'] = f"{c.get('w')}->{r.get('w')}"
                e['st'] |= set(r['st']) - set(c['st'])
                if r['mode'] != c['mode'] and r['mode'] in ('crashed', 'respawning'):
                    e['crash'] = True
        cam = []
        for cp, rp in zip(ctl.get('poses', []), run.get('poses', [])):
            dfov = rp['fov'] - cp['fov']
            drel = sum((x - y) ** 2 for x, y in zip(rp['rel'], cp['rel'])) ** 0.5
            cam.append([round(dfov, 2), round(drel, 2)])
        hit_by_skill = sorted({ev[2].get('victim') for ev in run['events'] if ev[1] == 'skill:hit'})
        dmg = sum(ev[2].get('damage', 0) for ev in run['events'] if ev[1] == 'combat:hit' and ev[2].get('attacker') == 0)
        denied = [ev[2] for ev in run['events'] if ev[1] == 'skill:denied']
        affected = {rid: e for rid, e in rivals.items() if max(e['lost']) > 1.0 or max(e['hp']) > 0.5 or max(e['sp']) > 1 or e['st'] or e['crash'] or e['w']}
        summary['skills'][sk] = {
            'cast': run.get('cast'),
            'screen': scr,
            'peak_mid': max(m for _w, m in scr),
            'peak_whole': max(w for w, _m in scr),
            'hud': new_texts[:30], 'hud_cls': hud_cls[:30], 'nums': nums[:20],
            'has_readout': any('st-readout' in c for c in hud_cls), 'has_rear': any('st-rear' in c for c in hud_cls),
            'sounds': dict(snd),
            'rivals': {str(k): {'c': v['c'], 'lost': v['lost'], 'hp': v['hp'], 'sp': v['sp'], 'w': v['w'], 'st': sorted(v['st']), 'crash': v['crash']} for k, v in rivals.items()},
            'affected': len(affected),
            'player': player,
            'camera': cam,
            'skill_hit': hit_by_skill, 'damage': round(dmg, 1), 'denied': denied,
            'events': Counter(ev[1] for ev in run['events']),
            'errors': run.get('errors', []),
        }
    with open(os.path.join(OUT, 'summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)
    # table
    print(f"noise floor (control vs control, middle): {' '.join(f'{m*100:.1f}' for _w, m in noise)} %")
    print(f"{'skill':20} {'screen middle % @ ' + ' '.join(f'{s:.1f}' for s in SECS):44} aff  dmg  player+m  hud / sounds")
    for sk, s in summary['skills'].items():
        if 'error' in s:
            print(f'{sk:20} ERROR {s["error"]}')
            continue
        scr = ' '.join(f'{m*100:4.1f}' for _w, m in s['screen'])
        gain = s['player'][-1]['gain'] if s['player'] else 0
        sts = sorted({st for v in s['rivals'].values() for st in v['st']})
        print(f"{sk:20} {scr:44} {s['affected']:3}  {s['damage']:4.0f}  {gain:+7.1f}  hud={s['hud'][:4]} st={sts} snd={list(s['sounds'])[:3]}{' DENIED' if s['denied'] else ''}")
    sheets(summary)


def sheets(summary):
    names = [k for k, v in summary['skills'].items() if 'error' not in v]
    per = 6
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
    except OSError:
        font = ImageFont.load_default()
    for n in range(0, len(names), per):
        group = names[n: n + per]
        tw, th = 320, 180
        sheet = Image.new('RGB', (tw * len(MARKS), (th + 22) * len(group)), (16, 16, 16))
        d = ImageDraw.Draw(sheet)
        for row, sk in enumerate(group):
            y = row * (th + 22)
            d.text((4, y + 2), f'{sk}   +{" / +".join(f"{s:.1f}" for s in SECS)} s', fill=(255, 220, 90), font=font)
            for col, m in enumerate(MARKS):
                im = Image.open(os.path.join(OUT, sk, f'f{m:03d}.jpg')).convert('RGB').resize((tw, th), Image.BILINEAR)
                sheet.paste(im, (col * tw, y + 22))
        p = os.path.join(OUT, f'sheet-{n // per + 1}.jpg')
        sheet.save(p, quality=85)
        print('sheet', p)


main()
