"""Style 6: Micro-Voxel HD. The game's current voxel look, but built from many much smaller cubes
(about 4x the detail of the in-game model): crisp little cubes on a visible grid, a slight
brightness wobble from cube to cube, baked corner shading (like Minecraft's smooth lighting),
messy cube-cluster hair and a pixel-art face painted in voxels on the front of the head.

How it works: every body part is a set of voxels (a dict of grid cell -> color) filled from simple
inside-tests (ellipsoids, rounded boxes) in the part's own frame, then painted (face pixels, laces,
stitching, buckles). Each part becomes ONE mesh made of only the exposed cube faces, with a color
attribute, parented to its pivot (legs, arms, head, hands, sword), so it can still be animated.
The material darkens and bevels each cube's edges in the shader (from object-space position),
so the grid reads without extra geometry.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/6_voxel.py
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "voxel"
V = 0.035  # voxel size in game units: Bobert is ~55 voxels tall
b.reset()


# ---------------------------------------------------------------------------------------------
# Voxel grids
# ---------------------------------------------------------------------------------------------

def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def shade(c, f):
    c = hexrgb(c) if isinstance(c, str) else c
    return tuple(min(1.0, max(0.0, x * f)) for x in c)


def hash01(i, j, k, seed=0):
    h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791) ^ (seed * 2654435761)
    h &= 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0x5BD1E995) & 0xFFFFFFFF
    h ^= h >> 15
    return (h & 0xFFFF) / 65535.0


# kind -> (brightness noise amplitude, material slot)
KINDS = {
    "skin": (0.035, 0), "cloth": (0.07, 0), "hair": (0.09, 0), "leather": (0.08, 0), "wood": (0.08, 0),
    "eye": (0.0, 2), "glow": (0.0, 3), "metal": (0.06, 1), "steel": (0.05, 1),
}


class Grid:
    """Voxels of one part, in that part's local frame. Cell (i, j, k) spans [i*V, (i+1)*V] etc."""

    def __init__(self, seed=0):
        self.v = {}
        self.seed = seed

    @staticmethod
    def center(i, j, k):
        return ((i + 0.5) * V, (j + 0.5) * V, (k + 0.5) * V)

    def cells(self, lo, hi):
        rng = [range(math.floor(lo[a] / V) - 1, math.ceil(hi[a] / V) + 1) for a in range(3)]
        for i in rng[0]:
            for j in rng[1]:
                for k in rng[2]:
                    yield i, j, k

    def fill(self, test, color, kind, lo, hi, only_empty=False):
        """Add voxels whose centers pass `test(x, y, z)`. color: hex, rgb or fn(x, y, z, key) -> rgb."""
        for key in self.cells(lo, hi):
            p = self.center(*key)
            if not test(*p):
                continue
            if only_empty and key in self.v:
                continue
            c = color(*p, key) if callable(color) else color
            self.v[key] = (hexrgb(c) if isinstance(c, str) else c, kind)

    def paint(self, test, color, kind=None):
        """Recolor existing voxels whose centers pass `test`."""
        for key, (c0, k0) in list(self.v.items()):
            p = self.center(*key)
            if test(*p):
                c = color(*p, key) if callable(color) else color
                self.v[key] = (hexrgb(c) if isinstance(c, str) else c, kind or k0)

    def put(self, key, color, kind):
        self.v[key] = (hexrgb(color) if isinstance(color, str) else color, kind)


