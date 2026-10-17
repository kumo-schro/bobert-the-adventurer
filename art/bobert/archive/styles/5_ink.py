"""Style 5: Storybook Ink. A hand-painted children's picture book come to life: bold ink outlines
that swell on the shadow side, flat 2-3 tone cel shading with cool violet shadows, and loose
watercolor washes inside every color area, standing on a sheet of watercolor paper.

Everything is unlit "paint": a Diffuse BSDF is read with Shader to RGB, snapped to a few flat
tones with a constant Color Ramp (the edges wobble with the wash texture, like a brush), tinted
with the wash and sent out as Emission. Outlines are inverted hulls (Solidify) whose thickness
comes from a vertex group, so the lines are heavier on the side away from the light.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/5_ink.py
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "ink"
b.reset()

WASH = b.texture(ID, "wash")
PAPER = b.texture(ID, "paper")
INK = "#2a1c17"
# Where the light comes from (the sun points the other way). Front, Bobert's right, above.
LIGHT = Vector((-0.55, -0.7, 1.2)).normalized()
SHADOW_TINT = (0.66, 0.62, 0.84)  # watercolor shadows: cooler and a little violet

EXPORT_COLORS = {}  # material -> base color, for the .glb


def _mix(c1, c2, t):
    return tuple(a * (1 - t) + b_ * t for a, b_ in zip(c1, c2))


def _srgb(color):
    return b.rgba(color)[:3]


def ink_mat(name, color, shadow=None, light=0.16, t1=0.45, t2=1.08, wash=0.4, wash_scale=1.4, jitter=0.4,
            wash_contrast=0.12, wash_bright=0.06,
            edge=0.22, vary=None, vary_scale=3.0, image=None, image_strength=None, tones=3):
    """A flat, painted cel material (Emission, so no lighting gets in except through the ramp).

    color: the middle (lit) tone. shadow: the shadow tone (default: color * a cool violet tint).
    light: how far the highlight tone goes toward warm white. t1 / t2: ramp steps (lighting value).
    wash: how strongly the watercolor wash shows. jitter: how much the wash wobbles the tone edges.
    edge: watercolor pigment pooling, a slightly darker rim toward the silhouette.
    vary: a second color that the wash drifts toward in blotches (loose pigment variation).
    """
    base = _srgb(color)
    shade = _srgb(shadow) if shadow else tuple(c * t for c, t in zip(base, SHADOW_TINT))
    hi = _mix(base, _srgb("#fff6e2"), light)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*base, 1)
    EXPORT_COLORS[m.name] = (*base, 1)
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.remove(nodes.get("Principled BSDF"))
    out = nodes.get("Material Output")

    diff = nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = nodes.new("ShaderNodeShaderToRGB")
    links.new(diff.outputs[0], s2r.inputs[0])
    bw = nodes.new("ShaderNodeRGBToBW")
    links.new(s2r.outputs["Color"], bw.inputs[0])
    value = bw.outputs[0]

    wash_out = None
    img = image or WASH
    if img:
        coord = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (wash_scale,) * 3
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(img, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.4
        links.new(coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs[0], tex.inputs["Vector"])
        wash_out = tex.outputs["Color"]
        # Wobble the tone edges with the wash, so they look brushed rather than computed.
        wbw = nodes.new("ShaderNodeRGBToBW")
        links.new(wash_out, wbw.inputs[0])
        sub = nodes.new("ShaderNodeMath")
        sub.operation = "SUBTRACT"
        links.new(wbw.outputs[0], sub.inputs[0])
        sub.inputs[1].default_value = 0.82
        mad = nodes.new("ShaderNodeMath")
        mad.operation = "MULTIPLY_ADD"
        links.new(sub.outputs[0], mad.inputs[0])
        mad.inputs[1].default_value = jitter * 2.5
        links.new(value, mad.inputs[2])
        value = mad.outputs[0]

    ramp = nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*shade, 1)
    cr.elements[1].position = t1
    cr.elements[1].color = (*base, 1)
    if tones >= 3:
        e = cr.elements.new(t2)
        e.color = (*hi, 1)
    links.new(value, ramp.inputs["Fac"])
    col = ramp.outputs["Color"]

    if vary:
        nz = nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = vary_scale
        nz.inputs["Detail"].default_value = 3.0
        coord2 = nodes.new("ShaderNodeTexCoord")
        links.new(coord2.outputs["Object"], nz.inputs["Vector"])
        mr = nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.45
        mr.inputs["From Max"].default_value = 0.65
        links.new(nz.outputs["Fac"], mr.inputs["Value"])
        vmix = nodes.new("ShaderNodeMix")
        vmix.data_type = "RGBA"
        vmix.blend_type = "MULTIPLY"
        links.new(mr.outputs[0], vmix.inputs["Factor"])
        links.new(col, vmix.inputs["A"])
        vb = _srgb(vary)
        vmix.inputs["B"].default_value = (*[v / max(c, 1e-3) for v, c in zip(vb, base)], 1)
        col = vmix.outputs["Result"]

    if wash_out is not None and wash > 0:
        bc = nodes.new("ShaderNodeBrightContrast")
        bc.inputs["Bright"].default_value = wash_bright
        bc.inputs["Contrast"].default_value = wash_contrast
        links.new(wash_out, bc.inputs["Color"])
        wm = nodes.new("ShaderNodeMix")
        wm.data_type = "RGBA"
        wm.blend_type = "MULTIPLY"
        wm.inputs["Factor"].default_value = wash if image_strength is None else image_strength
        links.new(col, wm.inputs["A"])
        links.new(bc.outputs[0], wm.inputs["B"])
        col = wm.outputs["Result"]

    if edge > 0:
        lw = nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.35
        er = nodes.new("ShaderNodeMapRange")
        er.inputs["From Min"].default_value = 0.6
        er.inputs["From Max"].default_value = 0.85
        er.inputs["To Max"].default_value = edge
        links.new(lw.outputs["Facing"], er.inputs["Value"])
        em_ = nodes.new("ShaderNodeMix")
        em_.data_type = "RGBA"
        em_.blend_type = "MULTIPLY"
        links.new(er.outputs[0], em_.inputs["Factor"])
        links.new(col, em_.inputs["A"])
        em_.inputs["B"].default_value = (*[c * 0.8 for c in shade], 1)
        col = em_.outputs["Result"]

    emis = nodes.new("ShaderNodeEmission")
    links.new(col, emis.inputs["Color"])
    links.new(emis.outputs[0], out.inputs["Surface"])
    return m


def flat_mat(name, color):
    m = b.mat(name, color, flat=True)
    EXPORT_COLORS[m.name] = b.rgba(color)
    return m


# ---- Palette (Bobert's colors, watercolor-shaded) ----
skin = ink_mat("Skin", "#ffcb9c", shadow="#eda088", light=0.2, wash=0.3, jitter=0.2, t1=0.5, tones=2, edge=0.15, vary="#ffb79a")
hair = ink_mat("Hair", "#7b4524", shadow="#4a2a22", light=0.12, t2=1.15, wash=0.6, vary="#8f5428")
hair_cap = ink_mat("HairCap", "#71401f", shadow="#4a2a22", tones=2, wash=0.6)
shirt = ink_mat("Shirt", "#f5535f", shadow="#b8345a", light=0.14, vary="#ff6a4f", vary_scale=2.5)
shirt_dark = ink_mat("ShirtFold", "#d8404f", shadow="#9a2c4e", light=0.1)
pants = ink_mat("Pants", "#4561e8", shadow="#2f3a9e", light=0.16, vary="#5a7af0", vary_scale=2.0)
boots = ink_mat("Boots", "#6a4027", shadow="#3d2420", light=0.14, vary="#7d4a2a")
boot_in = ink_mat("BootInside", "#3a2219", shadow="#2a1814", tones=2)
sole = ink_mat("Sole", "#3b2a22", shadow="#241914", tones=2)
leather = ink_mat("Leather", "#9a6235", shadow="#5e3a2c", light=0.18, vary="#a9703c")
brass = ink_mat("Brass", "#e2b24a", shadow="#a87a3a", light=0.45, t2=1.0, wash=0.35)
wood = ink_mat("Wood", "#8e5530", shadow="#5a3326", light=0.15)
steel = ink_mat("Steel", "#a8b5c8", shadow="#6d7a98", light=0.35, t1=0.55, t2=1.1, wash=0.15, jitter=0.08, edge=0.1)
eye_white = ink_mat("EyeWhite", "#fffaf0", shadow="#e6dfe8", light=0.0, wash=0.1, edge=0.0, tones=2, t1=0.35)
iris = ink_mat("Iris", "#7a4a26", shadow="#5a3420", light=0.0, wash=0.2, edge=0.0, tones=2, t1=0.4)
cheek = ink_mat("Cheek", "#ff9a9a", shadow="#f08890", light=0.0, wash=0.9, wash_scale=3.0, edge=0.0, tones=2)
nose = ink_mat("Nose", "#ffa98e", shadow="#e9857e", light=0.25, wash=0.35, edge=0.0)
ear_in = ink_mat("EarInside", "#f2a58a", shadow="#d98478", tones=2)
ink = flat_mat("Ink", INK)
brow_ink = flat_mat("BrowInk", "#3d2414")
pupil = flat_mat("Pupil", "#1d120d")
shine = flat_mat("Shine", "#ffffff")
mouth_ink = flat_mat("MouthInk", "#6b2a24")
seam_ink = flat_mat("SeamInk", "#8a2638")

OUTLINES = []  # (object, thickness)


def ol(obj, t=0.013):
    OUTLINES.append((obj, t))
    return obj


def surface_rot(rot, extra):
    """Compose a face part's surface rotation with an extra local rotation."""
    return (Euler(rot).to_matrix() @ Euler(extra).to_matrix()).to_euler()


