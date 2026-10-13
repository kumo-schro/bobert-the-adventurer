"""Flowers, mushrooms, bushes, boulders and grass tufts for the Psychedelic Garden.
Run: Blender -b -P art/blender/plants.py

Materials: 'stem', 'petal' (neutral: the game tints each flower), 'flowercenter' (glows),
'cap' (mushroom cap, tinted), 'spot', 'foliage', 'rock' (stone texture), 'grass'.
"""

import math
import os
import sys

sys.path.append(os.path.dirname(__file__))
import garden_lib as g  # noqa: E402

STEM = (0.3, 0.8, 0.35, 1)
PETAL = (1.0, 0.45, 0.8, 1)
CENTER = (1.0, 0.85, 0.2, 1)


def daisy():
    g.reset()
    stem, petal, center = g.material("stem", STEM), g.material("petal", PETAL), g.material("flowercenter", CENTER)
    parts = [g.block("stem", (0.14, 0.14, 1.1), (0, 0, 0.55), bevel=0.04, segments=1, mat=stem)]
    parts.append(g.block("leaf", (0.5, 0.16, 0.06), (0.2, 0, 0.45), (0, -0.5, 0.3), bevel=0.03, segments=1, mat=stem))
    for i in range(7):
        a = i * 2 * math.pi / 7
        parts.append(g.block(f"petal{i}", (0.5, 0.24, 0.07), (math.cos(a) * 0.32, math.sin(a) * 0.32, 1.14), (0, -0.25, a), bevel=0.05, segments=1, mat=petal))
    parts.append(g.blob("center", 0.18, (0, 0, 1.16), subdiv=2, squash=(1, 1, 0.6), mat=center, chunk=0.45))
    flower = g.join(parts, "daisy")
    g.preview("daisy", [flower])
    g.export([flower], "daisy")


def tulip():
    g.reset()
    stem, petal = g.material("stem", STEM), g.material("petal", (0.6, 0.4, 1.0, 1))
    parts = [g.block("stem", (0.12, 0.12, 0.95), (0, 0, 0.47), bevel=0.04, segments=1, mat=stem)]
    for s in (-1, 1):
        parts.append(g.block(f"leaf{s}", (0.14, 0.06, 0.7), (s * 0.12, 0, 0.35), (0, s * 0.35, 0), bevel=0.03, segments=1, mat=stem))
    # A cup that widens at the top, with four pointy petal tips.
    parts.append(g.block("cup", (0.42, 0.42, 0.5), (0, 0, 1.15), (0, 0, math.pi / 4), bevel=0.12, segments=2, mat=petal, taper=(1.35, 1.35)))
    for i in range(4):
        a = i * math.pi / 2
        parts.append(g.block(f"tip{i}", (0.22, 0.1, 0.3), (math.cos(a) * 0.24, math.sin(a) * 0.24, 1.45), (math.sin(a) * 0.3, -math.cos(a) * 0.3, a + math.pi / 2), bevel=0.04, segments=1, mat=petal, taper=(0.2, 1.0)))
    flower = g.join(parts, "tulip")
    g.preview("tulip", [flower])
    g.export([flower], "tulip")


def mushroom():
    g.reset()
    stem, cap, spot = g.material("stem", (0.97, 0.93, 0.85, 1)), g.material("cap", (0.95, 0.25, 0.4, 1)), g.material("spot", (1, 1, 1, 1))
    parts = [g.block("stem", (0.55, 0.55, 1.2), (0, 0, 0.6), bevel=0.15, segments=2, mat=stem, taper=(0.8, 0.8))]
    parts.append(g.blob("cap", 0.9, (0, 0, 1.35), squash=(1, 1, 0.5), subdiv=3, mat=cap, chunk=0.48))
    r = g.rng(5)
    top = 1.35 + 0.45
    for i in range(5):
        a = i * 2 * math.pi / 5 + r.uniform(-0.3, 0.3)
        d = r.uniform(0.15, 0.5)
        parts.append(g.blob(f"spot{i}", 0.14, (math.cos(a) * d, math.sin(a) * d, top), (0, 0, a), squash=(1, 1, 0.35), subdiv=1, mat=spot, chunk=0.45))
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        parts.append(g.blob(f"side{i}", 0.12, (math.cos(a) * 0.9, math.sin(a) * 0.9, 1.4), (0, 0, a), squash=(0.4, 1, 1), subdiv=1, mat=spot, chunk=0.45))
    m = g.join(parts, "mushroom")
    g.preview("mushroom", [m])
    g.export([m], "mushroom")


