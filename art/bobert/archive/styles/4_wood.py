"""Style 4: Wooden Toy. Bobert as a carved, lathe-turned and painted wooden toy: dowel arms and legs
with ball joints and brass pins, glossy enamel paint in his colors with chips showing the maple
underneath, a painted face, knife-carved hair and a little wooden sword.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/4_wood.py
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "wood"
b.reset()

GRAIN = b.texture(ID, "grain")
PAINT = b.texture(ID, "paint")
GRAIN_DENSITY = 2.2  # grain tiles per unit, along and around each part


# ---- Materials ----
# Wood grain is mapped like a turned part: it runs along each part's local Z and wraps around it
# (a cylindrical mapping), so dowels and turned shapes get long straight grain, like real ones.

def _grain_vector(nodes, links):
    """Texture coordinates: u along local Z, v around the part (scaled by its radius, stored in the
    object's 'grain_r' property), so the grain is the same size on every part."""
    coord = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Object"], sep.inputs[0])
    negy = nodes.new("ShaderNodeMath")
    negy.operation = "MULTIPLY"
    links.new(sep.outputs["Y"], negy.inputs[0])
    negy.inputs[1].default_value = -1.0
    ang = nodes.new("ShaderNodeMath")
    ang.operation = "ARCTAN2"  # angle around Z, 0 at the front; the seam is at the back
    links.new(sep.outputs["X"], ang.inputs[0])
    links.new(negy.outputs[0], ang.inputs[1])
    rad = nodes.new("ShaderNodeAttribute")
    rad.attribute_type = "OBJECT"
    rad.attribute_name = "grain_r"
    v = nodes.new("ShaderNodeMath")
    v.operation = "MULTIPLY"
    links.new(ang.outputs[0], v.inputs[0])
    links.new(rad.outputs["Fac"], v.inputs[1])
    vs = nodes.new("ShaderNodeMath")
    vs.operation = "MULTIPLY"
    links.new(v.outputs[0], vs.inputs[0])
    vs.inputs[1].default_value = GRAIN_DENSITY
    off = nodes.new("ShaderNodeAttribute")
    off.attribute_type = "OBJECT"
    off.attribute_name = "grain_o"
    u = nodes.new("ShaderNodeMath")
    u.operation = "MULTIPLY_ADD"
    links.new(sep.outputs["Z"], u.inputs[0])
    u.inputs[1].default_value = GRAIN_DENSITY
    links.new(off.outputs["Fac"], u.inputs[2])
    comb = nodes.new("ShaderNodeCombineXYZ")
    links.new(u.outputs[0], comb.inputs["X"])
    links.new(vs.outputs[0], comb.inputs["Y"])
    return comb.outputs[0]


def _image(nodes, path):
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path, check_existing=True)
    tex.interpolation = "Cubic"
    return tex


def _mix(nodes, links, a, b_, fac, blend="MIX"):
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = blend
    for slot, val in (("A", a), ("B", b_), ("Factor", fac)):
        if isinstance(val, (int, float)):
            mix.inputs[slot].default_value = val
        elif isinstance(val, tuple):
            mix.inputs[slot].default_value = val
        else:
            links.new(val, mix.inputs[slot])
    return mix.outputs["Result"]


def _math(nodes, links, op, a, b_=0.0, c=None):
    n = nodes.new("ShaderNodeMath")
    n.operation = op
    for i, val in enumerate((a, b_, c)):
        if val is None:
            continue
        if isinstance(val, (int, float)):
            n.inputs[i].default_value = val
        else:
            links.new(val, n.inputs[i])
    return n.outputs[0]


def _grain_factor(nodes, links, tex):
    """The grain texture is very soft; stretch its brightness to 0..1 (dark lines = 0)."""
    bw = nodes.new("ShaderNodeRGBToBW")
    links.new(tex.outputs["Color"], bw.inputs[0])
    mr = nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.55
    mr.inputs["From Max"].default_value = 0.70
    links.new(bw.outputs[0], mr.inputs["Value"])
    return mr.outputs["Result"]