def wobble(obj, below, amp_r=0.02, amp_z=0.015, folds=6, phase=0.0):
    """Cloth folds: ripple the radius and the height of a lathe's vertices below a height."""
    for v in obj.data.vertices:
        if v.co.z < below:
            t = (below - v.co.z) / 0.25
            t = min(1.0, t)
            a = math.atan2(v.co.y, v.co.x)
            k = 1 + amp_r * t * math.sin(folds * a + phase)
            v.co.x *= k
            v.co.y *= k
            if v.co.z < below - 0.2:
                v.co.z += amp_z * math.sin(folds * a + phase + 1.1) + amp_z * 0.6 * math.sin(3 * a)


def orient(direction, side):
    """A rotation whose Z axis points along `direction` and X axis toward `side`."""
    z = Vector(direction).normalized()
    x = Vector(side)
    x = (x - z * x.dot(z))
    if x.length < 1e-4:
        x = z.orthogonal()
    x.normalize()
    y = z.cross(x)
    m = Matrix((x, y, z)).transposed()
    return m.to_euler()


def spike(name, length, radius, location, direction, bend_dir, bend=0.3, mat=None, parent=None, segments=10):
    """A tapering, slightly curved hair spike: base at `location`, tip along `direction`,
    curling toward `bend_dir`."""
    L = length
    prof = [(radius * 0.85, -0.04), (radius, 0.0), (radius * 0.92, 0.25 * L), (radius * 0.68, 0.55 * L),
            (radius * 0.36, 0.8 * L), (0.006, L)]
    obj = b.from_points(name, prof, location, orient(direction, bend_dir), mat=mat, parent=parent,
                        segments=segments, scale=(1, 0.5, 1))
    for v in obj.data.vertices:
        t = max(0.0, v.co.z / L)
        v.co.x += bend * L * t * t
    return obj