# Inside-tests (all in game units, in the part's frame).
def ell(c, r):
    return lambda x, y, z: ((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2 <= 1


def sell(c, r, p=2.6):
    """Superellipsoid (a rounded box when p > 2)."""
    return lambda x, y, z: (abs((x - c[0]) / r[0]) ** p + abs((y - c[1]) / r[1]) ** p
                            + abs((z - c[2]) / r[2]) ** p) <= 1


def boxt(lo, hi):
    return lambda x, y, z: lo[0] <= x <= hi[0] and lo[1] <= y <= hi[1] and lo[2] <= z <= hi[2]


def cyl(c, rx, ry, z0, z1, p=2.0):
    """Vertical (super)elliptic cylinder."""
    return lambda x, y, z: z0 <= z <= z1 and abs((x - c[0]) / rx) ** p + abs((y - c[1]) / ry) ** p <= 1


# ---------------------------------------------------------------------------------------------
# Meshing: only exposed faces, per-corner colors with baked voxel ambient occlusion.
# ---------------------------------------------------------------------------------------------

AXES = [(1, 0, 0), (0, 1, 0), (0, 0, 1)]
DIRS = []
for a in range(3):
    for s in (1, -1):
        n = [0, 0, 0]
        n[a] = s
        # tangents t1, t2 with t1 x t2 = n
        b1, b2 = (a + 1) % 3, (a + 2) % 3
        t1, t2 = (AXES[b1], AXES[b2]) if s > 0 else (AXES[b2], AXES[b1])
        DIRS.append((tuple(n), t1, t2))
AO = (0.58, 0.74, 0.88, 1.0)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def build(grid, name, parent, mats):
    vox = grid.v
    verts, vindex, faces, cols, slots = [], {}, [], [], []

    def vid(p):
        i = vindex.get(p)
        if i is None:
            i = vindex[p] = len(verts)
            verts.append((p[0] * V, p[1] * V, p[2] * V))
        return i

    for (i, j, k), (rgb, kind) in vox.items():
        amp, slot = KINDS[kind]
        f = 1.0 + amp * (2 * hash01(i, j, k, grid.seed) - 1)
        base = [min(1.0, c * f) for c in rgb]
        for n, t1, t2 in DIRS:
            nb = (i + n[0], j + n[1], k + n[2])
            if nb in vox:
                continue
            o = [i + max(n[0], 0), j + max(n[1], 0), k + max(n[2], 0)]
            corner_ids, corner_cols = [], []
            for u, w in ((0, 0), (1, 0), (1, 1), (0, 1)):
                p = (o[0] + u * t1[0] + w * t2[0], o[1] + u * t1[1] + w * t2[1], o[2] + u * t1[2] + w * t2[2])
                corner_ids.append(vid(p))
                s1, s2 = (1 if u else -1), (1 if w else -1)
                side1 = (nb[0] + s1 * t1[0], nb[1] + s1 * t1[1], nb[2] + s1 * t1[2]) in vox
                side2 = (nb[0] + s2 * t2[0], nb[1] + s2 * t2[1], nb[2] + s2 * t2[2]) in vox
                corner = (nb[0] + s1 * t1[0] + s2 * t2[0], nb[1] + s1 * t1[1] + s2 * t2[1],
                          nb[2] + s1 * t1[2] + s2 * t2[2]) in vox
                ao = 0 if (side1 and side2) else 3 - (side1 + side2 + corner)
                g = AO[ao] if slot != 3 else 1.0
                corner_cols.append((*[srgb_to_lin(c * g) for c in base], 1.0))
            faces.append(corner_ids)
            cols.extend(corner_cols)
            slots.append(slot)

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    attr = mesh.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    attr.data.foreach_set("color", [c for col in cols for c in col])
    mesh.color_attributes.active_color = attr
    for m in mats:
        mesh.materials.append(m)
    mesh.polygons.foreach_set("material_index", slots)
    mesh.polygons.foreach_set("use_smooth", [False] * len(faces))
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections[b.COLLECTION].objects.link(obj)
    obj.parent = parent
    print(f"  {name}: {len(vox)} voxels, {len(faces)} faces")
    return obj


# ---------------------------------------------------------------------------------------------
# Material: vertex colors, with cube edges darkened and bevelled in the shader.
# ---------------------------------------------------------------------------------------------

def voxel_mat(name, roughness=0.62, metallic=0.0, emission=0.0, edge_dark=0.28, bevel=0.55):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    col = nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    tc = nodes.new("ShaderNodeTexCoord")

    def vmath(op, a, bb=None, value=None):
        n = nodes.new("ShaderNodeVectorMath")
        n.operation = op
        links.new(a, n.inputs[0])
        if bb is not None:
            if isinstance(bb, (tuple, list)):
                n.inputs[1].default_value = bb
            else:
                links.new(bb, n.inputs[1])
        if value is not None:
            n.inputs[3].default_value = value
        return n.outputs[1] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs[0]

    def fmath(op, a, bb):
        n = nodes.new("ShaderNodeMath")
        n.operation = op
        for idx, v in enumerate((a, bb)):
            if isinstance(v, (int, float)):
                n.inputs[idx].default_value = v
            else:
                links.new(v, n.inputs[idx])
        return n.outputs[0]

    # Position inside the cell: d in -1..1 per axis (+-1 at the cube's edges).
    cell = vmath("SCALE", tc.outputs["Object"], value=1.0 / V)
    frac = vmath("FRACTION", cell)
    d = vmath("MULTIPLY_ADD", frac, (2, 2, 2))
    d.node.inputs[2].default_value = (-1, -1, -1)
    dabs = vmath("ABSOLUTE", d)
    # Ignore the axis along the face normal.
    nabs = vmath("ABSOLUTE", tc.outputs["Normal"])
    mask = vmath("SUBTRACT", nabs, None)
    mask.node.inputs[0].default_value = (1, 1, 1)
    links.new(nabs, mask.node.inputs[1])
    ramp = nodes.new("ShaderNodeMapRange")
    ramp.data_type = "FLOAT_VECTOR"
    ramp.interpolation_type = "SMOOTHSTEP"
    links.new(dabs, ramp.inputs["Vector"])
    ramp.inputs[7].default_value = (0.72, 0.72, 0.72)  # From Min (vector)
    ramp.inputs[8].default_value = (1.0, 1.0, 1.0)  # From Max (vector)
    ramp.inputs[9].default_value = (0, 0, 0)
    ramp.inputs[10].default_value = (1, 1, 1)
    edge_v = vmath("MULTIPLY", ramp.outputs["Vector"], mask)
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(edge_v, sep.inputs[0])
    edge = fmath("MAXIMUM", fmath("MAXIMUM", sep.outputs[0], sep.outputs[1]), sep.outputs[2])

    # Base color = vertex color darkened at the edges.
    darken = fmath("MULTIPLY_ADD", edge, -edge_dark)
    darken.node.inputs[2].default_value = 1.0
    colv = vmath("SCALE", col.outputs["Color"], None)
    links.new(darken, colv.node.inputs[3])
    links.new(colv, bsdf.inputs["Base Color"])

    # Fake bevel: tilt the normal toward the edge it's near.
    sign = vmath("SIGN", d)
    tilt = vmath("MULTIPLY", edge_v, sign)
    nrm = vmath("ADD", tc.outputs["Normal"], vmath("SCALE", tilt, value=bevel))
    nrm = vmath("NORMALIZE", nrm)
    xf = nodes.new("ShaderNodeVectorTransform")
    xf.vector_type = "NORMAL"
    xf.convert_from = "OBJECT"
    xf.convert_to = "WORLD"
    links.new(nrm, xf.inputs[0])
    links.new(xf.outputs[0], bsdf.inputs["Normal"])

    if emission:
        links.new(col.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emission
    return m


MATS = [
    voxel_mat("VoxMatte", roughness=0.66),
    voxel_mat("VoxMetal", roughness=0.5, metallic=0.3),
    voxel_mat("VoxEye", roughness=0.25, edge_dark=0.12),
    voxel_mat("VoxGlow", roughness=0.2, emission=0.9, edge_dark=0.0),
]

# ---------------------------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------------------------
SKIN = "#ffcc99"
SKIN_SHADE = "#f2b483"
HAIR = ["#4e2a14", "#6b3e1f", "#7f4b27", "#9a6238"]
SHIRT = "#ff4f6d"
SHIRT_DARK = "#d83a57"
SHIRT_LIGHT = "#ff6b84"
PANTS = "#3d5afe"
PANTS_DARK = "#3047d6"
BOOT = "#6a3d22"
BOOT_DARK = "#4a2c1a"
BOOT_CUFF = "#865231"
SOLE = "#2e1a10"
LEATHER = "#8a5a35"
LEATHER_DARK = "#5e3a20"
STITCH = "#c99766"
GOLD = "#f2c14e"
GOLD_DARK = "#c4912e"
WOOD = "#8a5530"
STEEL = "#a9b5c3"
STEEL_EDGE = "#ccd6e1"
STEEL_DARK = "#7f8ea2"

root = b.pivot("Bobert")

# ---------------------------------------------------------------------------------------------
# Legs (pivot at the hip; the floor is at local z = -0.77)
# ---------------------------------------------------------------------------------------------
for side, nm in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{nm}", (side * 4 * V, 0, 22 * V), parent=root)
    g = Grid(seed=11 if side > 0 else 12)
    # Trousers, slightly tapered, with a darker crease at the knee.
    g.fill(cyl((0, 0, 0), 0.12, 0.125, -0.47, 0.05, p=2.4),
           lambda x, y, z, key: PANTS_DARK if -0.29 < z < -0.25 and y < -0.05 else PANTS, "cloth",
           (-0.15, -0.15, -0.5), (0.15, 0.15, 0.08))
    # Boot shaft
    g.fill(cyl((0, 0.005, 0), 0.115, 0.13, -0.72, -0.44, p=2.4), BOOT, "leather", (-0.2, -0.2, -0.8), (0.2, 0.2, -0.4))
    # Folded cuff, lighter, with a stitched lower edge.
    g.fill(cyl((0, 0.005, 0), 0.16, 0.16, -0.47, -0.395, p=2.6),
           lambda x, y, z, key: STITCH if (z < -0.45 and key[0] % 2 == 0) else BOOT_CUFF, "leather",
           (-0.2, -0.2, -0.5), (0.2, 0.2, -0.38))
    # Strap around the ankle with a gold buckle on the outside front.
    g.fill(cyl((0, 0.005, 0), 0.15, 0.16, -0.63, -0.565, p=2.6), LEATHER, "leather", (-0.2, -0.2, -0.7), (0.2, 0.2, -0.5))
    g.paint(lambda x, y, z: -0.63 <= z <= -0.565 and y < -0.09 and (side * x) > 0.02 and (side * x) < 0.1,
            lambda x, y, z, key: GOLD_DARK if abs(side * x - 0.06) < 0.02 and z > -0.6 else GOLD, "metal")
    # Foot with a rounded toe, and a dark sole.
    g.fill(lambda x, y, z: -0.77 <= z <= -0.63 and (abs(x / 0.14) ** 2.4 + abs((y + 0.07) / 0.215) ** 2.4) <= 1
           and not (y < -0.21 and z > -0.67), BOOT, "leather", (-0.2, -0.32, -0.8), (0.2, 0.2, -0.6))
    g.paint(lambda x, y, z: z < -0.735, SOLE, "leather")
    g.paint(lambda x, y, z: -0.735 < z < -0.70 and y < -0.05, BOOT_DARK)
    build(g, f"Leg{nm}Vox", leg, MATS)

# ---------------------------------------------------------------------------------------------
# Body: tunic, collar with laces, belt, round buckle, pouch
# ---------------------------------------------------------------------------------------------
body = b.pivot("Body", (0, 0, 0), parent=root)
g = Grid(seed=21)


def tunic_r(z):
    """Half-width and half-depth of the tunic at height z: a flared hem, rounded shoulders."""
    rx = 0.275 + max(0.0, 0.72 - z) * 0.18
    ry = 0.185 + max(0.0, 0.72 - z) * 0.1
    if z > 1.02:
        t = min(1.0, (z - 1.02) / 0.17)
        k = math.sqrt(max(0.0, 1 - t * t))
        rx = 0.12 + (rx - 0.12) * k
        ry = 0.1 + (ry - 0.1) * k
    return rx, ry


def in_tunic(x, y, z, grow=0.0):
    if not 0.59 <= z <= 1.19:
        return False
    rx, ry = tunic_r(z)
    return abs(x / (rx + grow)) ** 2.6 + abs((y - 0.005) / (ry + grow)) ** 2.6 <= 1


def tunic_color(x, y, z, key):
    if z < 0.625:
        return SHIRT_DARK  # hem band
    if abs(z - 0.73) < 0.02 and key[0] % 3 == 0:
        return SHIRT_LIGHT
    return SHIRT


g.fill(in_tunic, tunic_color, "cloth", (-0.4, -0.3, 0.55), (0.4, 0.3, 1.22))
# Front slit below the belt
g.paint(lambda x, y, z: y < -0.13 and abs(x) < 0.02 and 0.59 < z < 0.74, SHIRT_DARK)


# V-neck: skin showing, a darker trim around it, crossed brown laces.
def vneck(x, y, z):
    return y < -0.05 and z > 1.0 and abs(x) < (z - 1.0) * 0.75


g.paint(lambda x, y, z: vneck(x, y, z) and z > 1.02, SKIN, "skin")
g.paint(lambda x, y, z: y < -0.05 and z > 0.985 and not vneck(x, y, z) and abs(x) < (z - 0.985) * 0.75 + 0.04,
        SHIRT_DARK, "cloth")
LACES = {(-1, 30), (0, 30), (-2, 31), (1, 31), (-1, 32), (0, 32), (-3, 33), (2, 33)}
g.paint(lambda x, y, z: y < -0.05 and (math.floor(x / V), math.floor(z / V)) in LACES, LEATHER, "leather")
# A back collar band
g.paint(lambda x, y, z: z > 1.155 and y > -0.02, SHIRT_DARK, "cloth")


# Belt: one voxel proud of the tunic, stitched along the middle.
def belt_color(x, y, z, key):
    if key[2] == 24 and key[0] % 2 == 0:
        return STITCH
    return LEATHER if key[2] != 23 else shade(LEATHER, 0.88)


g.fill(lambda x, y, z: 0.805 <= z <= 0.91 and in_tunic(x, y, z, V), belt_color, "leather",
       (-0.4, -0.3, 0.78), (0.4, 0.3, 0.93))

# Round gold buckle (a ring), proud of the belt.
front = min(j for (i, j, k) in g.v if k == 24 and i in (-1, 0))
bz = 24.5 * V
for i in range(-4, 4):
    for k in range(21, 28):
        cx, cz = (i + 0.5) * V, (k + 0.5) * V - bz
        r = math.hypot(cx, cz)
        if 0.04 <= r <= 0.1:
            for j in (front - 1, front):
                g.put((i, j, k), GOLD if cz - cx * 0.4 > -0.02 else GOLD_DARK, "metal")

# Pouch hanging off the belt on his left hip, with a dark flap and a gold stud.
g.fill(boxt((0.14, -0.245, 0.665), (0.28, -0.1, 0.805)),
       lambda x, y, z, key: BOOT_DARK if z > 0.76 or (y < -0.2 and z > 0.73) else LEATHER, "leather",
       (0.1, -0.3, 0.6), (0.3, 0, 0.85))
g.paint(lambda x, y, z: 0.16 < x < 0.26 and y < -0.2 and 0.7 < z < 0.735 and abs(x - 0.21) < 0.02, GOLD, "metal")
g.paint(lambda x, y, z: 0.665 <= z <= 0.7 and 0.14 < x < 0.28 and y < -0.09, shade(LEATHER, 0.8))
build(g, "BodyVox", body, MATS)


# ---------------------------------------------------------------------------------------------
# Arms: puffy sleeve with a rolled cuff, forearm, fist with knuckles and a thumb
# ---------------------------------------------------------------------------------------------
def make_arm(side, nm, swing, spread):
    arm = b.pivot(f"Arm{nm}", (side * 9 * V, 0, 31 * V), parent=root, rotation=(swing, side * -spread, 0))
    g = Grid(seed=31 if side > 0 else 32)
    g.fill(ell((0, 0, -0.07), (0.115, 0.115, 0.16)), SHIRT, "cloth", (-0.2, -0.2, -0.3), (0.2, 0.2, 0.15))
    g.fill(cyl((0, 0, 0), 0.125, 0.125, -0.25, -0.19), SHIRT_DARK, "cloth", (-0.2, -0.2, -0.3), (0.2, 0.2, -0.1))
    g.fill(cyl((0, 0, 0), 0.075, 0.075, -0.42, -0.2), SKIN, "skin", (-0.15, -0.15, -0.5), (0.15, 0.15, -0.1),
           only_empty=True)
    hand = b.pivot(f"Hand{nm}", (0, 0, -0.475), parent=arm)
    h = Grid(seed=41 if side > 0 else 42)
    # Fist: a rounded box; knuckle rows on the front, a thumb on the inner front.
    h.fill(sell((0, 0, 0), (0.095, 0.1, 0.095), p=2.4),
           lambda x, y, z, key: SKIN_SHADE if (y < -0.05 and key[2] % 2 == 0 and z < 0.05) else SKIN, "skin",
           (-0.15, -0.15, -0.15), (0.15, 0.15, 0.15))
    h.fill(boxt((-0.035 if side > 0 else -0.035, -0.14, 0.0), (0.035, -0.07, 0.07)), SKIN, "skin",
           (-0.1, -0.2, -0.05), (0.1, 0, 0.1))
    build(g, f"Arm{nm}Vox", arm, MATS)
    build(h, f"Hand{nm}Vox", hand, MATS)
    return arm, hand


arm_l, hand_l = make_arm(1, "L", 0.05, 0.2)
arm_r, hand_r = make_arm(-1, "R", -0.12, 0.26)

# ---------------------------------------------------------------------------------------------
# Sword, held in the right fist, pointing down, forward and out.
# ---------------------------------------------------------------------------------------------
direction = Vector((-0.2, -0.42, -0.88)).normalized()
sword = b.pivot("Sword", (0, 0, 0), parent=hand_r, rotation=tuple(direction.to_track_quat("Z", "Y").to_euler()))
s = Grid(seed=51)
# Grip: wood with leather wraps
s.fill(boxt((-V, -V, -4 * V), (V, V, 3 * V)),
       lambda x, y, z, key: LEATHER_DARK if key[2] % 2 == 0 else WOOD, "wood", (-0.1, -0.1, -0.15), (0.1, 0.1, 0.15))
# Pommel
s.fill(lambda x, y, z: -6 * V <= z <= -4 * V and abs(x) < 1.6 * V and abs(y) < 1.6 * V and
       not (abs(x) > V and abs(y) > V), GOLD, "metal", (-0.1, -0.1, -0.3), (0.1, 0.1, -0.05))
# Cross guard with upturned ends
s.fill(lambda x, y, z: (3 * V <= z <= 5 * V and abs(x) <= 4 * V and abs(y) <= V) or
       (5 * V <= z <= 6 * V and 3 * V <= abs(x) <= 4 * V and abs(y) <= V),
       lambda x, y, z, key: GOLD_DARK if abs(x) > 3 * V or key[2] == 3 else GOLD, "metal",
       (-0.2, -0.1, 0.05), (0.2, 0.1, 0.25))


def blade_half(z):
    """Half-width of the blade at height z (in voxels): straight, then a stepped point."""
    tip = 21 * V
    if z > tip:
        return -1
    if z > tip - 2 * V:
        return 0.5 * V
    if z > tip - 4 * V:
        return 1.2 * V
    return 2 * V


def blade_color(x, y, z, key):
    if abs(x) > V:
        return STEEL_EDGE
    if abs(x) < V and z < 16 * V:
        return STEEL_DARK if key[0] == -1 else STEEL
    return STEEL


s.fill(lambda x, y, z: 5 * V <= z and abs(x) <= blade_half(z) and abs(y) <= (V if abs(x) < V else 0.5 * V),
       blade_color, "steel", (-0.1, -0.1, 0.15), (0.1, 0.1, 0.8))
build(s, "SwordVox", sword, MATS)

# ---------------------------------------------------------------------------------------------
# Head: a rounded-box head with a pixel-art face, ears, and messy cube-cluster hair.
# ---------------------------------------------------------------------------------------------
head = b.pivot("Head", (0, 0, 33 * V), parent=root)
g = Grid(seed=61)
HC = (0, 0, 10 * V)
HR = (0.36, 0.31, 0.32)
g.fill(sell(HC, HR, p=2.6), SKIN, "skin", (-0.45, -0.4, -0.1), (0.45, 0.4, 0.8))
g.fill(cyl((0, 0.01, 0), 0.085, 0.08, -0.07, 0.1), SKIN_SHADE, "skin", (-0.15, -0.15, -0.1), (0.15, 0.15, 0.12))
# Ears with a pink inside
for sd in (1, -1):
    g.fill(ell((sd * 0.36, 0.03, 0.33), (0.06, 0.06, 0.085)),
           lambda x, y, z, key: "#f4a98c" if abs(x) > 0.38 and y < 0.05 and abs(z - 0.33) < 0.05 else SKIN, "skin",
           (-0.5, -0.2, 0.2), (0.5, 0.2, 0.45), only_empty=False)

# Pixel face. Columns i = -11..10 (as seen from the front, left to right); rows are voxel k.
FACE_COLORS = {
    "k": ("#2a1a10", "eye"), "w": ("#ffffff", "eye"), "h": ("#ffffff", "eye"), "p": ("#24140c", "eye"),
    "i": ("#6e4426", "eye"), "j": ("#a3703c", "eye"), "b": ("#4a2a14", "hair"), "n": ("#f7ad86", "skin"),
    "c": ("#ff9aa8", "skin"), "m": ("#8e3b30", "skin"),
}
FACE = {}  # (column, k) -> code
EYE = [".pp.", "phpp", "phpp", "pppp", "ijji"]  # big dark eyes, highlight top-left in both
for r, row in enumerate(EYE):
    for c in range(4):
        FACE[(5 + c, 12 - r)] = row[c]
        FACE[(13 + c, 12 - r)] = row[c]
for c in (5, 6, 7, 8, 13, 14, 15, 16):
    FACE[(c, 14)] = "b"
for c in (3, 4, 5, 16, 17, 18):
    FACE[(c, 5)] = "c"
    FACE[(c, 4)] = "c"
FACE[(10, 6)] = FACE[(11, 6)] = "n"
FACE[(8, 4)] = FACE[(13, 4)] = "m"
for c in (9, 10, 11, 12):
    FACE[(c, 3)] = "m"
EXTRUDE = {"b", "n"}


# Hair: a shell a bit bigger than the head, above a hairline that's high at the front (a fringe
# over the forehead), lower at the sides and lowest at the back, plus scattered cube clusters.
HSC = (0, 0.025, 10.5 * V)
HSR = (0.405, 0.37, 0.355)


def hairline(x, y, z):
    yn = (y - HSC[1]) / HSR[1]
    if yn < 0:
        cut = 0.40 + 0.16 * min(1.0, -yn * 1.5)
    else:
        cut = 0.40 - 0.3 * min(1.0, yn * 1.3)
    # temples / sideburns come down a little lower at the sides
    if abs(x) > 0.3 and yn > -0.75:
        cut -= 0.05
    return cut


def hair_shade(x, y, z, key):
    t = hash01(key[0] // 2, key[1] // 2, key[2] // 2, 7)
    idx = 1 + (1 if t > 0.6 else 0) - (1 if t < 0.2 else 0)
    if z > 0.6:
        idx = min(3, idx + 1)
    return HAIR[idx]


in_shell = sell(HSC, HSR, p=2.3)
jag = lambda key: (hash01(key[0], 0, 0, 3) - 0.5) * 2 * V  # noqa: E731
g.fill(lambda x, y, z: in_shell(x, y, z) and z > hairline(x, y, z) + jag((math.floor(x / V),)),
       hair_shade, "hair", (-0.5, -0.45, 0.0), (0.5, 0.45, 0.8))

# Messy clumps: little blocks of 2-3 cubes poking out of the hair.
r = b.rng(5)
placed = 0
for _ in range(400):
    if placed >= 150:
        break
    az = r.uniform(-math.pi, math.pi)
    el = math.asin(r.uniform(-0.25, 1.0))
    dvec = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    # Walk outward to the shell surface.
    t = 0.2
    while in_shell(HSC[0] + dvec.x * t, HSC[1] + dvec.y * t, HSC[2] + dvec.z * t) and t < 0.6:
        t += 0.01
    p = Vector(HSC) + dvec * (t + r.uniform(0.0, 0.06))
    if p.z < hairline(p.x, p.y, p.z) + 0.04:
        continue
    if p.y < -0.18 and p.z < 0.63:  # keep the brows and eyes clear
        continue
    sx, sy, sz = r.choice((2, 2, 3, 3)), r.choice((2, 2, 3, 3)), r.choice((2, 3, 3, 4))
    i0, j0, k0 = math.floor(p.x / V) - sx // 2, math.floor(p.y / V) - sy // 2, math.floor(p.z / V) - sz // 2
    # Lift tufts so they spill outward and upward, never into the face.
    col = HAIR[r.choice((0, 1, 1, 2, 2, 3))]
    if p.z > 0.62:
        col = HAIR[r.choice((1, 2, 3, 3))]
    for i in range(i0, i0 + sx):
        for j in range(j0, j0 + sy):
            for k in range(k0, k0 + sz):
                if j < -8 and k < 16:
                    continue
                g.put((i, j, k), col, "hair")
    placed += 1

# Fringe tufts hanging over the forehead (stopping above the brows).
for (i0, k0, w, hgt) in ((-10, 16, 3, 2), (-7, 16, 3, 3), (-4, 17, 3, 2), (-1, 16, 3, 3), (2, 17, 3, 2),
                         (5, 16, 3, 3), (8, 16, 2, 2), (-11, 12, 2, 5), (9, 12, 2, 5)):
    for i in range(i0, i0 + w):
        for k in range(k0, k0 + hgt):
            js = [j for (ii, j, kk) in g.v if ii == i and kk == k]
            if not js:
                continue
            g.put((i, min(js) - 1, k), HAIR[1 if (i + k) % 3 else 2], "hair")

# Paint the face on the frontmost skin voxel of each column.
for (c, k), code in FACE.items():
    if code == ".":
        continue
    i = c - 11
    js = [j for (ii, j, kk) in g.v if ii == i and kk == k]
    if not js:
        continue
    j = min(js)
    if g.v[(i, j, k)][1] == "hair":
        continue
    color, kind = FACE_COLORS[code]
    g.put((i, j, k), color, kind)
    if code in EXTRUDE:
        g.put((i, j - 1, k), color, kind)
build(g, "HeadVox", head, MATS)

# ---------------------------------------------------------------------------------------------
# Studio: pale sky, a grassy tiled floor.
# ---------------------------------------------------------------------------------------------
b.studio(background="#d9eefa", ground="#8fd16a", view="Standard", key=3.0, fill=1.0, rim=2.6, sun=2.4)
fm = bpy.data.materials["Floor"]
nodes, links = fm.node_tree.nodes, fm.node_tree.links
bsdf = nodes.get("Principled BSDF")
tc = nodes.new("ShaderNodeTexCoord")
sc = nodes.new("ShaderNodeVectorMath")
sc.operation = "SCALE"
sc.inputs[3].default_value = 1 / (8 * V)
links.new(tc.outputs["Object"], sc.inputs[0])
fl = nodes.new("ShaderNodeVectorMath")
fl.operation = "FLOOR"
links.new(sc.outputs[0], fl.inputs[0])
wn = nodes.new("ShaderNodeTexWhiteNoise")
wn.noise_dimensions = "3D"
links.new(fl.outputs[0], wn.inputs["Vector"])
cr = nodes.new("ShaderNodeValToRGB")
cr.color_ramp.elements[0].color = b.rgba("#8acb67")
cr.color_ramp.elements[1].color = b.rgba("#9ad574")
links.new(wn.outputs["Value"], cr.inputs[0])
links.new(cr.outputs[0], bsdf.inputs["Base Color"])

b.render_all(ID)
b.export(ID)
# Export again with the voxel colors (the material reads them through shader math, which the
# glTF exporter doesn't trace, so it needs to be told to include the active color attribute).
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.collections[b.COLLECTION].all_objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(b.MODELS, ID + ".glb"), export_format="GLB", use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False, export_vertex_color="ACTIVE")
print("EXPORTED with vertex colors")