def _carve_bump(nodes, links, scale, strength):
    """Shallow knife facets: a Voronoi cell pattern used as a bump, like whittled wood."""
    coord = nodes.new("ShaderNodeTexCoord")
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = scale
    vor.inputs["Randomness"].default_value = 0.9
    links.new(coord.outputs["Object"], vor.inputs["Vector"])
    bmp = nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = strength
    bmp.inputs["Distance"].default_value = 0.01
    links.new(vor.outputs["Distance"], bmp.inputs["Height"])
    return bmp


def wood(name, tint="#ffffff", roughness=0.42, coat=0.35, carve=0.0):
    """Bare (oiled) wood: the maple grain texture, tinted."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    m.diffuse_color = b.rgba(tint)
    bsdf.inputs["Base Color"].default_value = b.rgba(tint)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.25
    if GRAIN:
        vec = _grain_vector(nodes, links)
        tex = _image(nodes, GRAIN)
        links.new(vec, tex.inputs["Vector"])
        col = _mix(nodes, links, b.rgba(tint), tex.outputs["Color"], 1.0, "MULTIPLY")
        links.new(col, bsdf.inputs["Base Color"])
    normal_in = None
    if carve:
        bmp = _carve_bump(nodes, links, 9.0, carve)
        normal_in = bmp
    if normal_in:
        links.new(normal_in.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def paint(name, color, roughness=0.36, coat=0.7, chips=0.5, chip_scale=26.0, carve=0.12, wood_tint="#fff0e0",
          paint_strength=1.0):
    """Glossy enamel paint over wood: the painted-wood texture tinted with `color`, a clear coat, and
    little chips (a noise mask) where the bare maple shows through. chips: 0 = none, 1 = a lot."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    base = b.rgba(color)
    m.diffuse_color = base
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.06
    vec = _grain_vector(nodes, links)
    paint_col = base
    if PAINT:
        ptex = _image(nodes, PAINT)
        links.new(vec, ptex.inputs["Vector"])
        paint_col = _mix(nodes, links, base, ptex.outputs["Color"], paint_strength, "MULTIPLY")
    if GRAIN and chips > 0:
        gtex = _image(nodes, GRAIN)
        links.new(vec, gtex.inputs["Vector"])
        wood_col = _mix(nodes, links, b.rgba(wood_tint), gtex.outputs["Color"], 1.0, "MULTIPLY")
        # Chip mask: fine noise, kept only where a slower noise says "worn here".
        coord = nodes.new("ShaderNodeTexCoord")
        fine = nodes.new("ShaderNodeTexNoise")
        fine.inputs["Scale"].default_value = chip_scale
        fine.inputs["Detail"].default_value = 8.0
        fine.inputs["Roughness"].default_value = 0.65
        links.new(coord.outputs["Object"], fine.inputs["Vector"])
        slow = nodes.new("ShaderNodeTexNoise")
        slow.inputs["Scale"].default_value = 3.0
        slow.inputs["Detail"].default_value = 2.0
        links.new(coord.outputs["Object"], slow.inputs["Vector"])
        both = _math(nodes, links, "MULTIPLY_ADD", slow.outputs["Fac"], 0.35, fine.outputs["Fac"])
        thresh = 0.94 - 0.1 * chips
        mask = nodes.new("ShaderNodeClamp")
        links.new(_math(nodes, links, "MULTIPLY", _math(nodes, links, "SUBTRACT", both, thresh), 60.0),
                  mask.inputs["Value"])
        mask = mask.outputs[0]
        # Thin paint: the grain shows faintly through the color.
        gf = _grain_factor(nodes, links, gtex)
        shade = _math(nodes, links, "MULTIPLY_ADD", gf, 0.22, 0.78)
        shade_rgb = nodes.new("ShaderNodeCombineColor")
        for ch in ("Red", "Green", "Blue"):
            links.new(shade, shade_rgb.inputs[ch])
        paint_col = _mix(nodes, links, paint_col, shade_rgb.outputs[0], 1.0, "MULTIPLY")
        col = _mix(nodes, links, paint_col, wood_col, mask)
        links.new(col, bsdf.inputs["Base Color"])
        links.new(_math(nodes, links, "MULTIPLY_ADD", mask, 0.35, roughness), bsdf.inputs["Roughness"])
        links.new(_math(nodes, links, "MULTIPLY_ADD", mask, -coat, coat), bsdf.inputs["Coat Weight"])
        # Chips sit a hair below the paint.
        bmp = nodes.new("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = 0.35
        bmp.inputs["Distance"].default_value = 0.002
        bmp.invert = True
        links.new(mask, bmp.inputs["Height"])
        # The grain's relief under the paint.
        gb = nodes.new("ShaderNodeBump")
        gb.inputs["Strength"].default_value = 0.3
        gb.inputs["Distance"].default_value = 0.0015
        links.new(gf, gb.inputs["Height"])
        links.new(gb.outputs["Normal"], bmp.inputs["Normal"])
        if carve:
            cb = _carve_bump(nodes, links, 7.0, carve)
            links.new(cb.outputs["Normal"], gb.inputs["Normal"])
        links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        if not isinstance(paint_col, tuple):
            links.new(paint_col, bsdf.inputs["Base Color"])
        if carve:
            cb = _carve_bump(nodes, links, 7.0, carve)
            links.new(cb.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def enamel(name, color, roughness=0.25, coat=0.6):
    """Plain glossy paint, for the painted face."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    m.diffuse_color = b.rgba(color)
    bsdf.inputs["Base Color"].default_value = b.rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    return m


skin = wood("Maple", "#fbe6dc", roughness=0.4, coat=0.4)
nose_wood = wood("MapleNose", "#ffcdb0", roughness=0.4, coat=0.4)
walnut = wood("Walnut", "#9a6440", roughness=0.45, coat=0.35)
shirt = paint("RedPaint", "#ff4f6d", chips=0.8, carve=0.35)
shirt_dark = paint("RedTrim", "#c92f4a", chips=0.4)
pants = paint("BluePaint", "#3d5afe", chips=0.8, carve=0.35)
boots = paint("BootPaint", "#5a3320", chips=0.7, carve=0.4)
boot_cuff = paint("CuffPaint", "#6e4127", chips=0.7, carve=0.4)
belt_mat = paint("BeltPaint", "#7a4a2b", chips=0.6)
hair = paint("HairPaint", "#6b3e1f", chips=0.6, roughness=0.55, coat=0.18, carve=0.0)
blade = paint("BladePaint", "#c3c9d1", chips=0.8, carve=0.0)
guard_mat = paint("GuardPaint", "#7d4c2a", chips=0.6)
brass = b.mat("Brass", "#d9a441", roughness=0.3, metallic=0.85)
eye_white = enamel("EyeWhite", "#fbf6ea")
iris = enamel("Iris", "#4a2a16")
pupil = enamel("Pupil", "#140c08")
shine = enamel("Shine", "#ffffff", roughness=0.1)
line = enamel("PaintLine", "#2b1a10")
brow = enamel("BrowPaint", "#5a3418")
mouth = enamel("MouthPaint", "#7a2a22")
cheek = enamel("CheekPaint", "#f49c94", roughness=0.4, coat=0.3)


# ---- Shape helpers of our own ----

def rounded_dowel(name, radius, z0, z1, mat, parent, bevel=0.35, radius_top=None, segments=28, location=(0, 0, 0)):
    """A turned dowel from z0 to z1 with softly rounded ends (a lathe)."""
    rt = radius if radius_top is None else radius_top
    rb = radius
    e = min(bevel * min(rb, rt), (z1 - z0) * 0.45)
    prof = []
    for i in range(5):  # bottom rounding
        a = (math.pi / 2) * (i / 4)
        prof.append((rb - e + e * math.sin(a), z0 + e - e * math.cos(a)))
    for i in range(5):  # top rounding
        a = (math.pi / 2) * (i / 4)
        prof.append((rt - e + e * math.cos(a), z1 - e + e * math.sin(a)))
    prof = [(max(r, 0.004), z) for r, z in prof]
    return b.from_points(name, prof, location=location, mat=mat, parent=parent, segments=segments)


def lock(name, length, width, thick, location, rotation, mat, parent, curl=0.0, twist=0.0):
    """A knife-carved lock of hair: a leaf shape along +Z with a ridge on its -Y (outer) side and a
    pointed tip, flat-shaded so the knife facets show. curl bends the tip toward -Y (out) or +Y (in)."""
    bm = bmesh.new()
    stations = [(0.0, 0.8, 0.7), (0.15, 0.97, 0.95), (0.35, 1.0, 1.0), (0.55, 0.86, 0.9), (0.72, 0.62, 0.72),
                (0.87, 0.34, 0.45)]
    section = [(-1.0, 0.0), (-0.55, -0.75), (0.0, -1.0), (0.55, -0.75), (1.0, 0.0), (0.45, 0.45), (-0.45, 0.45)]
    rings = []
    for s, wf, tf in stations:
        ring = []
        bend = curl * s * s * length
        tw = twist * s
        for x, y in section:
            px, py = x * width * wf * 0.5, y * thick * tf * 0.5
            px, py = px * math.cos(tw) - py * math.sin(tw), px * math.sin(tw) + py * math.cos(tw)
            ring.append(bm.verts.new((px, py - bend, s * length)))
        rings.append(ring)
    tip = bm.verts.new((0, -curl * length - thick * 0.1, length))
    n = len(section)
    for k in range(len(rings) - 1):
        for i in range(n):
            a, c = rings[k], rings[k + 1]
            bm.faces.new((a[i], a[(i + 1) % n], c[(i + 1) % n], c[i]))
    for i in range(n):
        bm.faces.new((rings[-1][i], rings[-1][(i + 1) % n], tip))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return b._mesh_object(name, bm, location, rotation, mat, parent, False)


# ---- Rig ----
root = b.pivot("Bobert")

# ---- Legs: blue-painted dowels, a bare-wood ball knee with a brass pin, carved boots ----
for side, name in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{name}", (side * 0.112, 0, 0.72), parent=root, rotation=(0, side * -0.055, 0))
    rounded_dowel(f"Thigh{name}", 0.098, -0.25, 0.02, pants, leg, radius_top=0.102)
    b.ball(f"Knee{name}", 0.078, (0, 0, -0.28), mat=skin, parent=leg, segments=28, rings=14)
    b.cylinder(f"KneePin{name}", 0.022, 0.012, (side * 0.077, 0, -0.28), (0, math.pi / 2, 0), mat=brass,
               parent=leg, segments=16, bevel=0.003)
    rounded_dowel(f"Shin{name}", 0.093, -0.45, -0.31, pants, leg, radius_top=0.096)
    # Boot: turned shaft, a fat folded cuff, a carved foot with a round toe, and a walnut sole.
    b.from_points(f"BootShaft{name}", [(0.112, -0.70), (0.118, -0.6), (0.116, -0.46), (0.11, -0.43)],
                  mat=boots, parent=leg, segments=28)
    b.from_points(f"BootCuff{name}", [(0.118, -0.47), (0.132, -0.462), (0.138, -0.44), (0.139, -0.385),
                                      (0.133, -0.365), (0.11, -0.358)], mat=boot_cuff, parent=leg, segments=28)
    b.ball(f"Foot{name}", 1.0, (0, -0.07, -0.64), scale=(0.122, 0.2, 0.08), mat=boots, parent=leg,
           segments=28, rings=14)
    sole = b.cylinder(f"Sole{name}", 1.0, 0.04, (0, -0.06, -0.70), mat=walnut, parent=leg, segments=32,
                      bevel=0.012)
    sole.scale = (0.128, 0.215, 1.0)
    b.cylinder(f"BootPeg{name}", 0.016, 0.01, (side * 0.118, 0.0, -0.52), (0, math.pi / 2, 0), mat=brass,
               parent=leg, segments=12, bevel=0.003)

# ---- Body: a turned tunic, flared at the hem ----
body = b.pivot("Body", (0, 0, 0), parent=root)
TY = 0.8  # the tunic is a little flatter front-to-back
tunic_prof = [(0.25, 0.6), (0.262, 0.612), (0.268, 0.635), (0.258, 0.66), (0.232, 0.74), (0.208, 0.83),
              (0.198, 0.9), (0.204, 0.99), (0.216, 1.07), (0.212, 1.12), (0.185, 1.165), (0.13, 1.19),
              (0.075, 1.2)]
b.from_points("Tunic", tunic_prof, mat=shirt, parent=body, scale=(1, TY, 1), segments=48)
b.torus("HemBead", 0.262, 0.013, (0, 0, 0.627), mat=shirt_dark, parent=body, scale=(1, TY, 1), segments=48,
        minor_segments=8)
b.torus("Collar", 0.085, 0.022, (0, 0, 1.195), mat=shirt_dark, parent=body, scale=(1, 0.9, 1), segments=32,
        minor_segments=10)
# A little V slit at the neck, carved and painted dark.
for s in (1, -1):
    b.capsule(f"Slit{s}", 0.007, 0.05, (s * 0.012, -0.166, 1.135), (0.42, s * 0.3, 0), mat=shirt_dark,
              parent=body, segments=8, rings=4)
# Belt: a painted band, round brass buckle, a pouch on his left hip.
b.from_points("Belt", [(0.198, 0.845), (0.212, 0.852), (0.215, 0.865), (0.215, 0.92), (0.212, 0.933),
                       (0.2, 0.94)], mat=belt_mat, parent=body, scale=(1, TY + 0.01, 1), segments=48)
b.box("BuckleBack", (0.085, 0.02, 0.085), (0, -0.172, 0.892), mat=belt_mat, parent=body, bevel=0.02)
b.torus("Buckle", 0.042, 0.013, (0, -0.184, 0.892), (math.pi / 2, 0, 0), mat=brass, parent=body, segments=24,
        minor_segments=8)
b.capsule("BuckleProng", 0.007, 0.07, (0.0, -0.186, 0.892), (0, math.pi / 2, 0), mat=brass, parent=body,
          segments=8, rings=4)
b.box("Pouch", (0.12, 0.075, 0.13), (0.158, -0.15, 0.81), (0, 0, 0.72), mat=belt_mat, parent=body, bevel=0.03)
b.box("PouchFlap", (0.128, 0.083, 0.055), (0.159, -0.152, 0.855), (0.0, 0, 0.72), mat=boots, parent=body,
      bevel=0.022)
b.ball("PouchStud", 0.014, (0.13, -0.186, 0.84), mat=brass, parent=body, segments=12, rings=6)


# ---- Arms: red sleeve, bare dowel upper arm, ball elbow with a pin, forearm, carved fist ----
def arm(side, name, swing, spread):
    a = b.pivot(f"Arm{name}", (side * 0.268, 0, 1.115), parent=root, rotation=(swing, side * -spread, 0))
    b.ball(f"Shoulder{name}", 0.1, (0, 0, -0.035), mat=shirt, parent=a, segments=28, rings=14)
    b.from_points(f"Sleeve{name}", [(0.096, -0.165), (0.102, -0.15), (0.1, -0.08), (0.092, -0.02), (0.06, 0.04)],
                  mat=shirt, parent=a, segments=28)
    b.torus(f"SleeveBead{name}", 0.098, 0.012, (0, 0, -0.158), mat=shirt_dark, parent=a, segments=28,
            minor_segments=8)
    rounded_dowel(f"UpperArm{name}", 0.06, -0.2, -0.12, skin, a)
    b.ball(f"Elbow{name}", 0.067, (0, 0, -0.218), mat=skin, parent=a, segments=24, rings=12)
    b.cylinder(f"ElbowPin{name}", 0.019, 0.01, (side * 0.065, 0, -0.218), (0, math.pi / 2, 0), mat=brass,
               parent=a, segments=12, bevel=0.003)
    rounded_dowel(f"Forearm{name}", 0.057, -0.36, -0.24, skin, a, radius_top=0.06)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.39), parent=a)
    hand.scale = (1.18, 1.18, 1.18)  # big, chunky toy fists
    # Carved fist: a rounded block of a palm, four finger rolls curled around in front, a thumb.
    b.ball(f"Palm{name}", 1.0, (0, 0.008, -0.035), scale=(0.058, 0.062, 0.078), mat=skin, parent=hand,
           segments=24, rings=12)
    for i, z in enumerate((-0.005, -0.035, -0.065, -0.093)):
        w = 0.024 if i < 3 else 0.02
        b.capsule(f"Finger{name}{i}", w * 0.95, 0.06 if i < 3 else 0.05, (side * -0.004, -0.045, z),
                  (0, math.pi / 2, 0), mat=skin, parent=hand, segments=14, rings=6)
    b.capsule(f"Thumb{name}", 0.021, 0.04, (side * -0.045, -0.035, -0.008), (0.5, side * 0.35, 0), mat=skin,
              parent=hand, segments=14, rings=6)
    return a, hand


arm_l, hand_l = arm(1, "L", -0.06, 0.2)
arm_r, hand_r = arm(-1, "R", 0.1, 0.26)

# ---- Sword: a wooden toy sword, held blade-down in the right fist ----
sword = b.pivot("Sword", (0, -0.03, -0.05), parent=hand_r, rotation=(math.radians(166), 0, math.radians(-4)))
sword.scale = (1 / 1.18,) * 3  # undo the fist's scale
b.from_points("Grip", [(0.022, -0.085), (0.027, -0.075), (0.024, -0.06), (0.028, -0.045), (0.024, -0.03),
                       (0.028, -0.015), (0.024, 0.0), (0.028, 0.015), (0.024, 0.03), (0.028, 0.045),
                       (0.024, 0.06), (0.027, 0.075), (0.022, 0.085)], mat=walnut, parent=sword, segments=16)
b.from_points("Pommel", [(0.012, -0.09), (0.03, -0.1), (0.04, -0.12), (0.038, -0.14), (0.025, -0.155),
                         (0.006, -0.16)], mat=walnut, parent=sword, segments=20)
b.capsule("Guard", 0.032, 0.17, (0, 0, 0.11), (0, math.pi / 2, 0), mat=guard_mat, parent=sword, segments=16,
          rings=8, scale=(1.0, 0.9, 1.0))
for s in (1, -1):
    b.ball(f"GuardEnd{s}", 0.04, (s * 0.115, 0, 0.11), mat=guard_mat, parent=sword, segments=16, rings=8)
bl = b.from_points("Blade", [(0.058, 0.12), (0.066, 0.14), (0.064, 0.42), (0.056, 0.5), (0.034, 0.57),
                             (0.004, 0.62)], mat=blade, parent=sword, segments=8, scale=(1.0, 0.26, 1.0))
for p in bl.data.polygons:
    p.use_smooth = False

# ---- Head: a turned maple ball with a painted face ----
head = b.pivot("Head", (0, 0, 1.19), parent=root, rotation=(0.03, 0, 0.07))
C = (0, 0, 0.35)
R = (0.29, 0.275, 0.295)
rounded_dowel("Neck", 0.062, -0.02, 0.12, skin, head)
b.ball("Skull", 1.0, C, scale=R, mat=skin, parent=head, segments=64, rings=32)
for side in (1, -1):
    loc, rot = b.on_surface(C, R, side * math.radians(88), math.radians(-4), push=-0.012)
    b.ball(f"Ear{side}", 0.068, loc, rot, scale=(0.72, 0.42, 1.0), mat=skin, parent=head, segments=24, rings=12)
    loc, rot = b.on_surface(C, R, side * math.radians(88), math.radians(-4), push=0.012)
    b.ball(f"EarHollow{side}", 0.036, loc, rot, scale=(0.6, 0.25, 0.9), mat=nose_wood, parent=head, segments=16,
           rings=8)
loc, rot = b.on_surface(C, R, 0, math.radians(-7), push=-0.006)
b.ball("Nose", 0.034, loc, rot, scale=(1.15, 0.85, 0.9), mat=nose_wood, parent=head, segments=20, rings=10)


def surf(az, el, push):
    return Vector(b.on_surface(C, R, az, el, push)[0])


def _decal_object(name, bm, mat_, center_dir):
    # Make every face look outward (away from the head's center).
    for f in bm.faces:
        if f.normal.dot(center_dir) < 0:
            f.normal_flip()
    obj = b._mesh_object(name, bm, (0, 0, 0), (0, 0, 0), mat_, head, True)
    return obj


def paint_spot(name, az0, el0, da, de, mat_, push=0.002, tilt=0.0, rings=3, segs=28):
    """A painted ellipse on the head (in azimuth/elevation radians), hugging its curve."""
    bm = bmesh.new()
    center = bm.verts.new(surf(az0, el0, push))
    prev = None
    rows = []
    for k in range(1, rings + 1):
        f = k / rings
        row = []
        for i in range(segs):
            t = 2 * math.pi * i / segs
            x, y = da * f * math.cos(t), de * f * math.sin(t)
            x, y = x * math.cos(tilt) - y * math.sin(tilt), x * math.sin(tilt) + y * math.cos(tilt)
            row.append(bm.verts.new(surf(az0 + x, el0 + y, push)))
        rows.append(row)
    for i in range(segs):
        bm.faces.new((center, rows[0][i], rows[0][(i + 1) % segs]))
    for k in range(rings - 1):
        for i in range(segs):
            a, c = rows[k], rows[k + 1]
            bm.faces.new((a[i], c[i], c[(i + 1) % segs], a[(i + 1) % segs]))
    bm.normal_update()
    return _decal_object(name, bm, mat_, surf(az0, el0, 0) - Vector(C))


def paint_stroke(name, pts, width, mat_, push=0.003, taper=0.35):
    """A painted brush stroke along (az, el) points, `width` radians wide, tapering at the ends."""
    bm = bmesh.new()
    left, right = [], []
    n = len(pts)
    for i, (az, el) in enumerate(pts):
        a0 = pts[max(i - 1, 0)]
        a1 = pts[min(i + 1, n - 1)]
        dx, dy = a1[0] - a0[0], a1[1] - a0[1]
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln, dx / ln
        t = i / (n - 1)
        w = width * 0.5 * (taper + (1 - taper) * math.sin(math.pi * t) ** 0.5)
        left.append(bm.verts.new(surf(az + nx * w, el + ny * w, push)))
        right.append(bm.verts.new(surf(az - nx * w, el - ny * w, push)))
    for i in range(n - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bm.normal_update()
    mid = pts[n // 2]
    return _decal_object(name, bm, mat_, surf(mid[0], mid[1], 0) - Vector(C))


def arc_pts(az0, az1, el_mid, sag, n=12, lift=0.0):
    """Points along a gentle arc from az0 to az1; sag > 0 bends the middle down. lift raises the az1 end."""
    pts = []
    for i in range(n):
        t = i / (n - 1)
        az = az0 + (az1 - az0) * t
        el = el_mid - sag * (1 - (2 * t - 1) ** 2) + lift * t
        pts.append((az, el))
    return pts


# Eyes: big, round and friendly, looking slightly toward the viewer.
for side in (1, -1):
    ea, ee = side * 0.36, 0.03
    paint_spot(f"EyeWhite{side}", ea, ee, 0.165, 0.215, eye_white, push=0.0015)
    paint_spot(f"Iris{side}", ea - side * 0.02, ee - 0.02, 0.125, 0.165, iris, push=0.003)
    paint_spot(f"Pupil{side}", ea - side * 0.022, ee - 0.025, 0.07, 0.095, pupil, push=0.0045)
    paint_spot(f"Shine{side}", ea + side * 0.03 - 0.02, ee + 0.06, 0.04, 0.045, shine, push=0.006, rings=2)
    paint_spot(f"Shine2{side}", ea - side * 0.06, ee - 0.085, 0.018, 0.02, shine, push=0.006, rings=1, segs=16)
    # Upper lid line: a dark stroke over the top of the eye, flicking out at the corner.
    lid = [(ea + side * (-0.17 + 0.37 * t), ee + 0.205 * math.sin(math.pi * min(t, 0.92) / 0.92) ** 0.6 - 0.04 * t)
           for t in [i / 13 for i in range(14)]]
    paint_stroke(f"Lid{side}", lid, 0.045, line, push=0.0055, taper=0.2)
    # Brows: soft arcs, raised a little.
    pts = arc_pts(ea - side * 0.16, ea + side * 0.16, 0.34, -0.045, n=12, lift=-0.03)
    paint_stroke(f"Brow{side}", pts, 0.06, brow, push=0.002, taper=0.3)
    # Rosy cheeks.
    paint_spot(f"Cheek{side}", side * 0.6, -0.24, 0.15, 0.12, cheek, push=0.0015)
# Smile: a little lopsided, higher on his left.
paint_stroke("Smile", arc_pts(-0.2, 0.24, -0.36, 0.09, n=16, lift=0.05), 0.04, mouth, push=0.002, taper=0.25)

# ---- Hair: a carved, painted cap covered in chunky knife-carved locks ----
HC, HR = (0, 0.04, 0.41), (0.298, 0.285, 0.275)
b.ball("HairCap", 1.0, HC, scale=HR, mat=hair, parent=head, segments=72, rings=36)
r = b.rng(11)


def place_lock(nm, az, el, length, width, thick, sweep, lift, push=-0.01, curl=0.0):
    loc, rot = b.on_surface(HC, HR, az, el, push=push)
    lk = lock(nm, length, width, thick, loc, rot, hair, head, curl=curl, twist=r.uniform(-0.25, 0.25))
    lk.rotation_euler.rotate_axis("Y", math.pi + sweep)  # point down the head (+ swept sideways)
    lk.rotation_euler.rotate_axis("X", lift)  # tip lifts off the head
    return lk


rows = [  # (elevation, how many, length, width, lift)
    (1.18, 7, 0.2, 0.13, 0.22), (0.85, 11, 0.21, 0.13, 0.2), (0.5, 13, 0.2, 0.125, 0.2),
    (0.15, 14, 0.2, 0.125, 0.2), (-0.18, 12, 0.2, 0.125, 0.2), (-0.5, 9, 0.17, 0.12, 0.25),
]
for row, (el, n, length, width, lift) in enumerate(rows):
    for i in range(n):
        az = 2 * math.pi * (i + 0.5 * (row % 2)) / n + r.uniform(-0.08, 0.08)
        az = math.atan2(math.sin(az), math.cos(az))
        if el < 1.0 and abs(az) < 1.05:
            continue  # the face (the fringe covers the forehead)
        if el < 0.3 and abs(az) < 1.75:
            continue  # leave the ears and cheeks clear
        if el < -0.1 and abs(az) < 2.0:
            continue
        if el < -0.4 and abs(az) < 2.3:
            continue
        sweep = 0.3 * math.sin(az) + r.uniform(-0.2, 0.2)
        place_lock(f"Lock{row}_{i}", az, el + r.uniform(-0.04, 0.04), length * r.uniform(0.9, 1.1),
                   width * r.uniform(0.9, 1.1), 0.06, sweep, lift + r.uniform(-0.08, 0.08), curl=-0.1)
# Crown: a few locks standing up from the top, like a carved tuft.
for i in range(3):
    az = 2 * math.pi * i / 3 + 0.9
    loc, rot = b.on_surface(HC, HR, az, 1.3, push=-0.02)
    lk = lock(f"Crown{i}", 0.16, 0.12, 0.06, loc, rot, hair, head, curl=-0.05)
    lk.rotation_euler.rotate_axis("Y", math.pi + 0.5)
    lk.rotation_euler.rotate_axis("X", 0.55)
# Fringe: big carved locks swept across the forehead toward his left.
for i, (az, el, ln, sw) in enumerate(((-1.05, 0.95, 0.2, -0.15), (-0.7, 1.05, 0.22, -0.3),
                                      (-0.3, 1.1, 0.24, -0.4), (0.1, 1.1, 0.24, -0.45),
                                      (0.5, 1.05, 0.22, -0.45), (0.88, 0.98, 0.2, -0.35))):
    place_lock(f"Fringe{i}", az, el, ln, 0.13, 0.06, sw, 0.0, push=-0.005, curl=-0.25)
# A lower layer of short fringe locks hides where the cap meets the forehead.
for i, (az, el, sw) in enumerate(((-1.0, 0.75, -0.1), (-0.68, 0.9, -0.25), (-0.33, 0.97, -0.35),
                                  (0.02, 0.99, -0.45), (0.37, 0.97, -0.5), (0.7, 0.9, -0.45),
                                  (1.0, 0.78, -0.35))):
    loc, rot = b.on_surface(C, R, az, el, push=0.0)
    lk = lock(f"FringeLow{i}", 0.16, 0.12, 0.05, loc, rot, hair, head, curl=-0.2, twist=r.uniform(-0.2, 0.2))
    lk.rotation_euler.rotate_axis("Y", math.pi + sw)
    lk.rotation_euler.rotate_axis("X", 0.12)

# ---- Grain mapping: every part's size goes on the object, so the grain matches across parts ----
r2 = b.rng(5)
for o in b.meshes():
    vs = [v.co for v in o.data.vertices]
    rad = max(max(abs(v.x) for v in vs) * o.scale.x, max(abs(v.y) for v in vs) * o.scale.y, 0.02)
    o["grain_r"] = rad
    o["grain_o"] = r2.uniform(0, 10)

# ---- Studio and output ----
b.studio(background="#f3eadc", ground="#c4b091", view="Standard", key=2.6, fill=1.0, rim=2.4,
         sun=2.0, exposure=-0.25, shadow_softness=0.25)
b.render_all(ID)
b.export(ID)
