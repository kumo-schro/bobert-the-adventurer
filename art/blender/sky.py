"""Sky props for the Psychedelic Garden: puffy beveled clouds.
Run: Blender -b -P art/blender/sky.py

Material: 'cloud' (the game gives it a soft glowing white).
"""

import math
import os
import sys

sys.path.append(os.path.dirname(__file__))
import garden_lib as g  # noqa: E402


def cloud(name, seed, length):
    """A row of chunky puffs, biggest in the middle, on a flat bottom."""
    g.reset()
    r = g.rng(seed)
    mat = g.material("cloud", (1, 1, 1, 1))
    parts = [g.block("base", (length * 2.2, 3.6, 1.6), (0, 0, 0.8), bevel=0.75, segments=2, mat=mat)]
    n = max(3, int(length))
    for i in range(n):
        t = i / (n - 1)
        x = (t - 0.5) * length * 2.0
        middle = 1 - abs(t - 0.5) * 2
        rad = 1.3 + middle * 1.4 + r.uniform(-0.2, 0.3)
        parts.append(g.blob(f"puff{i}", rad, (x, r.uniform(-0.5, 0.5), 1.0 + rad * 0.55), (0, 0, r.uniform(-0.4, 0.4)), squash=(1, 0.9, 0.85), subdiv=2, mat=mat, chunk=0.5))
    c = g.join(parts, name)
    g.preview(name, [c])
    g.export([c], name)


cloud("cloud_a", 1, 4)
cloud("cloud_b", 2, 6)
