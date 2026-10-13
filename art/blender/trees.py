"""Trees for the Psychedelic Garden: puff tree (replaces the oak), spiral tree (replaces the pine)
and the jungle tree. Run: Blender -b -P art/blender/trees.py

Materials: 'bark' (painted bark texture), 'foliage' (neutral leaf texture the game tints a
different bright color per tree), 'fruit' (glowing little fruits), 'vine'.
"""

import math
import os
import sys

sys.path.append(os.path.dirname(__file__))
import garden_lib as g  # noqa: E402

BARK = (0.75, 0.42, 0.2, 1)
FOLIAGE = (1.0, 0.3, 0.85, 1)
FRUIT = (1.0, 0.85, 0.2, 1)
VINE = (0.2, 0.7, 0.35, 1)


def puff_tree():
    """A chunky twisted trunk holding a cloud of puffy, beveled leaf blobs."""
    g.reset()
    r = g.rng(11)
    bark, foliage, fruit = g.material("bark", BARK), g.material("foliage", FOLIAGE), g.material("fruit", FRUIT)
    parts = []
    z = 0
    twist = 0
    for i, (w, h) in enumerate([(1.35, 1.5), (1.1, 1.5), (0.92, 1.4), (0.8, 1.3)]):
        twist += 0.28
        parts.append(g.block(f"trunk{i}", (w, w, h), (math.sin(i) * 0.08, 0, z + h / 2), (0, 0, twist), bevel=0.2, mat=bark, taper=(0.86, 0.86)))
        z += h * 0.92
    parts.append(g.block("flare", (2.0, 2.0, 0.7), (0, 0, 0.3), (0, 0, 0.5), bevel=0.3, mat=bark, taper=(0.6, 0.6)))
    for i, a in enumerate([0.6, 2.7, 4.6]):
        parts.append(g.block(f"branch{i}", (0.45, 0.45, 1.6), (math.cos(a) * 0.6, math.sin(a) * 0.6, z - 0.3), (0, 0.85, a), bevel=0.14, mat=bark))
    top = z + 1.7
    parts.append(g.blob("crown", 2.2, (0, 0, top), (0, 0, 0.3), squash=(1.0, 1.0, 0.85), subdiv=3, mat=foliage, chunk=0.48))
    for i in range(7):
        a = i * 2 * math.pi / 7 + r.uniform(-0.2, 0.2)
        rad = r.uniform(1.2, 1.55)
        lift = r.uniform(-0.9, 0.5)
        parts.append(g.blob(f"puff{i}", rad, (math.cos(a) * 2.0, math.sin(a) * 2.0, top + lift), (r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), a), subdiv=3, mat=foliage, chunk=0.48))
    parts.append(g.blob("crowntop", 1.35, (0.2, -0.1, top + 1.9), (0, 0, 0.8), subdiv=3, mat=foliage, chunk=0.48))
    for i in range(9):
        a = r.uniform(0, 2 * math.pi)
        e = r.uniform(-0.3, 0.9)
        p = (math.cos(a) * 2.75 * math.cos(e), math.sin(a) * 2.75 * math.cos(e), top + 1.8 * math.sin(e))
        parts.append(g.blob(f"fruit{i}", 0.3, p, (0.4, 0.4, a), subdiv=2, mat=fruit, chunk=0.48))
    tree = g.join(parts, "puff_tree")
    g.preview("puff_tree", [tree])
    g.export([tree], "puff_tree")


def spiral_tree():
    """Square leafy tiers that twist round as they climb, with a little glowing star on top."""
    g.reset()
    bark, foliage, fruit = g.material("bark", BARK), g.material("foliage", (0.2, 0.9, 0.8, 1)), g.material("fruit", FRUIT)
    parts = []
    z = 0
    for i, (w, h) in enumerate([(0.7, 1.6), (0.58, 1.5), (0.48, 1.4)]):
        parts.append(g.block(f"trunk{i}", (w, w, h), (0, 0, z + h / 2), (0, 0, i * 0.3), bevel=0.1, mat=bark, taper=(0.9, 0.9)))
        z += h * 0.95
    z -= 0.6
    tiers = 6
    for i in range(tiers):
        t = i / (tiers - 1)
        w = 4.4 - t * 3.3
        parts.append(g.block(f"tier{i}", (w, w, 0.95), (0, 0, z), (0.06 * (1 if i % 2 else -1), 0.06, 0.38 * i), bevel=0.32, segments=2, mat=foliage, taper=(0.78, 0.78)))
        z += 0.95
    parts.append(g.blob("star", 0.45, (0, 0, z + 0.2), (0.6, 0.6, 0.8), subdiv=2, mat=fruit, chunk=0.3))
    tree = g.join(parts, "spiral_tree")
    g.preview("spiral_tree", [tree])
    g.export([tree], "spiral_tree")


def jungle_tree():
    """A tall bendy trunk with big flat leaf pads drooping out of the top, and hanging vines."""
    g.reset()
    r = g.rng(23)
    bark, foliage, vine = g.material("bark", BARK), g.material("foliage", (0.3, 0.9, 0.3, 1)), g.material("vine", VINE)
    parts = []
    z = 0
    for i in range(7):
        h = 1.7
        x = math.sin(i * 0.7) * 0.45
        parts.append(g.block(f"trunk{i}", (0.8 - i * 0.05, 0.8 - i * 0.05, h), (x, 0, z + h / 2), (0, math.cos(i * 0.7) * 0.12, i * 0.2), bevel=0.12, mat=bark, taper=(0.92, 0.92)))
        z += h * 0.93
    top = z
    x_top = math.sin(6 * 0.7) * 0.45
    for i in range(6):
        a = i * math.pi / 3 + r.uniform(-0.2, 0.2)
        parts.append(g.blob(f"pad{i}", 1.6, (x_top + math.cos(a) * 1.9, math.sin(a) * 1.9, top - 0.3), (-math.sin(a) * 0.45, math.cos(a) * 0.45, a), squash=(1.5, 0.75, 0.28), subdiv=2, mat=foliage, chunk=0.4))
    parts.append(g.blob("padtop", 1.3, (x_top, 0, top + 0.4), (0, 0, 0.5), squash=(1.2, 1.2, 0.5), subdiv=2, mat=foliage))
    for i in range(7):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(1.8, 3.2)
        length = r.uniform(1.6, 3.4)
        parts.append(g.block(f"vine{i}", (0.16, 0.16, length), (x_top + math.cos(a) * d, math.sin(a) * d, top - 0.6 - length / 2), (r.uniform(-0.1, 0.1), r.uniform(-0.1, 0.1), 0), bevel=0.05, segments=1, mat=vine))
    tree = g.join(parts, "jungle_tree")
    g.preview("jungle_tree", [tree])
    g.export([tree], "jungle_tree")


puff_tree()
spiral_tree()
jungle_tree()
