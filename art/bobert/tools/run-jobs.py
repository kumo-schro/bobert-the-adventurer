"""Runs every line of logs/jobs.txt through gen-concept.sh / gen-texture.sh, 5 at a time.
   python3 art/bobert/tools/run-jobs.py [only-these-style-ids...]"""
import subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
only = set(sys.argv[1:])

def run(line):
    kind, *rest = line.split('|')
    if kind == 'concept':
        sid, style = rest
        cmd, log, out = [f'{ROOT}/tools/gen-concept.sh', sid, style], f'{ROOT}/logs/concept-{sid}.log', f'{ROOT}/concepts/{sid}.png'
    else:
        sid, name, desc = rest
        cmd, log, out = [f'{ROOT}/tools/gen-texture.sh', sid, name, desc], f'{ROOT}/logs/texture-{sid}-{name}.log', f'{ROOT}/textures/{sid}/{name}.png'
    if only and sid not in only:
        return
    if os.path.exists(out):
        print('have', out, flush=True)
        return
    with open(log, 'w') as f:
        code = subprocess.call(cmd, stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    print(('done' if code == 0 and os.path.exists(out) else 'FAILED'), out, flush=True)

lines = [l.strip() for l in open(f'{ROOT}/logs/jobs.txt') if l.strip()]
with ThreadPoolExecutor(5) as pool:
    list(pool.map(run, lines))