# ---- Rig ----
root = b.pivot("Bobert")

# ---- Legs: baggy trousers tucked into tall, floppy-cuffed boots ----
for side, name in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{name}", (side * 0.125, 0, 0.78), parent=root, rotation=(0, side * -0.07, side * 0.12))
    t = b.from_points(f"Trousers{name}", [(0.098, -0.56), (0.118, -0.5), (0.14, -0.38), (0.145, -0.26),
                                          (0.136, -0.1), (0.125, 0.04), (0.08, 0.08)],
                      mat=pants, parent=leg, segments=20)
    wobble(t, -0.3, amp_r=0.05, amp_z=0.0, folds=5, phase=side)
    ol(t, 0.013)
    ol(b.from_points(f"Boot{name}", [(0.098, -0.745), (0.112, -0.72), (0.114, -0.64), (0.104, -0.58), (0.11, -0.5)],
                     mat=boots, parent=leg, segments=20))
    cuff = b.from_points(f"BootCuff{name}", [(0.112, -0.545), (0.135, -0.525), (0.15, -0.47), (0.156, -0.425),
                                              (0.145, -0.415), (0.11, -0.42)],
                         mat=boots, parent=leg, segments=20)
    wobble(cuff, -0.42, amp_r=0.06, amp_z=0.0, folds=3, phase=side * 2)
    ol(cuff, 0.012)
    b.from_points(f"BootOpening{name}", [(0.115, -0.43), (0.136, -0.423)], mat=boot_in, parent=leg, segments=20)
    ol(b.ball(f"Toe{name}", 0.11, (0, -0.1, -0.7), scale=(0.95, 1.55, 0.6), mat=boots, parent=leg,
              segments=20, rings=10))
    ol(b.from_points(f"Sole{name}", [(0.095, -0.78), (0.112, -0.772), (0.116, -0.755), (0.11, -0.735)],
                     (0, -0.075, 0), mat=sole, parent=leg, segments=24, scale=(1, 1.85, 1)), 0.01)
    ol(b.box(f"Heel{name}", (0.19, 0.11, 0.05), (0, 0.065, -0.745), mat=sole, parent=leg, bevel=0.015, segments=2),
       0.009)

