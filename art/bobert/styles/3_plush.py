"""Style 3: Knitted Plush. Bobert as a handmade knitted toy: soft stuffed shapes, knitted yarn skin
and clothes, felt boots, belt and sword, shiny black button eyes, a stitched yarn smile, twisted-yarn
hair and little running stitches along every seam and hem.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/3_plush.py
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Quaternion, Vector

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "plush"
b.reset()
R = b.rng(11)

KNIT = b.texture(ID, "knit")
FELT = b.texture(ID, "felt")


# ---- Materials ----

def fuzz(m, color, sheen):
    """Soft fibre fuzz: a sheen tinted with the yarn's own color (white sheen looks dusty)."""
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bsdf.inputs["Sheen Roughness"].default_value = 0.4
    bsdf.inputs["Sheen Tint"].default_value = tuple(min(1.0, c * 1.4 + 0.08) for c in b.rgba(color)[:3]) + (1.0,)
    return m


def knit(name, color, scale=3.2, bump=0.45, sheen=0.45):
    return fuzz(b.mat(name, color, roughness=0.9, image=KNIT, image_scale=scale, bump=bump), color, sheen)


def felt(name, color, scale=2.2, bump=0.3, sheen=0.5):
    return fuzz(b.mat(name, color, roughness=0.95, image=FELT, image_scale=scale, bump=bump), color, sheen)