def bush():
    g.reset()
    foliage, berry = g.material("foliage", (0.3, 0.85, 0.5, 1)), g.material("fruit", (1, 0.3, 0.45, 1))
    r = g.rng(9)
    parts = [g.blob("b0", 0.75, (0, 0, 0.6), subdiv=2, mat=foliage, chunk=0.48)]
    for i in range(3):
        a = i * 2.1
        parts.append(g.blob(f"b{i + 1}", 0.55, (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.45), (0, 0, a), subdiv=2, mat=foliage, chunk=0.48))
    for i in range(5):
        a = r.uniform(0, 2 * math.pi)
        parts.append(g.blob(f"berry{i}", 0.1, (math.cos(a) * 0.75, math.sin(a) * 0.75, r.uniform(0.4, 1.0)), subdiv=1, mat=berry, chunk=0.45))
    b = g.join(parts, "bush")
    g.preview("bush", [b])
    g.export([b], "bush")


def daisy_small():
    """Cheap daisy for scattering by the thousand: plain blocks (bevels don't show this small)."""
    g.reset()
    stem, petal, center = g.material("stem", STEM), g.material("petal", PETAL), g.material("flowercenter", CENTER)
    parts = [g.block("stem", (0.14, 0.14, 1.1), (0, 0, 0.55), bevel=0, mat=stem)]
    parts.append(g.block("leaf", (0.5, 0.16, 0.06), (0.2, 0, 0.45), (0, -0.5, 0.3), bevel=0, mat=stem))
    for i in range(3):
        a = i * math.pi / 3
        parts.append(g.block(f"petal{i}", (0.95, 0.26, 0.07), (0, 0, 1.14), (0, 0, a), bevel=0, mat=petal, taper=(1.0, 0.8)))
    parts.append(g.block("center", (0.3, 0.3, 0.16), (0, 0, 1.2), bevel=0, mat=center))
    flower = g.join(parts, "daisy_small")
    g.preview("daisy_small", [flower])
    g.export([flower], "daisy_small")


def tulip_small():
    g.reset()
    stem, petal = g.material("stem", STEM), g.material("petal", (0.6, 0.4, 1.0, 1))
    parts = [g.block("stem", (0.12, 0.12, 0.95), (0, 0, 0.47), bevel=0, mat=stem)]
    parts.append(g.block("leaf", (0.14, 0.06, 0.7), (0.12, 0, 0.35), (0, 0.35, 0), bevel=0, mat=stem))
    parts.append(g.block("cup", (0.42, 0.42, 0.5), (0, 0, 1.15), (0, 0, math.pi / 4), bevel=0, mat=petal, taper=(1.4, 1.4)))
    for i in range(2):
        a = i * math.pi / 2
        parts.append(g.block(f"tip{i}", (0.62, 0.14, 0.3), (0, 0, 1.45), (0, 0, a), bevel=0, mat=petal, taper=(1.1, 0.2)))
    flower = g.join(parts, "tulip_small")
    g.preview("tulip_small", [flower])
    g.export([flower], "tulip_small")


def boulder():
    """A chunky, faceted rock: big beveled blocks wedged together."""
    g.reset()
    rock = g.material("rock", (0.7, 0.65, 0.85, 1))
    parts = [
        g.block("r0", (1.6, 1.3, 1.0), (0, 0, 0.5), (0.1, -0.05, 0.3), bevel=0.25, mat=rock, taper=(0.75, 0.8)),
        g.block("r1", (0.9, 0.8, 0.7), (0.55, 0.35, 1.05), (0.2, 0.15, 0.9), bevel=0.2, mat=rock, taper=(0.7, 0.7)),
        g.block("r2", (0.7, 0.6, 0.5), (-0.7, -0.3, 0.3), (-0.2, 0.1, 0.4), bevel=0.16, mat=rock),
    ]
    b = g.join(parts, "boulder")
    g.preview("boulder", [b])
    g.export([b], "boulder")


def grass_tuft():
    """A little clump of chunky grass blades (thousands get scattered over the grass)."""
    g.reset()
    blade = g.material("grass", (0.4, 0.9, 0.3, 1))
    r = g.rng(3)
    parts = []
    for i in range(4):
        a = i * 2 * math.pi / 4 + r.uniform(-0.3, 0.3)
        h = r.uniform(0.35, 0.6)
        parts.append(g.block(f"blade{i}", (0.09, 0.05, h), (math.cos(a) * 0.08, math.sin(a) * 0.08, h / 2), (math.sin(a) * 0.35, -math.cos(a) * 0.35, a), bevel=0, mat=blade, taper=(0.3, 0.6)))
    t = g.join(parts, "grass_tuft")
    g.preview("grass_tuft", [t])
    g.export([t], "grass_tuft")


daisy()
tulip()
mushroom()
bush()
boulder()
grass_tuft()
daisy_small()
tulip_small()