# ---- Body: a loose tunic with a stand collar, laced V-neck, belt, round buckle and a pouch ----
body = b.pivot("Body", (0, 0, 0), parent=root)
tunic = b.from_points("Tunic", [(0.3, 0.6), (0.325, 0.625), (0.315, 0.68), (0.293, 0.76), (0.272, 0.86),
                                (0.266, 0.97), (0.278, 1.06), (0.26, 1.13), (0.19, 1.18), (0.11, 1.205)],
                      mat=shirt, parent=body, scale=(1, 0.8, 1), segments=40)
wobble(tunic, 0.8, amp_r=0.06, amp_z=0.022, folds=7, phase=0.4)
ol(tunic, 0.015)
collar = b.from_points("Collar", [(0.11, 1.165), (0.122, 1.18), (0.118, 1.25), (0.108, 1.255)],
                       mat=shirt_dark, parent=body, scale=(1, 0.92, 1), segments=24)
ol(collar, 0.009)
# The neck opening: an inked slit with a little criss-cross lace.
for sx in (1, -1):  # a small V-neck opening drawn in ink
    b.capsule(f"NeckV{sx}", 0.0065, 0.07, (sx * 0.017, -0.214, 1.13), (-0.3, sx * 0.42, 0), mat=seam_ink,
              parent=body, segments=6, rings=4)
# Belt (a band hugging the tunic), round buckle with a prong, belt loop.
ol(b.from_points("Belt", [(0.272, 0.79), (0.285, 0.8), (0.287, 0.865), (0.274, 0.875)],
                 mat=leather, parent=body, scale=(1, 0.81, 1), segments=40), 0.011)
ol(b.torus("Buckle", 0.048, 0.013, (0, -0.236, 0.833), (math.pi / 2, 0, 0), mat=brass, parent=body,
           segments=24, minor_segments=8), 0.006)
ol(b.capsule("Prong", 0.007, 0.06, (0.0, -0.243, 0.833), (0, math.pi / 2, 0), mat=brass, parent=body,
             segments=6, rings=4), 0.004)
ol(b.box("BeltTip", (0.07, 0.025, 0.055), (0.11, -0.227, 0.833), (0, 0, -0.38), mat=leather, parent=body,
         bevel=0.01, segments=2), 0.006)
# Pouch on his right hip.
pouch = b.pivot("Pouch", (-0.215, -0.17, 0.76), parent=body, rotation=(0.05, 0, -0.75))
ol(b.box("PouchBag", (0.14, 0.085, 0.13), (0, 0, 0), mat=leather, parent=pouch, bevel=0.035, segments=3,
         taper=(0.92, 0.9)), 0.009)
ol(b.box("PouchFlap", (0.15, 0.095, 0.06), (0, -0.004, 0.05), (0.12, 0, 0), mat=boots, parent=pouch, bevel=0.025,
         segments=3), 0.007)
ol(b.ball("PouchStud", 0.016, (0, -0.052, 0.035), mat=brass, parent=pouch, segments=12, rings=6), 0.004)
ol(b.box("PouchStrap", (0.04, 0.02, 0.1), (0, 0.03, 0.1), mat=leather, parent=pouch, bevel=0.008, segments=2),
   0.005)


# ---- Arms: loose sleeves rolled up past the elbow ----
def arm(side, name, swing, spread, elbow_bend, wrist):
    a = b.pivot(f"Arm{name}", (side * 0.265, 0, 1.115), parent=root, rotation=(swing, side * -spread, 0))
    ol(b.ball(f"Shoulder{name}", 0.105, (0, 0, -0.01), mat=shirt, parent=a, segments=24, rings=12), 0.013)
    sl = b.capsule(f"Sleeve{name}", 0.1, 0.1, (0, 0, -0.1), mat=shirt, parent=a, radius_bottom=0.093,
                   segments=24, rings=12)
    ol(sl, 0.013)
    roll = b.torus(f"SleeveRoll{name}", 0.083, 0.036, (0, 0, -0.205), (0.12, 0, 0), mat=shirt, parent=a,
                   segments=24, minor_segments=10)
    for v in roll.data.vertices:  # make the rolled cuff a bit uneven
        ang = math.atan2(v.co.y, v.co.x)
        v.co.z += 0.012 * math.sin(2 * ang + side)
    ol(roll, 0.011)
    el = b.pivot(f"Elbow{name}", (0, 0, -0.225), parent=a, rotation=(elbow_bend, 0, 0))
    ol(b.capsule(f"Forearm{name}", 0.056, 0.13, (0, 0, -0.08), mat=skin, parent=el, radius_bottom=0.046,
                 segments=16, rings=8), 0.011)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.2), parent=el, rotation=wrist)
    return a, hand


arm_l, hand_l = arm(1, "L", 0.05, 0.2, -0.22, (0, 0, 0))
arm_r, hand_r = arm(-1, "R", -0.12, 0.26, -0.55, (0.15, 0, 0.3))