def yarn(name, color, plies=3, twist=34.0, depth=0.35):
    """Twisted yarn for tubes made with yarn_tube (which have UVs: u = length, v = around).
    Spiral grooves (as bump and a little darkening) make each strand look plied."""
    m = fuzz(b.mat(name, color, roughness=0.88), color, 0.5)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    uv = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(uv.outputs["UV"], sep.inputs[0])
    mu = nodes.new("ShaderNodeMath")
    mu.operation = "MULTIPLY"
    mu.inputs[1].default_value = twist
    links.new(sep.outputs["X"], mu.inputs[0])
    mv = nodes.new("ShaderNodeMath")
    mv.operation = "MULTIPLY"
    mv.inputs[1].default_value = float(plies)
    links.new(sep.outputs["Y"], mv.inputs[0])
    add = nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    links.new(mu.outputs[0], add.inputs[0])
    links.new(mv.outputs[0], add.inputs[1])
    frac = nodes.new("ShaderNodeMath")
    frac.operation = "PINGPONG"
    frac.inputs[1].default_value = 0.5
    links.new(add.outputs[0], frac.inputs[0])
    smooth = nodes.new("ShaderNodeMath")
    smooth.operation = "SQRT"
    links.new(frac.outputs[0], smooth.inputs[0])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    bump.inputs["Distance"].default_value = 0.004
    links.new(smooth.outputs[0], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = depth
    mix.inputs["A"].default_value = b.rgba(color)
    shade = nodes.new("ShaderNodeMapRange")
    shade.inputs["From Min"].default_value = 0.0
    shade.inputs["From Max"].default_value = 0.7
    links.new(smooth.outputs[0], shade.inputs[0])
    links.new(shade.outputs[0], mix.inputs["B"])
    links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return m


skin = knit("Skin", "#ffd9b0", scale=3.6, bump=0.35)
skin_dark = knit("SkinShade", "#f2b48c", scale=3.6, bump=0.35)
nose_m = knit("Nose", "#f7a184", scale=5.0, bump=0.3)
shirt = knit("Tunic", "#ff5a73", scale=3.0)
shirt_rib = knit("TunicRib", "#e8445f", scale=4.5, bump=0.6)
pants = knit("Trousers", "#4f6bff", scale=3.0)
boots = knit("Boots", "#5a3421", scale=3.4, bump=0.55)
boot_cuff = knit("BootCuff", "#6b3f27", scale=4.2, bump=0.6)
sole = felt("Sole", "#3b2216", scale=2.5)
belt_m = felt("Belt", "#7c4a2b", scale=2.4)
pouch_m = felt("Pouch", "#8a5532", scale=2.4)
flap_m = felt("PouchFlap", "#6e4027", scale=2.4)
blade_m = felt("Blade", "#a4a9b2", scale=2.0, bump=0.35)
grip_m = felt("Grip", "#a8743f", scale=3.0)
cheek_m = felt("Cheek", "#ff8c99", scale=3.0, bump=0.2)
hair_cap = knit("HairCap", "#7a4724", scale=4.0, bump=0.6)
hair_m = yarn("HairYarn", "#804b26")
thread = yarn("Thread", "#f6e6c4", twist=60, depth=0.25)
dark_thread = yarn("DarkThread", "#3a2214", twist=60, depth=0.25)
guard_yarn = yarn("GuardYarn", "#7a4a28", twist=40)
brass = b.mat("Brass", "#d9a441", roughness=0.35, metallic=0.75)
button_eye = b.mat("ButtonEye", "#0b0909", roughness=0.08, coat=1.0)
wood_button = b.mat("WoodButton", "#8a5630", roughness=0.45, coat=0.4)
hole_m = b.mat("ButtonHole", "#2b170d", roughness=0.8)


# ---- Helpers (this style only) ----

def catmull(ctrl, per=4):
    """Smooth curve through control points (Vectors of any size), `per` samples per segment."""
    P = [ctrl[0]] + list(ctrl) + [ctrl[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    out.append(ctrl[-1])
    return out


def soft_profile(ctrl, per=5):
    """A smooth lathe profile [(r, z), ...] through control points (for b.from_points)."""
    return [tuple(v) for v in catmull([Vector(c) for c in ctrl], per)]


def resample(pts, step):
    """Points evenly spaced along a polyline."""
    out = [pts[0]]
    carry = 0.0
    for a, c in zip(pts, pts[1:]):
        seg = (c - a).length
        d = step - carry
        while d <= seg:
            out.append(a + (c - a) * (d / seg))
            d += step
        carry = seg - (d - step)
    if (out[-1] - pts[-1]).length > step * 0.3:
        out.append(pts[-1])
    else:
        out[-1] = pts[-1]
    return out


class Bundle:
    """Many small pieces merged into one mesh (stitches, yarn strands) to keep the object count low."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")

    def dash(self, p0, p1, r=0.0065, flat=0.6):
        """One stitch: a little stretched bead of thread from p0 to p1."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        half = d.length / 2
        geom = bmesh.ops.create_uvsphere(self.bm, u_segments=6, v_segments=3, radius=1.0)
        q = d.normalized().to_track_quat("Z", "Y").to_matrix()
        mid = (p0 + p1) / 2
        for v in geom["verts"]:
            local = Vector((v.co.x * r, v.co.y * r * flat, v.co.z * (half + r * 0.5)))
            v.co = mid + q @ local

    def tube(self, ctrl, r0, r1, around=8, step=0.02, tip=0.8):
        """A yarn strand along control points, tapering from r0 to r1, with rounded ends and UVs."""
        pts = resample(catmull([Vector(c) for c in ctrl], 6), step)
        n = len(pts)
        tang = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
        ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = tang[0].cross(ref).normalized()
        lengths = [0.0]
        for a, c in zip(pts, pts[1:]):
            lengths.append(lengths[-1] + (c - a).length)
        total = max(lengths[-1], 1e-6)
        rings = []
        for i, p in enumerate(pts):
            t = tang[i]
            nrm = (nrm - t * nrm.dot(t)).normalized()
            bi = t.cross(nrm)
            rr = r0 + (r1 - r0) * lengths[i] / total
            rings.append([self.bm.verts.new(p + (nrm * math.cos(a) + bi * math.sin(a)) * rr)
                          for a in (2 * math.pi * j / around for j in range(around))])
        uvl = self.uv
        for i in range(n - 1):
            for j in range(around):
                j2 = (j + 1) % around
                f = self.bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
                for loop, (u, v) in zip(f.loops, ((lengths[i], j / around), (lengths[i], (j + 1) / around),
                                                   (lengths[i + 1], (j + 1) / around),
                                                   (lengths[i + 1], j / around))):
                    loop[uvl].uv = (u, v)
        end = self.bm.verts.new(pts[-1] + tang[-1] * r1 * tip)
        start = self.bm.verts.new(pts[0] - tang[0] * r0 * 0.6)
        for j in range(around):
            j2 = (j + 1) % around
            f = self.bm.faces.new((rings[-1][j], rings[-1][j2], end))
            for loop in f.loops:
                loop[uvl].uv = (total, j / around)
            f = self.bm.faces.new((rings[0][j2], rings[0][j], start))
            for loop in f.loops:
                loop[uvl].uv = (0, j / around)

    def ring(self, center, rx, ry, count, frac=0.55, r=0.0065, start=0.0, arc=2 * math.pi, push=0.0):
        """Running stitches around an ellipse (a hem or cuff) in the XY plane at center."""
        cx, cy, cz = center
        for i in range(count):
            a0 = start + arc * i / count
            a1 = a0 + arc / count * frac
            p0 = (cx + (rx + push) * math.cos(a0), cy + (ry + push) * math.sin(a0), cz)
            p1 = (cx + (rx + push) * math.cos(a1), cy + (ry + push) * math.sin(a1), cz)
            self.dash(p0, p1, r)

    def running(self, pts, gap=0.045, frac=0.55, r=0.0065):
        """Running stitches along a polyline (list of 3-tuples)."""
        pts = resample([Vector(p) for p in pts], gap * frac)
        for i in range(0, len(pts) - 1, 2):
            if (pts[i + 1] - pts[i]).length > 1e-4:
                self.dash(pts[i], pts[i + 1], r)

    def build(self, name, material, parent=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        return b._mesh_object(name, self.bm, (0, 0, 0), (0, 0, 0), material, parent, True)


def lumpy(obj, strength=0.008, size=0.25):
    """A little handmade unevenness (stuffing that isn't perfectly smooth)."""
    tex = bpy.data.textures.new(f"{obj.name}_stuffing", "CLOUDS")
    tex.noise_scale = size
    tex.noise_depth = 0
    mod = obj.modifiers.new("Stuffing", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.texture_coords = "GLOBAL"
    return obj


root = b.pivot("Bobert")

# ---- Legs: puffy knitted trousers and stuffed felt-soled boots ----
for side, name in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{name}", (side * 0.135, 0, 0.72), parent=root, rotation=(0, side * -0.035, 0))
    seams = Bundle()
    trouser = b.from_points(f"Trouser{name}", soft_profile(
        [(0.02, -0.47), (0.115, -0.45), (0.13, -0.36), (0.135, -0.2), (0.14, -0.05), (0.13, 0.05), (0.02, 0.09)]),
        mat=pants, parent=leg, segments=28)
    lumpy(trouser, 0.006)
    seams.ring((0, 0, -0.385), 0.134, 0.134, 18, start=0.1, push=0.004)
    # Boot: a stuffed knitted shaft and foot with a rolled cuff and a felt sole.
    b.from_points(f"BootShaft{name}", soft_profile(
        [(0.02, -0.71), (0.125, -0.7), (0.135, -0.6), (0.13, -0.5), (0.135, -0.43), (0.02, -0.41)]),
        mat=boots, parent=leg, segments=28)
    b.ball(f"Foot{name}", 0.125, (0, -0.085, -0.645), scale=(1.0, 1.42, 0.62), mat=boots, parent=leg)
    b.from_points(f"BootCuff{name}", soft_profile(
        [(0.13, -0.47), (0.15, -0.465), (0.163, -0.43), (0.158, -0.39), (0.135, -0.38)], per=4),
        mat=boot_cuff, parent=leg, segments=28)
    seams.ring((0, 0, -0.455), 0.155, 0.155, 20, push=0.004)
    seams.ring((0, 0, -0.395), 0.152, 0.152, 20, start=0.15, push=0.002)
    b.from_points(f"Sole{name}", soft_profile(
        [(0.001, 0.0), (0.12, 0.0), (0.135, 0.012), (0.133, 0.03), (0.001, 0.034)], per=3),
        (0, -0.07, -0.72), mat=sole, parent=leg, segments=32, scale=(1.0, 1.55, 1.0))
    seams.ring((0, -0.07, -0.69), 0.134, 0.134 * 1.55, 30, push=0.002)
    seams.build(f"LegStitches{name}", thread, leg)

# ---- Body: a stuffed knitted tunic, belt and pouch ----
body = b.pivot("Body", (0, 0, 0), parent=root)
TUNIC_SY = 0.8
tunic_profile = [(0.02, 0.555), (0.29, 0.56), (0.315, 0.62), (0.3, 0.74), (0.275, 0.86), (0.283, 0.97),
                 (0.27, 1.06), (0.21, 1.13), (0.12, 1.165), (0.02, 1.17)]
tunic = b.from_points("Tunic", soft_profile(tunic_profile), mat=shirt, parent=body, segments=40,
                      scale=(1, TUNIC_SY, 1))
lumpy(tunic, 0.007)
b.ball("Hips", 1.0, (0, 0, 0.66), scale=(0.25, 0.2, 0.14), mat=pants, parent=body, segments=24, rings=12)
b.torus("Hem", 0.3, 0.028, (0, 0, 0.575), mat=shirt_rib, parent=body, scale=(1, TUNIC_SY + 0.005, 1),
        segments=48, minor_segments=10)
st = Bundle()
st.ring((0, 0, 0.615), 0.312, 0.312 * TUNIC_SY, 40, push=0.004)
# Neckline: a rolled knitted collar and a V slit showing the knitted neck.
b.torus("Collar", 0.12, 0.03, (0, 0, 1.16), mat=shirt_rib, parent=body, scale=(1, 0.9, 1),
        segments=32, minor_segments=10)
TUNIC_DENSE = soft_profile(tunic_profile)


def tunic_point(x, z, push=0.0):
    """A point on the front of the tunic (before its stuffing lumps), pushed out a little."""
    r = 0.0
    for (r0, z0), (r1, z1) in zip(TUNIC_DENSE, TUNIC_DENSE[1:]):
        if z0 <= z <= z1:
            r = r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-6)
    y = -TUNIC_SY * math.sqrt(max(r * r - x * x, 0.0))
    return (x, y - push, z)


# The V: a darker knitted patch that follows the chest, edged with a rolled rib and running stitches.
V_TOP, V_TIP, V_W = 1.16, 1.0, 0.06
vbm = bmesh.new()
grid = []
for i in range(7):
    z = V_TIP + (V_TOP - V_TIP) * i / 6
    w = V_W * i / 6
    grid.append([vbm.verts.new(tunic_point(-w + 2 * w * j / 4, z, 0.004)) for j in range(5)])
for i in range(6):
    for j in range(4):
        vbm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
bmesh.ops.remove_doubles(vbm, verts=vbm.verts, dist=1e-5)
b._mesh_object("VNeck", vbm, (0, 0, 0), (0, 0, 0), skin_dark, body, True)
vrib = Bundle()
for sx in (-1, 1):
    edge = [tunic_point(sx * (V_W * (z - V_TIP) / (V_TOP - V_TIP) + 0.008), z, 0.008)
            for z in (V_TIP - 0.012, 1.04, 1.08, 1.12, V_TOP + 0.01)]
    vrib.tube(edge, 0.012, 0.012, around=8, step=0.012)
    st.running([tunic_point(sx * (V_W * (z - V_TIP) / (V_TOP - V_TIP) + 0.032), z, 0.011)
                for z in (V_TIP + 0.005, 1.05, 1.1, V_TOP - 0.01)], gap=0.026, r=0.005)
vrib.build("VNeckRib", shirt_rib, body)
st.ring((0, 0, 1.175), 0.135, 0.135 * 0.9, 22, push=0.004, r=0.0055)
# Belt: a felt strap with stitched edges, a brass ring buckle and a felt pouch.
BELT_Z = 0.8
b.from_points("Belt", [(0.27, BELT_Z - 0.04), (0.287, BELT_Z - 0.035), (0.29, BELT_Z + 0.035),
                       (0.27, BELT_Z + 0.04)], mat=belt_m, parent=body, segments=48, scale=(1, 0.81, 1))
for dz in (-0.026, 0.026):
    st.ring((0, 0, BELT_Z + dz), 0.29, 0.29 * 0.81, 44, push=0.003, r=0.0055)
b.box("BeltTab", (0.07, 0.02, 0.055), (0.0, -0.238, BELT_Z), mat=belt_m, parent=body, bevel=0.012)
b.torus("Buckle", 0.045, 0.012, (0, -0.245, BELT_Z), (math.pi / 2, 0, 0), mat=brass, parent=body,
        segments=28, minor_segments=8)
b.capsule("BucklePin", 0.007, 0.045, (0.0, -0.25, BELT_Z), (0, math.pi / 2, 0), mat=brass, parent=body,
          segments=8, rings=4)
pouch = b.pivot("Pouch", (-0.2, -0.165, 0.755), parent=body, rotation=(0, 0, -0.68))
b.box("PouchBag", (0.13, 0.075, 0.14), (0, 0, 0), mat=pouch_m, parent=pouch, bevel=0.035, segments=4)
b.box("PouchFlapTop", (0.135, 0.08, 0.06), (0, -0.003, 0.05), mat=flap_m, parent=pouch, bevel=0.02, segments=3)
b.ball("PouchFlapTip", 1.0, (0, -0.04, 0.025), scale=(0.066, 0.012, 0.045), mat=flap_m, parent=pouch,
       segments=20, rings=10)
b.ball("PouchStud", 0.014, (0, -0.052, 0.012), scale=(1, 0.6, 1), mat=brass, parent=pouch, segments=12, rings=8)
pst = Bundle()
pst.running([(-0.055, -0.04, -0.055), (0.055, -0.04, -0.055)], gap=0.028, r=0.004)
pst.running([(-0.059, -0.04, -0.045), (-0.059, -0.04, 0.02)], gap=0.028, r=0.004)
pst.running([(0.059, -0.04, -0.045), (0.059, -0.04, 0.02)], gap=0.028, r=0.004)
pst.build("PouchStitches", thread, pouch)


# ---- Arms: knitted sleeves with rolled cuffs, mitten hands ----
def arm(side, name, swing, spread=0.24):
    a = b.pivot(f"Arm{name}", (side * 0.29, 0, 1.06), parent=root, rotation=(swing, side * -spread, 0))
    seams = Bundle()
    b.ball(f"Shoulder{name}", 0.112, (0, 0, -0.01), mat=shirt, parent=a, segments=24, rings=12)
    sleeve = b.from_points(f"Sleeve{name}", soft_profile(
        [(0.02, 0.02), (0.1, 0.0), (0.108, -0.1), (0.112, -0.2), (0.105, -0.235), (0.02, -0.24)], per=4),
        mat=shirt, parent=a, segments=24)
    lumpy(sleeve, 0.005)
    b.torus(f"Cuff{name}", 0.105, 0.026, (0, 0, -0.235), mat=shirt_rib, parent=a, segments=24, minor_segments=8)
    seams.ring((0, 0, -0.206), 0.113, 0.113, 14, push=0.003, r=0.0055)
    b.capsule(f"Forearm{name}", 0.066, 0.13, (0, 0, -0.33), mat=skin, parent=a, radius_bottom=0.06,
              segments=20, rings=10)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.455), parent=a)
    # A stuffed mitten: a round palm, a thumb and stitched lines between the fingers.
    b.ball(f"Mitten{name}", 0.085, (0, -0.005, -0.015), scale=(0.88, 0.95, 1.1), mat=skin, parent=hand,
           segments=20, rings=12)
    b.capsule(f"Thumb{name}", 0.03, 0.035, (side * -0.045, -0.05, 0.005), (math.radians(-35), side * 0.5, 0),
              mat=skin, parent=hand, segments=12, rings=6)
    fingers = Bundle()
    for k, x in enumerate((-0.022, 0.0, 0.022)):
        fingers.dash((x * 0.9 + side * 0.012, -0.07, -0.045), (x + side * 0.012, -0.055, -0.085), r=0.0045)
    fingers.build(f"FingerLines{name}", skin_dark, hand)
    seams.build(f"ArmStitches{name}", thread, a)
    return a, hand


arm_l, hand_l = arm(1, "L", -0.06)
arm_r, hand_r = arm(-1, "R", 0.22, spread=0.3)

# ---- Sword: a stuffed felt blade with stitched edges, a yarn guard and a button pommel ----
def sword_rotation(blade_dir):
    """Point the blade (local +Z) along blade_dir (in the hand's frame), with the button pommel's
    face (local -Y) turned as far toward the front (-Y) as it can go."""
    q = Vector(blade_dir).normalized().to_track_quat("Z", "Y")
    best = max((q @ Quaternion((0, 0, 1), 2 * math.pi * k / 72) for k in range(72)),
               key=lambda r: -(r @ Vector((0, -1, 0))).y)
    return best.to_euler()


# The fist holds the grip across it: the blade angles down, forward and in toward his boots,
# the pommel pokes out the outer side of the fist.
sword = b.pivot("Sword", (0.0, -0.03, -0.02), parent=hand_r, rotation=sword_rotation((0.36, -0.42, -0.83)))
b.cylinder("Grip", 0.028, 0.16, (0, 0, -0.005), mat=grip_m, parent=sword, segments=16)
wraps = Bundle()
for i in range(6):
    z = -0.072 + i * 0.024
    pts = []
    for k in range(13):
        a = 2 * math.pi * k / 12
        pts.append((0.031 * math.cos(a), 0.031 * math.sin(a), z + 0.02 * k / 12))
    wraps.tube(pts, 0.007, 0.007, around=6, step=0.016, tip=0.3)
wraps.build("GripWrap", guard_yarn, sword)
# Button pommel: a wooden button with four holes and a cross of thread.
b.cylinder("Pommel", 0.052, 0.026, (0, 0, -0.118), (math.pi / 2, 0, 0), mat=wood_button, parent=sword,
           segments=28, bevel=0.009)
b.torus("PommelRim", 0.042, 0.007, (0, -0.013, -0.118), (math.pi / 2, 0, 0), mat=wood_button, parent=sword,
        segments=24, minor_segments=6)
pom = Bundle()
for hx, hz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
    b.cylinder(f"PommelHole{hx}{hz}", 0.007, 0.03, (hx * 0.013, 0, -0.118 + hz * 0.013), (math.pi / 2, 0, 0),
               mat=hole_m, parent=sword, segments=8)
for s in (-1, 1):
    pom.dash((-0.013, -0.015, -0.118 - s * 0.013), (0.013, -0.015, -0.118 + s * 0.013), r=0.0045)
    pom.dash((-0.013, 0.015, -0.118 - s * 0.013), (0.013, 0.015, -0.118 + s * 0.013), r=0.0045)
pom.build("PommelThread", thread, sword)
# Guard: a fat ring of yarn around the base of the blade.
b.torus("Guard", 0.062, 0.026, (0, 0, 0.095), mat=guard_yarn, parent=sword, scale=(1.35, 0.75, 1),
        segments=28, minor_segments=10)
b.cylinder("GuardCore", 0.07, 0.03, (0, 0, 0.095), mat=boot_cuff, parent=sword, segments=20)
BLADE_SY = 0.32
blade_profile = soft_profile([(0.04, 0.08), (0.058, 0.12), (0.06, 0.3), (0.058, 0.5), (0.046, 0.6),
                              (0.022, 0.67), (0.002, 0.7)], per=5)
b.from_points("Blade", blade_profile, mat=blade_m, parent=sword, segments=28, scale=(1, BLADE_SY, 1))
blade_st = Bundle()


def blade_r(z):
    for (r0, z0), (r1, z1) in zip(blade_profile, blade_profile[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-6)
    return 0.0


for face in (-1, 1):
    for side in (-1, 1):
        pts = []
        z = 0.13
        while z < 0.655:
            r = blade_r(z)
            x = side * max(r - 0.016, 0.0)
            y = face * BLADE_SY * math.sqrt(max(r * r - x * x, 0.0)) + face * 0.002
            pts.append((x, y, z))
            z += 0.01
        pts.append((0, face * 0.004, 0.67))
        blade_st.running(pts, gap=0.032, r=0.0045)
blade_st.build("BladeStitches", thread, sword)

# ---- Head ----
head = b.pivot("Head", (0, 0, 1.13), parent=root, rotation=(0.03, 0, 0.07))
C = (0, 0, 0.335)
HR_ = (0.365, 0.335, 0.345)
b.capsule("Neck", 0.08, 0.06, (0, 0, 0.03), mat=skin, parent=head, segments=20, rings=8)
skull = b.ball("Skull", 1.0, C, scale=HR_, mat=skin, parent=head, segments=48, rings=28)
lumpy(skull, 0.006, 0.3)
face = Bundle()
for side in (1, -1):
    loc, rot = b.on_surface(C, HR_, side * math.radians(86), math.radians(-4), push=-0.015)
    b.ball(f"Ear{side}", 0.075, loc, rot, scale=(0.95, 0.55, 1.0), mat=skin, parent=head, segments=20, rings=10)
    loc, rot = b.on_surface(C, HR_, side * math.radians(86), math.radians(-4), push=0.012)
    b.ball(f"EarInner{side}", 0.045, loc, rot, scale=(0.85, 0.35, 0.9), mat=skin_dark, parent=head,
           segments=16, rings=8)

# Eyes: shiny black safety-eye buttons.
for side in (1, -1):
    loc, rot = b.on_surface(C, HR_, side * math.radians(21), math.radians(2), push=-0.006)
    b.ball(f"Eye{side}", 0.05, loc, rot, scale=(0.92, 0.55, 1.0), mat=button_eye, parent=head, segments=24, rings=12)
    # Brows: two short stitches of dark yarn.
    p0, _ = b.on_surface(C, HR_, side * math.radians(12), math.radians(17.5), push=0.004)
    p1, _ = b.on_surface(C, HR_, side * math.radians(22), math.radians(20.5), push=0.004)
    p2, _ = b.on_surface(C, HR_, side * math.radians(31), math.radians(17), push=0.0)
    face.tube([p0, p1, p2], 0.0095, 0.0085, around=8, step=0.01, tip=0.6)
    # Felt cheeks.
    loc, rot = b.on_surface(C, HR_, side * math.radians(37), math.radians(-14), push=-0.004)
    b.ball(f"Cheek{side}", 0.056, loc, rot, scale=(1.0, 0.18, 0.92), mat=cheek_m, parent=head,
           segments=24, rings=8)
loc, rot = b.on_surface(C, HR_, 0, math.radians(-8), push=-0.006)
b.ball("Nose", 0.034, loc, rot, scale=(1.15, 0.75, 0.9), mat=nose_m, parent=head, segments=16, rings=10)
# A stitched yarn smile.
smile = []
for k in range(9):
    t = -1 + 2 * k / 8
    az = t * math.radians(15)
    el = math.radians(-21) - (1 - t * t) * math.radians(4.5) + abs(t) ** 3 * math.radians(1.5)
    p, _ = b.on_surface(C, HR_, az, el, push=0.003)
    smile.append(p)
face.tube(smile, 0.0085, 0.0085, around=8, step=0.008, tip=0.6)
face.build("FaceStitches", dark_thread, head)

# ---- Hair: a knitted cap covered in curly strands of twisted brown yarn ----
HC = (0, 0.06, 0.355)
HRR = (0.362, 0.35, 0.345)
cap = b.ball("HairCap", 1.0, HC, scale=HRR, mat=hair_cap, parent=head, segments=40, rings=22)
hair = Bundle()


def push_out(p, c, r, margin):
    q = Vector(((p.x - c[0]) / (r[0] + margin), (p.y - c[1]) / (r[1] + margin), (p.z - c[2]) / (r[2] + margin)))
    if q.length < 1.0:
        q.normalize()
        p = Vector((c[0] + q.x * (r[0] + margin), c[1] + q.y * (r[1] + margin), c[2] + q.z * (r[2] + margin)))
    return p


def strand(az0, el0, daz, de, lift, r0=0.028, curl=0.045, curl_dir=1.0, steps=7):
    """A yarn strand that starts under the cap at (az0, el0), lies along the head toward
    (az0 + daz, el0 + de) while lifting off it, and ends in a little curl."""
    pts = []
    for k in range(steps):
        t = k / (steps - 1)
        az, el = az0 + daz * t, el0 + de * t
        p, _ = b.on_surface(C, HR_, az, el, push=0.012 + lift * t * t)
        pts.append(push_out(Vector(p), HC, HRR, r0 * 0.7))
    tangent = (pts[-1] - pts[-2]).normalized()
    out = (pts[-1] - Vector(C)).normalized()
    side = tangent.cross(out).normalized() * curl_dir
    c1 = pts[-1] + (tangent * 0.7 + out * 0.6 + side * 0.2) * curl
    c2 = c1 + (-tangent * 0.2 + out * 0.8 + side * 0.4) * curl * 0.8
    pts += [c1, c2]
    hair.tube(pts, r0, r0 * 0.85, around=8, step=0.02)


# Crown: a few strands stand up on top, the rest flow down from the crown like a mop.
for i in range(6):
    az = 2 * math.pi * i / 6 + R.uniform(-0.3, 0.3)
    strand(az, 1.42, R.uniform(-0.4, 0.4), -0.4, 0.06, r0=0.029, curl=0.05, curl_dir=R.choice((-1, 1)))
rows = (  # (start elevation, count, how far down they flow, lift, skip if |azimuth| below)
    (1.15, 12, -0.5, 0.07, 0.0),
    (0.85, 14, -0.55, 0.06, 1.05),
    (0.5, 14, -0.55, 0.05, 1.45),
    (0.15, 12, -0.45, 0.04, 1.75),
    (-0.2, 8, -0.3, 0.03, 2.2),
)
for row, (el, count, de, lift, skip) in enumerate(rows):
    for i in range(count):
        az = 2 * math.pi * (i + 0.5 * (row % 2) + R.uniform(-0.15, 0.15)) / count
        az = math.atan2(math.sin(az), math.cos(az))
        if abs(az) < skip:
            continue
        if row == 0 and abs(az) < 1.0:
            continue  # the fringe starts here
        strand(az, el + R.uniform(-0.06, 0.06), R.uniform(-0.15, 0.15), de * R.uniform(0.85, 1.15),
               lift * R.uniform(0.8, 1.3), r0=R.uniform(0.026, 0.031), curl_dir=R.choice((-1, 1)))
# Fringe: chunky strands falling over the forehead, swept toward his left, stopping above the brows.
for i, az in enumerate((-1.05, -0.75, -0.45, -0.15, 0.15, 0.45, 0.75, 1.05)):
    end_el = 0.52 + 0.12 * abs(az) + R.uniform(-0.03, 0.03)
    strand(az - 0.12, 1.2, 0.25 + R.uniform(-0.05, 0.05), end_el - 1.2, 0.035, r0=R.uniform(0.027, 0.031),
           curl=0.04, curl_dir=-1 if az < 0 else 1)
hair_obj = hair.build("HairStrands", hair_m, head)

# ---- Studio and output ----
b.studio(background="#f4eee6", ground="#e0dad2", ground_image=FELT, ground_image_scale=2.5, view="Standard",
         key=3.0, fill=1.0, rim=2.4, sun=1.3, exposure=0.0, shadow_softness=0.6)
b.render_all(ID)
b.export(ID)
