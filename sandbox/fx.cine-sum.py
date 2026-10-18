# Compact view of fx.cine.mjs output: python3 sandbox/fx.cine-sum.py < out.txt
import json, sys
for line in sys.stdin:
    line = line.strip()
    if not line.startswith('{'):
        continue
    d = json.loads(line)
    if 'events' in d:
        d['events'] = ' '.join(f"{e['t']}:{e['ev'].split(':')[1]}{('/' + e['phase']) if e.get('phase') else ''}" for e in d['events'])
    print(json.dumps(d))