# Left hand: relaxed, fingers loosely curled, thumb forward.
ol(b.ball("PalmL", 0.056, (0, 0, -0.03), scale=(0.62, 1.0, 1.05), mat=skin, parent=hand_l, segments=16, rings=8),
   0.009)
for i, y in enumerate((-0.033, -0.011, 0.011, 0.033)):
    f = b.capsule(f"FingerL{i}", 0.017, 0.04, (-0.008, y * 1.05, -0.09 + abs(y) * 0.4), (0, -0.35, 0),
                  mat=skin, parent=hand_l, segments=10, rings=6)
    ol(f, 0.007)
ol(b.capsule("ThumbL", 0.019, 0.035, (-0.025, -0.045, -0.035), (0.5, -0.4, 0), mat=skin, parent=hand_l,
             segments=10, rings=6), 0.007)

# Right hand: a fist wrapped around the sword's grip (the grip runs along the hand's Z axis).
ol(b.ball("PalmR", 0.056, (0.012, 0, -0.035), scale=(0.7, 1.0, 1.05), mat=skin, parent=hand_r, segments=16,
          rings=8), 0.009)
for i, z in enumerate((-0.012, -0.036, -0.06, -0.083)):
    f = b.torus(f"FingerR{i}", 0.03, 0.0125, (-0.005, 0, z - 0.012), (0, 0, math.radians(-30)), mat=skin,
                parent=hand_r, segments=12, minor_segments=6, arc=math.radians(200))
    ol(f, 0.006)
ol(b.capsule("ThumbR", 0.018, 0.035, (-0.02, -0.035, -0.01), (0.2, -0.9, -0.4), mat=skin, parent=hand_r,
             segments=10, rings=6), 0.007)

# ---- Sword: short, broad blade with a ridge, brass guard and pommel, a wrapped wooden grip ----
sword = b.pivot("Sword", (-0.005, 0, -0.05), parent=hand_r, rotation=(0, 0, 0))
ol(b.cylinder("Grip", 0.022, 0.15, (0, 0, 0), mat=wood, parent=sword, segments=12), 0.006)
for i, z in enumerate((-0.05, -0.025, 0.0, 0.025, 0.05)):
    b.torus(f"Wrap{i}", 0.023, 0.006, (0, 0, z), (0.25, 0, 0), mat=leather, parent=sword, segments=12,
            minor_segments=5)
ol(b.ball("Pommel", 0.034, (0, 0, 0.1), scale=(1, 1, 0.9), mat=brass, parent=sword, segments=14, rings=8), 0.007)
guard = b.from_points("Guard", [(0.0, -0.025), (0.03, -0.024), (0.034, 0.0), (0.03, 0.024), (0.0, 0.025)],
                      (0, 0, -0.095), (0, math.pi / 2, 0), mat=brass, parent=sword, segments=10,
                      scale=(1, 0.8, 1))
for v in guard.data.vertices:  # stretch into a slightly curved bar
    v.co.z *= 5.2
    v.co.x += 0.01 * (v.co.z / 0.13) ** 2
ol(guard, 0.007)
for s in (1, -1):
    ol(b.ball(f"GuardEnd{s}", 0.022, (s * 0.135, 0, -0.087), mat=brass, parent=sword, segments=10, rings=6), 0.005)


def blade_mesh(name, length=0.56, width=0.1, thick=0.022, location=(0, 0, 0), parent=None, mat=None):
    """A diamond cross-section blade with a pointed tip, flat-shaded so each bevel paints as one tone."""
    bm = bmesh.new()
    stations = [(0.0, 1.0), (0.15, 0.97), (0.5, 0.93), (0.78, 0.82), (0.9, 0.55), (1.0, 0.0)]
    rings = []
    for f, w in stations:
        z = -f * length
        hw = width / 2 * w
        ht = thick / 2 * max(w, 0.15)
        ring = [bm.verts.new((hw, 0, z)), bm.verts.new((0, -ht, z)), bm.verts.new((-hw, 0, z)),
                bm.verts.new((0, ht, z))]
        rings.append(ring)
    for k in range(len(rings) - 1):
        a, c = rings[k], rings[k + 1]
        for i in range(4):
            bm.faces.new((a[i], a[(i + 1) % 4], c[(i + 1) % 4], c[i]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return b._mesh_object(name, bm, location, (0, 0, 0), mat, parent, False)


ol(blade_mesh("Blade", location=(0, 0, -0.11), parent=sword, mat=steel), 0.011)

# ---- Head ----
head = b.pivot("Head", (0, 0, 1.22), parent=root, rotation=(0.03, 0, 0.1))
C = (0, 0, 0.31)
R = (0.345, 0.325, 0.315)
ol(b.capsule("Neck", 0.062, 0.08, (0, 0, 0.0), mat=skin, parent=head, segments=16, rings=8), 0.009)
ol(b.ball("Skull", 1.0, C, scale=R, mat=skin, parent=head, segments=48, rings=24), 0.014)
# A soft jaw/cheek mass so the face is round and full at the bottom.
ol(b.ball("Jaw", 1.0, (0, -0.06, 0.2), scale=(0.28, 0.24, 0.2), mat=skin, parent=head, segments=32, rings=16),
   0.012)
for side in (1, -1):
    loc, rot = b.on_surface(C, R, side * math.radians(88), math.radians(-4), push=0.005)
    ear = b.ball(f"Ear{side}", 0.08, loc, rot, scale=(0.45, 0.85, 1.05), mat=skin, parent=head, segments=16, rings=8)
    ol(ear, 0.009)
    loc2, rot2 = b.on_surface(C, R, side * math.radians(84), math.radians(-4), push=0.035)
    b.ball(f"EarIn{side}", 0.045, loc2, rot2, scale=(0.3, 0.6, 1.0), mat=ear_in, parent=head, segments=12, rings=6)

# Eyes: big, friendly ovals with an inked upper lid line.
for side in (1, -1):
    az, el = side * math.radians(23), math.radians(1)
    loc, rot = b.on_surface(C, R, az, el, push=-0.022)
    ol(b.ball(f"EyeWhite{side}", 0.066, loc, rot, scale=(0.82, 0.42, 1.1), mat=eye_white, parent=head,
              segments=20, rings=10), 0.0055)
    loc, rot = b.on_surface(C, R, az - side * 0.02, el - 0.01, push=0.002)
    b.ball(f"Iris{side}", 0.046, loc, rot, scale=(0.85, 0.3, 1.05), mat=iris, parent=head, segments=16, rings=8)
    loc, rot = b.on_surface(C, R, az - side * 0.02, el - 0.01, push=0.01)
    b.ball(f"Pupil{side}", 0.025, loc, rot, scale=(0.9, 0.3, 1.1), mat=pupil, parent=head, segments=12, rings=6)
    loc, rot = b.on_surface(C, R, az - side * 0.05 - 0.04, el + 0.07, push=0.016)
    b.ball(f"Shine{side}", 0.012, loc, rot, mat=shine, parent=head, segments=8, rings=4)
    # Upper lid: an inked arc hugging the top of the eye.
    loc, rot = b.on_surface(C, R, az, el - 0.04, push=-0.004)
    b.torus(f"Lid{side}", 0.062, 0.0085, loc, surface_rot(rot, (-math.pi / 2, 0, 0)), mat=ink, parent=head,
            arc=math.radians(150), segments=16, minor_segments=6, scale=(0.95, 1, 1))
    # Brows: thick, friendly arcs, raised a little.
    loc, rot = b.on_surface(C, R, side * math.radians(25), math.radians(14), push=0.002)
    brow = b.torus(f"Brow{side}", 0.075, 0.0125, loc, surface_rot(rot, (-math.pi / 2, 0, side * 0.12)),
                   mat=brow_ink, parent=head, arc=math.radians(95), segments=14, minor_segments=6)
    # Rosy watercolor cheeks.
    loc, rot = b.on_surface(C, R, side * math.radians(40), math.radians(-17), push=-0.014)
    b.ball(f"Cheek{side}", 0.058, loc, rot, scale=(1.1, 0.25, 0.8), mat=cheek, parent=head, segments=16, rings=8)
# Round button nose, a little rosy.
loc, rot = b.on_surface(C, R, 0, math.radians(-9), push=0.0)
ol(b.ball("Nose", 0.04, loc, rot, scale=(1.05, 0.85, 0.9), mat=nose, parent=head, segments=16, rings=8), 0.006)
# Small smile with little dimples at the corners.
loc, rot = b.on_surface(C, R, 0, math.radians(-15), push=-0.006)
b.torus("Smile", 0.075, 0.0085, loc, surface_rot(rot, (math.pi / 2, 0, 0)), mat=mouth_ink, parent=head,
        arc=math.radians(78), segments=14, minor_segments=6)
for side in (1, -1):
    loc, rot = b.on_surface(C, R, side * math.radians(12.5), math.radians(-24), push=-0.003)
    d = b.capsule(f"Dimple{side}", 0.005, 0.016, loc, surface_rot(rot, (0, side * 0.6, 0)), mat=mouth_ink,
                  parent=head, segments=6, rings=4)

# Hair: a cap over the top and back, then lots of tapering, curling spikes in every direction,
# a messy fringe falling over the forehead, and flicks over the ears and at the nape.
HC, HR = (0, 0.06, 0.38), (0.36, 0.345, 0.33)
cap = ol(b.ball("HairCap", 1.0, HC, scale=HR, mat=hair_cap, parent=head, segments=40, rings=20), 0.012)
r = b.rng(11)
up = Vector((0, 0, 1))


def hair_point(az, el, push=0.0):
    loc, _ = b.on_surface(HC, HR, az, el, push=push)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    n = Vector((d.x / HR[0], d.y / HR[1], d.z / HR[2])).normalized()
    return Vector(loc), n


count = 0
hair_parts = []
rows = [  # (elevation, number around, length, radius)
    (1.25, 4, 0.22, 0.115), (0.88, 8, 0.23, 0.12), (0.5, 9, 0.21, 0.115), (0.12, 9, 0.19, 0.11),
    (-0.25, 8, 0.16, 0.095),
]
for row, (el, n_around, length, rad) in enumerate(rows):
    for i in range(n_around):
        az = 2 * math.pi * (i + 0.5 * (row % 2) + r.uniform(-0.2, 0.2)) / n_around
        az = math.atan2(math.sin(az), math.cos(az))
        if abs(az) < 1.3 and el < 0.8:
            continue  # leave the face clear (the fringe does the front)
        e = el + r.uniform(-0.08, 0.08)
        loc, n = hair_point(az, e, push=-0.03)
        tangent_down = (n.cross(up).cross(n)).normalized() * -1 if abs(n.z) < 0.98 else Vector((0, 1, 0))
        # Tufts lie along the head and droop; the crown sweeps back; every tip flicks outward.
        if e > 0.9:
            dirv = n * 0.5 + Vector((0, 0.9, 0)) + tangent_down * 0.3
        else:
            dirv = n * 0.42 + tangent_down * 1.0
        dirv += Vector((r.uniform(-0.25, 0.25), r.uniform(-0.25, 0.25), r.uniform(-0.1, 0.15)))
        ol(spike(f"Spike{row}_{i}", length * r.uniform(0.85, 1.2), rad * r.uniform(0.9, 1.15), loc, dirv,
                 n, bend=r.uniform(0.3, 0.6), mat=hair, parent=head), 0.0065)
        hair_parts.append(OUTLINES[-1][0])
        count += 1
# Fringe: spikes from the hairline falling over the forehead, swept toward his left.
fringe = [(-1.05, 0.62, 0.17), (-0.72, 0.7, 0.19), (-0.4, 0.74, 0.2), (-0.08, 0.76, 0.21), (0.24, 0.74, 0.2),
          (0.55, 0.7, 0.19), (0.88, 0.62, 0.17), (-0.25, 0.98, 0.2), (0.25, 0.98, 0.2), (0.0, 1.15, 0.2)]
for i, (az, el, length) in enumerate(fringe):
    loc, n = hair_point(az, el, push=-0.025)
    dirv = Vector((0.3 + az * 0.2, -0.55, -1.0)) + n * 0.25 + Vector((r.uniform(-0.1, 0.1), 0, r.uniform(-0.1, 0.1)))
    ol(spike(f"Fringe{i}", length, 0.08, loc, dirv, n, bend=r.uniform(0.35, 0.6), mat=hair,
             parent=head), 0.0065)
    hair_parts.append(OUTLINES[-1][0])
# A cowlick on top.
loc, n = hair_point(0.4, 1.25, push=-0.02)
ol(spike("Cowlick", 0.2, 0.05, loc, n + Vector((0.2, 0.4, 0.3)), Vector((0, -1, 0)), bend=0.9, mat=hair,
         parent=head), 0.008)


for o in hair_parts + [cap]:
    o.visible_shadow = False


def no_shadow(m):
    """The material casts no shadow (EEVEE ignores the object setting for shadow maps)."""
    nt = m.node_tree
    out = nt.nodes.get("Material Output")
    surf = out.inputs["Surface"].links[0].from_socket
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs[0])
    nt.links.new(surf, mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    if hasattr(m, "use_transparent_shadow"):
        m.use_transparent_shadow = True


no_shadow(hair)
no_shadow(hair_cap)


# ---- Ink outlines: inverted hulls, heavier on the shadow side and at the bottom ----
def ink_outlines(items):
    outline_mat = bpy.data.materials.new("Outline")
    outline_mat.use_nodes = True
    nt = outline_mat.node_tree
    nt.nodes.remove(nt.nodes.get("Principled BSDF"))
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = b.rgba(INK)
    nt.links.new(em.outputs[0], nt.nodes.get("Material Output").inputs["Surface"])
    outline_mat.use_backface_culling = True
    if hasattr(outline_mat, "use_backface_culling_shadow"):
        outline_mat.use_backface_culling_shadow = True
    EXPORT_COLORS[outline_mat.name] = b.rgba(INK)
    no_shadow(outline_mat)
    bpy.context.view_layer.update()
    for obj, thickness in items:
        if thickness <= 0 or obj.type != "MESH":
            continue
        mw = obj.matrix_world
        rot = mw.to_3x3()
        vg = obj.vertex_groups.new(name="InkWeight")
        for v in obj.data.vertices:
            nw = (rot @ v.normal).normalized()
            pw = mw @ v.co
            shade = 0.5 - 0.5 * nw.dot(LIGHT)  # 0 facing the light, 1 facing away
            w = 0.25 + 0.75 * shade + 0.25 * noise.noise(pw * 9.0)
            vg.add([v.index], max(0.0, min(1.0, w)), "REPLACE")
        obj.data.materials.append(outline_mat)
        mod = obj.modifiers.new("Outline", "SOLIDIFY")
        mod.thickness = thickness * 1.75
        mod.offset = 1
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.use_even_offset = False
        mod.vertex_group = vg.name
        mod.thickness_vertex_group = 0.3
        mod.material_offset = len(obj.data.materials) - 1


ink_outlines(OUTLINES)


# ---- Studio: a sheet of watercolor paper, one sun, flat paint ----
def paper_studio():
    b.studio(view="Standard")
    scene = bpy.context.scene
    for o in list(scene.collection.objects):
        if o.name in ("Floor", "Sun", "Key", "Fill", "Rim"):
            bpy.data.objects.remove(o)
    world = scene.world
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.32  # soft ambient fill so shadows aren't black
    # One sun, crisp shadows (the ramp makes them flat anyway).
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = math.pi  # Shader to RGB then reads ~cos(angle) + ~0.2 ambient
    sun.angle = math.radians(1.5)
    sun_obj = bpy.data.objects.new("Sun", sun)
    sun_obj.rotation_euler = (-LIGHT).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun_obj)
    # A weak shadowless fill from the front, so faces read flat and open (as an illustrator paints them).
    fill = bpy.data.lights.new("Fill", "SUN")
    fill.energy = math.pi * 0.3
    fill.use_shadow = False
    fill_obj = bpy.data.objects.new("Fill", fill)
    fill_obj.rotation_euler = Vector((-0.25, 1.0, -0.15)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(fill_obj)
    # A paper cyclorama: floor sweeping up into a wall behind him.
    bm = bmesh.new()
    prof = []
    for i in range(10):
        prof.append((-14 + i * 2.0, 0.0))
    for i in range(1, 13):
        a = i / 12 * math.pi / 2
        prof.append((5 + 4 * math.sin(a), 4 * (1 - math.cos(a))))
    prof.append((9, 10.0))
    prof.append((9, 18.0))
    cols = 24
    grid = []
    for j in range(cols + 1):
        x = -18 + 36 * j / cols
        grid.append([bm.verts.new((x, y, z)) for y, z in prof])
    for j in range(cols):
        for i in range(len(prof) - 1):
            bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.z < 0:  # face up and toward the camera
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Paper")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    paper_obj = bpy.data.objects.new("Paper", me)
    for p in me.polygons:  # face up / toward the camera
        pass
    paper = ink_mat("PaperSheet", "#ffffff", shadow="#c9bfd0", light=0.0, t1=0.5, tones=2, wash=1.0,
                    wash_scale=0.2, jitter=0.15, edge=0.0, image=PAPER or WASH, image_strength=0.85,
                    wash_contrast=0.0, wash_bright=0.0)
    me.materials.append(paper)
    scene.collection.objects.link(paper_obj)
    eevee = scene.eevee
    for attr, value in (("taa_render_samples", 32), ("use_raytracing", False), ("use_gtao", False),
                        ("shadow_ray_count", 1), ("shadow_step_count", 6)):
        if hasattr(eevee, attr):
            setattr(eevee, attr, value)
    scene.render.filter_size = 1.2


paper_studio()
if os.environ.get("INK_FAST"):
    b.render_all(ID, hero_size=600, turn_size=(1200, 500))
else:
    b.render_all(ID)


# ---- Export: swap the paint for plain base colors (the game will do its own toon shading) ----
def prepare_export():
    for m in bpy.data.materials:
        if m.name not in EXPORT_COLORS or not m.use_nodes:
            continue
        nt = m.node_tree
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = EXPORT_COLORS[m.name]
        p.inputs["Roughness"].default_value = 1.0
        if m.name in ("Outline", "Ink", "BrowInk", "Pupil", "Shine", "MouthInk", "SeamInk"):
            p.inputs["Emission Color"].default_value = EXPORT_COLORS[m.name]
            p.inputs["Emission Strength"].default_value = 1.0
        nt.links.new(p.outputs[0], nt.nodes.get("Material Output").inputs["Surface"])


prepare_export()
b.export(ID)
