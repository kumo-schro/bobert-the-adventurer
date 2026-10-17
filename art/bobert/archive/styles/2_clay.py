"""Style 2: Clay. A handmade plasticine figure from a stop-motion film: soft lumpy forms, fingerprints
and tool marks, slightly glossy highlights, chunky rolled-up sleeves and boot cuffs, thick coiled
eyebrows and messy hair made of flattened clay strands. Shot on a warm paper backdrop.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/2_clay.py
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "clay"
b.reset()
R = b.rng(11)

# ---------------------------------------------------------------------------------------------
# Materials: plasticine tinted by color, with the fingerprint texture as both color and bump.
# ---------------------------------------------------------------------------------------------
CLAY_TEX = b.texture(ID, "clay")


def clay_mat(name, color, roughness=0.42, scale=1.8, bump=0.8, strength=0.5, dents=0.8, **kw):
    """Tinted plasticine: the fingerprint texture for color and fine bump, plus soft, broad dents
    (where the clay was pressed with a thumb) from a noise pattern."""
    m = b.mat(name, color, roughness=roughness, image=CLAY_TEX, image_scale=scale, image_strength=strength,
              bump=bump if CLAY_TEX else 0.0, **kw)
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes.get("Principled BSDF")
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.5
    coord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 1.5
    noise.inputs["Roughness"].default_value = 0.4
    links.new(coord.outputs["Object"], noise.inputs["Vector"])
    bmp = next((n for n in nodes if n.type == "BUMP"), None)
    if bmp is None:
        bmp = nodes.new("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = dents
        bmp.inputs["Distance"].default_value = 0.02
        links.new(noise.outputs["Fac"], bmp.inputs["Height"])
        links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        img_link = bmp.inputs["Height"].links[0].from_socket
        add = nodes.new("ShaderNodeMath")
        add.operation = "MULTIPLY_ADD"
        links.new(noise.outputs["Fac"], add.inputs[0])
        add.inputs[1].default_value = dents * 2.5
        links.new(img_link, add.inputs[2])
        links.new(add.outputs[0], bmp.inputs["Height"])
    return m


skin = clay_mat("Skin", "#f6b98c", roughness=0.4, subsurface=0.12)
face = clay_mat("Face", "#f6b98c", roughness=0.4, subsurface=0.12)
nose_mat = clay_mat("Nose", "#f3a07c", roughness=0.38, subsurface=0.12)
ear_in = clay_mat("EarInner", "#e99a74", roughness=0.45)
hair = clay_mat("Hair", "#6b3e1f", roughness=0.38, scale=4.0, bump=0.45)
hair_dark = clay_mat("HairDark", "#55301a", roughness=0.4, scale=4.0, bump=0.45)
brow_mat = clay_mat("Brow", "#4a2a17", roughness=0.4)
shirt = clay_mat("Shirt", "#f2333f", roughness=0.45, scale=2.5, bump=0.4)
shirt_dark = clay_mat("ShirtFold", "#d02634", roughness=0.45, scale=2.5, bump=0.4)
pants = clay_mat("Pants", "#3d5afe", roughness=0.45, scale=2.5, bump=0.4)
boots = clay_mat("Boots", "#4a2c1a", roughness=0.33, scale=3.0, bump=0.5)
sole = clay_mat("Sole", "#2e1a10", roughness=0.5)
leather = clay_mat("Leather", "#7a4a2a", roughness=0.4, bump=0.5)
leather_dark = clay_mat("LeatherDark", "#5e3820", roughness=0.4, bump=0.5)
brass = clay_mat("Brass", "#c9973a", roughness=0.3, metallic=0.55, bump=0.4)
wood = clay_mat("Wood", "#6e4123", roughness=0.42, bump=0.5)
steel = clay_mat("Steel", "#959ba1", roughness=0.36, metallic=0.25, scale=2.5, bump=0.7, strength=0.6)
white = b.mat("EyeWhite", "#fbf7f0", roughness=0.12, coat=0.6)
iris = b.mat("Iris", "#5b3416", roughness=0.15, coat=0.6)
pupil = b.mat("Pupil", "#120a06", roughness=0.1, coat=0.6)
shine = b.mat("Shine", "#ffffff", emission="#ffffff", emission_strength=3.0)
mouth = clay_mat("Mouth", "#8c2f2f", roughness=0.45)


def add_blush(m, centers, radius=0.075, color="#ff8a8a", amount=0.55):
    """Soft rosy cheeks painted into a material, around points in the object's own space
    (mirrored on X, so one point covers both cheeks)."""
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    src = bsdf.inputs["Base Color"].links[0].from_socket if bsdf.inputs["Base Color"].links else None
    coord = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Object"], sep.inputs[0])
    absx = nodes.new("ShaderNodeMath")
    absx.operation = "ABSOLUTE"
    links.new(sep.outputs[0], absx.inputs[0])
    comb = nodes.new("ShaderNodeCombineXYZ")
    links.new(absx.outputs[0], comb.inputs[0])
    links.new(sep.outputs[1], comb.inputs[1])
    links.new(sep.outputs[2], comb.inputs[2])
    dist = nodes.new("ShaderNodeVectorMath")
    dist.operation = "DISTANCE"
    links.new(comb.outputs[0], dist.inputs[0])
    dist.inputs[1].default_value = centers
    ramp = nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = radius * 0.2
    ramp.inputs["From Max"].default_value = radius
    ramp.inputs["To Min"].default_value = amount
    ramp.inputs["To Max"].default_value = 0.0
    links.new(dist.outputs["Value"], ramp.inputs["Value"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MIX"
    links.new(ramp.outputs["Result"], mix.inputs["Factor"])
    if src:
        links.new(src, mix.inputs["A"])
    else:
        mix.inputs["A"].default_value = bsdf.inputs["Base Color"].default_value
    mix.inputs["B"].default_value = b.rgba(color)
    links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])


# ---------------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------------

def lumpy(obj, strength=0.008, size=0.09, pre=0, post=0):
    """Hand-pressed clay: optional subdivision, noise lumps, then optional smoothing subdivision."""
    if pre:
        b.subdivide(obj, pre)
    b.displace(obj, strength=strength, size=size)
    if post:
        b.subdivide(obj, post)
    return obj


def compose(rot, extra):
    """Euler `rot` followed by `extra` applied in the rotated (local) frame."""
    return (Euler(rot).to_matrix() @ Euler(extra).to_matrix()).to_euler()


def euler(x=0.0, y=0.0, z=0.0):
    return Euler((x, y, z))


def mesh_from(name, verts, faces, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None, smooth=True):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return b._mesh_object(name, bm, location, rotation, mat, parent, smooth)


def tube(name, path, radii, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None, around=10,
         flat=1.0, twist=0.0, tip=True, up=(1, 0, 0)):
    """A rolled clay coil / strand along a list of points, with a radius per point.
    flat < 1 squashes it into a ribbon (thin along the frame's Y). tip=True ends in a point."""
    pts = [Vector(p) for p in path]
    n = len(pts)
    verts, faces = [], []
    side = Vector(up)
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        x = (side - t * side.dot(t)).normalized()
        y = t.cross(x)
        tw = twist * i / max(n - 1, 1)
        for j in range(around):
            a = 2 * math.pi * j / around + tw
            r = radii[i]
            verts.append(tuple(p + x * (r * math.cos(a)) + y * (r * flat * math.sin(a))))
    for i in range(n - 1):
        for j in range(around):
            a, c = i * around, (i + 1) * around
            faces.append((a + j, a + (j + 1) % around, c + (j + 1) % around, c + j))
    # caps
    t0 = (pts[1] - pts[0]).normalized()
    verts.append(tuple(pts[0] - t0 * radii[0] * 0.6))
    s = len(verts) - 1
    for j in range(around):
        faces.append((s, (j + 1) % around, j))
    t1 = (pts[-1] - pts[-2]).normalized()
    verts.append(tuple(pts[-1] + t1 * (radii[-1] * (0.4 if tip else 0.6))))
    e = len(verts) - 1
    last = (n - 1) * around
    for j in range(around):
        faces.append((e, last + j, last + (j + 1) % around))
    return mesh_from(name, verts, faces, location, rotation, mat, parent)


def frame_rot(z_axis, y_hint):
    """Rotation whose local Z is z_axis and local Y points along y_hint (made perpendicular)."""
    z = Vector(z_axis).normalized()
    y = Vector(y_hint)
    y = (y - z * y.dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def world_to_local(parent, world_rot3):
    bpy.context.view_layer.update()
    pw = parent.matrix_world.to_3x3().normalized()
    return (pw.inverted() @ world_rot3).to_euler()


root = b.pivot("Bobert")

# ---------------------------------------------------------------------------------------------
# Legs: slightly baggy trousers into tall boots with a fat folded-over cuff.
# ---------------------------------------------------------------------------------------------
for side, name in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{name}", (side * 0.125, 0, 0.8), parent=root, rotation=(0, side * -0.07, side * 0.0))
    lumpy(b.from_points(f"Trousers{name}", [(0.06, 0.02), (0.115, 0.0), (0.13, -0.06), (0.125, -0.2),
                                            (0.115, -0.32), (0.112, -0.42), (0.11, -0.47), (0.08, -0.49)],
                        mat=pants, parent=leg, segments=28), 0.012, 0.08, post=1)
    foot = b.pivot(f"Foot{name}", (0, 0, -0.62), parent=leg, rotation=(0, side * 0.07, side * -0.12))
    # Boot shaft (lathe), cuff folded over the top, big rounded toe and a thick sole.
    lumpy(b.from_points(f"Boot{name}", [(0.105, -0.15), (0.125, -0.13), (0.128, -0.02), (0.128, 0.06),
                                        (0.11, 0.07)],
                        mat=boots, parent=foot, segments=28, scale=(1, 1.05, 1)), 0.008, 0.07, post=1)
    lumpy(b.from_points(f"BootCuff{name}", [(0.125, 0.04), (0.15, 0.045), (0.158, 0.09), (0.162, 0.14),
                                            (0.154, 0.165), (0.13, 0.172), (0.118, 0.14)],
                        mat=boots, parent=foot, segments=28, scale=(1, 1.06, 1)), 0.01, 0.06, post=1)
    lumpy(b.ball(f"Toe{name}", 1.0, (0, -0.1, -0.11), scale=(0.135, 0.17, 0.085), mat=boots, parent=foot,
                 segments=24, rings=12), 0.008, 0.07, post=1)
    lumpy(b.ball(f"Sole{name}", 1.0, (0, -0.065, -0.152), scale=(0.148, 0.215, 0.034), mat=sole, parent=foot,
                 segments=24, rings=10), 0.004, 0.06)

# ---------------------------------------------------------------------------------------------
# Body: tunic with a small flare, a fat collar coil and a V slit; belt, round brass buckle, pouch.
# ---------------------------------------------------------------------------------------------
body = b.pivot("Body", (0, 0, 0), parent=root)
tunic = b.from_points("Tunic", [(0.31, 0.555), (0.318, 0.59), (0.29, 0.68), (0.255, 0.8), (0.245, 0.9),
                                (0.25, 1.0), (0.255, 1.06), (0.23, 1.12), (0.17, 1.17), (0.11, 1.2), (0.08, 1.2)],
                      mat=shirt, parent=body, segments=40, scale=(1, 0.76, 1))
lumpy(tunic, 0.026, 0.1, post=1)
lumpy(b.torus("Hem", 0.312, 0.022, (0, 0, 0.568), mat=shirt_dark, parent=body, scale=(1, 0.77, 1),
              segments=40, minor_segments=8), 0.008, 0.06)
lumpy(b.torus("Collar", 0.115, 0.032, (0, -0.005, 1.195), mat=shirt_dark, parent=body, scale=(1, 0.85, 1),
              segments=28, minor_segments=8), 0.006, 0.05)
# V slit at the neck: two lips of clay and a dark gap.
b.box("Slit", (0.012, 0.03, 0.06), (0, -0.162, 1.15), (0.4, 0, 0), mat=b.mat("SlitDark", "#7e1f2c", roughness=0.6),
      parent=body, bevel=0.007, segments=2)
for s in (1, -1):
    lip = b.capsule(f"SlitLip{s}", 0.011, 0.05, (s * 0.014, -0.162, 1.15), (0.4, s * 0.3, 0), mat=shirt,
                    parent=body, segments=8, rings=6)
# Side slits at the hem
for s in (1, -1):
    b.box(f"HemSlit{s}", (0.012, 0.05, 0.07), (s * 0.305, 0, 0.6), mat=shirt_dark,
          parent=body, bevel=0.005, segments=1)
# Fabric folds: soft ridges pressed into the tunic below the belt and at the chest.
for k, (th, z, ln, tilt) in enumerate(((-0.6, 0.66, 0.13, 0.12), (-0.1, 0.665, 0.14, -0.08), (0.35, 0.665, 0.12, 0.15),
                                       (1.1, 0.665, 0.12, -0.1), (2.5, 0.665, 0.13, 0.1), (3.3, 0.665, 0.13, -0.12),
                                       (-1.2, 0.665, 0.12, 0.1))):
    zr = [(0.31, 0.555), (0.318, 0.59), (0.29, 0.68), (0.255, 0.8), (0.245, 0.9), (0.25, 1.0)]
    r = next(r1 + (r2 - r1) * (z - z1) / (z2 - z1) for (r1, z1), (r2, z2) in zip(zr, zr[1:]) if z1 <= z <= z2)
    pos = (r * math.sin(th) * 0.955, -r * 0.76 * math.cos(th) * 0.955, z)
    fold = b.capsule(f"Fold{k}", 0.02, ln, pos, (0, 0, 0), mat=shirt, parent=body, segments=10, rings=6,
                     radius_bottom=0.026, scale=(1, 0.6, 1))
    fold.rotation_euler = (frame_rot(Vector((math.sin(tilt) * math.cos(th), math.sin(tilt) * math.sin(th), 1)),
                                     (math.sin(th), -math.cos(th), 0))).to_euler()
    lumpy(fold, 0.003, 0.03)
# Belt: a pressed-flat strap
belt = b.torus("Belt", 0.262, 0.03, (0, 0, 0.8), mat=leather, parent=body, scale=(1, 0.775, 1.7),
               segments=40, minor_segments=8)
lumpy(belt, 0.005, 0.05)
# Round brass buckle with a prong
buckle = b.torus("Buckle", 0.042, 0.013, (0, -0.215, 0.8), (math.pi / 2, 0, 0), mat=brass, parent=body,
                 segments=24, minor_segments=8, scale=(1.05, 1, 1))
lumpy(buckle, 0.003, 0.03)
b.capsule("BuckleProng", 0.008, 0.06, (0, -0.226, 0.8), (0, math.pi / 2, 0.0), mat=brass, parent=body,
          segments=8, rings=6)
# Pouch on his left hip
pouch = b.pivot("PouchPivot", (0.215, -0.13, 0.72), parent=body, rotation=(0, 0, 0.62))
lumpy(b.box("Pouch", (0.15, 0.085, 0.15), (0, 0, 0), mat=leather, parent=pouch, bevel=0.035, segments=3),
      0.006, 0.05, post=1)
lumpy(b.box("PouchFlap", (0.155, 0.09, 0.065), (0, -0.006, 0.05), (0.12, 0, 0), mat=leather_dark,
            parent=pouch, bevel=0.025, segments=3), 0.005, 0.05, post=1)
b.ball("PouchStud", 0.018, (0, -0.054, 0.035), scale=(1, 0.6, 1), mat=brass, parent=pouch, segments=12, rings=8)
b.box("PouchStrap", (0.04, 0.02, 0.07), (0, 0.0, 0.1), mat=leather_dark, parent=pouch, bevel=0.008, segments=2)


# ---------------------------------------------------------------------------------------------
# Arms: puffy short sleeve, chunky rolled-up cuff, bare forearm, big chubby fist.
# ---------------------------------------------------------------------------------------------
def fist(name, hand, g_world, thumb_side, holding):
    """A clay fist around a grip axis g_world (world space). Returns the grip pivot."""
    bpy.context.view_layer.update()
    to_wrist = hand.matrix_world.to_3x3().normalized() @ Vector((0, 0, 1))
    grip = b.pivot(f"Grip{name}", (0, -0.005, -0.075), parent=hand)
    grip.rotation_euler = world_to_local(hand, frame_rot(g_world, to_wrist))
    gr = 0.03  # grip radius
    lumpy(b.ball(f"Palm{name}", 1.0, (0, 0.045, 0), scale=(0.055, 0.06, 0.07), mat=skin, parent=grip,
                 segments=20, rings=12), 0.004, 0.04)
    if not holding:
        b.ball(f"FistCore{name}", 0.032, (0, 0, 0), mat=skin, parent=grip, segments=12, rings=8)
    for i, (z, rad) in enumerate(((0.048, 0.022), (0.016, 0.023), (-0.016, 0.022), (-0.046, 0.019))):
        f = b.torus(f"Finger{name}{i}", gr + rad * 0.85, rad, (0, 0, z), (0, 0, 0), mat=skin, parent=grip,
                    arc=math.radians(235), segments=12, minor_segments=8)
        lumpy(f, 0.003, 0.03)
    # Thumb: wraps over the fingers on one side.
    th = b.capsule(f"Thumb{name}", 0.021, 0.045, (thumb_side * 0.035, -0.02, 0.055),
                   (0, 0, 0), mat=skin, parent=grip, segments=10, rings=6)
    th.rotation_euler = (frame_rot(Vector((-thumb_side * 0.8, -0.6, 0.15)), (0, 0, 1))).to_euler()
    return grip


def arm(side, name, swing, spread, bend):
    a = b.pivot(f"Arm{name}", (side * 0.268, 0, 1.065), parent=root, rotation=(swing, side * -spread, 0))
    lumpy(b.ball(f"Shoulder{name}", 0.095, (0, 0, -0.015), scale=(0.95, 1, 1.0), mat=shirt, parent=a,
                 segments=24, rings=12), 0.008, 0.07)
    lumpy(b.capsule(f"Sleeve{name}", 0.088, 0.08, (0, 0, -0.1), mat=shirt, parent=a, radius_bottom=0.085,
                    segments=24, rings=12), 0.008, 0.07)
    # Rolled-up cuff: two fat coils, slightly uneven.
    lumpy(b.torus(f"Roll{name}0", 0.08, 0.03, (0, 0, -0.17), (0.08, -0.06, 0), mat=shirt_dark, parent=a,
                  segments=22, minor_segments=8, scale=(1, 0.95, 1)), 0.005, 0.05)
    lumpy(b.torus(f"Roll{name}1", 0.076, 0.026, (0, 0, -0.205), (-0.06, 0.05, 0), mat=shirt, parent=a,
                  segments=22, minor_segments=8, scale=(1, 0.95, 1)), 0.005, 0.05)
    elbow = b.pivot(f"Elbow{name}", (0, 0, -0.21), parent=a, rotation=(bend, 0, 0))
    lumpy(b.capsule(f"Forearm{name}", 0.06, 0.16, (0, 0, -0.1), mat=skin, parent=elbow, radius_bottom=0.048,
                    segments=20, rings=10), 0.005, 0.05)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.23), parent=elbow)
    return a, hand


arm_l, hand_l = arm(1, "L", 0.06, 0.2, -0.15)
arm_r, hand_r = arm(-1, "R", -0.2, 0.24, -0.45)

# Left: a relaxed fist, knuckles forward.
fist("L", hand_l, Vector((0.15, -1, -0.15)), thumb_side=-1, holding=False)
# Right: the sword, blade pointing down, forward and a little out to his right.
blade_dir = Vector((-0.3, -0.55, -0.78)).normalized()
grip_r = fist("R", hand_r, blade_dir, thumb_side=1, holding=True)

# ---------------------------------------------------------------------------------------------
# Sword: a stubby clay blade with a hammered surface, chunky wooden guard, wrapped grip, round pommel.
# ---------------------------------------------------------------------------------------------
sword = b.pivot("Sword", (0, 0, 0), parent=grip_r)
lumpy(b.cylinder("SwordGrip", 0.03, 0.17, (0, 0, 0), mat=leather_dark, parent=sword, segments=14), 0.003, 0.03)
lumpy(b.ball("Pommel", 0.048, (0, 0, -0.115), mat=wood, parent=sword, segments=16, rings=10), 0.004, 0.04)
lumpy(b.ball("Guard", 1.0, (0, 0, 0.1), scale=(0.05, 0.12, 0.035), mat=wood, parent=sword, segments=24,
             rings=12), 0.005, 0.04, post=1)
# Blade: a lens-shaped cross-section that swells a little, then tapers to a point.
bl_verts, bl_faces = [], []
SECT, AROUND, BL = 12, 10, 0.56
for i in range(SECT + 1):
    t = i / SECT
    w = 0.056 * (1 + 0.12 * math.sin(math.pi * t * 0.8)) * (1 if t < 0.72 else max(0.0, (1 - t) / 0.28) ** 0.8)
    th = 0.013 * (1 - 0.5 * t)
    for j in range(AROUND):
        a = 2 * math.pi * j / AROUND
        bl_verts.append((th * math.sin(a) * (1 - 0.3 * abs(math.cos(a))), w * math.cos(a), 0.12 + BL * t))
for i in range(SECT):
    for j in range(AROUND):
        a, c = i * AROUND, (i + 1) * AROUND
        bl_faces.append((a + j, a + (j + 1) % AROUND, c + (j + 1) % AROUND, c + j))
bl_faces.append(tuple(reversed(range(AROUND))))
blade = mesh_from("Blade", bl_verts, bl_faces, (0, 0, 0), (0, 0, 0), mat=steel, parent=sword)
lumpy(blade, 0.003, 0.04, pre=1)

# ---------------------------------------------------------------------------------------------
# Head: big round face, bead eyes under clay lids, coiled brows, ball nose, a pressed-in smile,
# big ears and painted rosy cheeks.
# ---------------------------------------------------------------------------------------------
head = b.pivot("Head", (0, 0, 1.18), parent=root, rotation=(0.03, 0, 0.05))
C = (0, 0, 0.345)
HR = (0.335, 0.315, 0.322)
lumpy(b.capsule("Neck", 0.078, 0.06, (0, 0, 0.04), mat=skin, parent=head, segments=16, rings=8), 0.004, 0.04)
skull = b.ball("Skull", 1.0, C, scale=HR, mat=face, parent=head, segments=56, rings=28)
# Slightly fuller jaw/cheeks.
for v in skull.data.vertices:
    z = v.co.z / HR[2]
    front = max(0.0, -v.co.y / HR[1])
    v.co.x *= 1.0 + 0.07 * math.exp(-((z + 0.3) / 0.35) ** 2) - 0.04 * max(0.0, z) ** 2
    if z < -0.6:
        v.co.z += 0.02 * (-0.6 - z) / 0.4  # softer, flatter chin
lumpy(skull, 0.006, 0.08)
cheek_pt, _ = b.on_surface((0, 0, 0), HR, math.radians(36), math.radians(-16))
add_blush(face, (abs(cheek_pt[0]), cheek_pt[1], cheek_pt[2]), radius=0.085, amount=0.6)

for side in (1, -1):
    loc, rot = b.on_surface(C, HR, side * math.radians(86), math.radians(-6), push=0.008)
    ear = b.ball(f"Ear{side}", 1.0, loc, rot, scale=(0.07, 0.04, 0.095), mat=skin, parent=head,
                 segments=18, rings=10)
    lumpy(ear, 0.003, 0.03)
    loc2, rot2 = b.on_surface(C, HR, side * math.radians(86), math.radians(-6), push=0.036)
    b.ball(f"EarIn{side}", 1.0, loc2, rot2, scale=(0.034, 0.01, 0.05), mat=ear_in, parent=head,
           segments=12, rings=8)
    ear_coil = b.torus(f"EarCoil{side}", 0.04, 0.011, loc2, mat=skin, parent=head, arc=math.radians(250),
                       segments=14, minor_segments=6, scale=(0.85, 1.25, 1))
    ear_coil.rotation_euler = compose(Euler(rot2), euler(math.pi / 2, 0, math.pi / 2 * side * 0 + math.pi))

for side in (1, -1):
    az, el = side * math.radians(21), math.radians(1)
    loc, rot = b.on_surface(C, HR, az, el, push=-0.03)
    b.ball(f"EyeWhite{side}", 1.0, loc, rot, scale=(0.068, 0.05, 0.08), mat=white, parent=head,
           segments=24, rings=14)
    loc, rot = b.on_surface(C, HR, az - side * math.radians(0.5), el - math.radians(1.0), push=0.011)
    b.ball(f"Iris{side}", 1.0, loc, rot, scale=(0.037, 0.012, 0.042), mat=iris, parent=head, segments=20, rings=10)
    loc, rot = b.on_surface(C, HR, az - side * math.radians(0.5), el - math.radians(1.0), push=0.018)
    b.ball(f"Pupil{side}", 1.0, loc, rot, scale=(0.021, 0.008, 0.024), mat=pupil, parent=head, segments=16, rings=8)
    loc, rot = b.on_surface(C, HR, az + math.radians(2.5), el + math.radians(3), push=0.024)
    b.ball(f"Shine{side}", 0.008, loc, rot, mat=shine, parent=head, segments=10, rings=6)
    # Upper lid: a thin coil of skin-colored clay along the top of the eyeball.
    loc, rot = b.on_surface(C, HR, az, el, push=-0.012)
    lid = b.torus(f"Lid{side}", 0.075, 0.012, loc, mat=face, parent=head, arc=math.radians(150),
                  segments=16, minor_segments=6, scale=(0.92, 1.08, 1.0))
    lid.rotation_euler = compose(Euler(rot), euler(-math.pi / 2, 0, 0))
    # Brow: a thick rolled coil of dark clay, arched.
    loc, rot = b.on_surface(C, HR, side * math.radians(23), math.radians(17), push=0.0)
    brow = b.torus(f"Brow{side}", 0.075, 0.021, loc, mat=brow_mat, parent=head, arc=math.radians(70),
                   segments=12, minor_segments=8)
    brow.rotation_euler = compose(Euler(rot), euler(-math.pi / 2, 0, side * 0.0))
    brow.rotation_euler = compose(brow.rotation_euler, euler(0, side * math.radians(-6), 0))
    brow.location = Vector(brow.location) + Vector((0, 0, -0.045))
    lumpy(brow, 0.002, 0.02)

loc, rot = b.on_surface(C, HR, 0, math.radians(-10), push=0.002)
lumpy(b.ball("Nose", 1.0, loc, rot, scale=(0.045, 0.04, 0.04), mat=nose_mat, parent=head, segments=20, rings=12),
      0.002, 0.03)
# Small smile, pressed into the clay.
loc, rot = b.on_surface(C, HR, math.radians(2), math.radians(-25), push=0.0)
smile = b.torus("Smile", 0.06, 0.011, loc, mat=mouth, parent=head, arc=math.radians(105), segments=14,
                minor_segments=6)
smile.rotation_euler = compose(Euler(rot), euler(math.pi / 2, 0, 0))
smile.location = Vector(loc) + Euler(rot).to_matrix() @ Vector((0, 0, 0.056))

# ---------------------------------------------------------------------------------------------
# Hair: a lumpy clay cap plus lots of flattened, pointed clay strands that flick out every way.
# ---------------------------------------------------------------------------------------------
HC, HRAD = (0, 0.02, 0.36), (0.358, 0.345, 0.345)
cap = b.ball("HairCap", 1.0, HC, scale=HRAD, mat=hair, parent=head, segments=40, rings=20)
# Open the cap over the face so the forehead shows; it still covers the back of the head.
bm = bmesh.new()
bm.from_mesh(cap.data)
kill = []
for v in bm.verts:
    d = Vector((v.co.x / HRAD[0], v.co.y / HRAD[1], v.co.z / HRAD[2]))
    az = abs(math.atan2(d.x, -d.y))
    el = math.asin(max(-1, min(1, d.z)))
    if az < 1.2:
        cut = 0.5 - 0.1 * az + 0.1 * (az / 1.2) ** 2
    else:
        cut = 0.5 - 1.6 * min(1.0, (az - 1.2) / 1.4)
    if el < cut:
        kill.append(v)
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.to_mesh(cap.data)
bm.free()
solid = cap.modifiers.new("Thick", "SOLIDIFY")
solid.thickness = 0.025
lumpy(cap, 0.012, 0.07)


def hair_strand(i, az, el, flow, lift, length, width, curl, mat=hair, flat=0.34):
    """A flattened clay strand rooted on the cap at (az, el). flow: direction along the surface
    (0 = up over the crown, pi = straight down, +pi/2 = toward his left). lift: how much it rises
    off the head. curl: how much the tip flicks outward."""
    p, _ = b.on_surface(HC, HRAD, az, el, push=-0.006)
    p = Vector(p)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    n = Vector((d.x / HRAD[0], d.y / HRAD[1], d.z / HRAD[2])).normalized()
    up = Vector((0, 0, 1))
    u = up - n * up.dot(n)
    u = u.normalized() if u.length > 1e-3 else Vector((0, 1, 0))
    e = u.cross(n).normalized()  # toward his left when seen from the front
    fdir = (u * math.cos(flow) + e * math.sin(flow)).normalized()
    steps = 8
    path, radii = [], []
    bend = R.uniform(-0.3, 0.3)
    # Follow the head's curve (stay on a slightly bigger ellipsoid), then flick out at the tip.
    pos = p.copy()
    direction = (fdir * math.cos(lift) + n * math.sin(lift)).normalized()
    seg = length / steps
    for k in range(steps + 1):
        t = k / steps
        path.append(tuple(pos))
        radii.append(width * max(0.05, (1 - t) ** 0.8) * (0.8 + 0.5 * math.sin(math.pi * min(1.0, t * 1.4))))
        rel = pos - Vector(HC)
        dn = Vector((rel.x / HRAD[0] ** 2, rel.y / HRAD[1] ** 2, rel.z / HRAD[2] ** 2)).normalized()
        side = dn.cross(direction).normalized()
        # bend toward the head surface (hug) early on, outward (flick) near the tip
        hug = -0.35 * (1 - t) + curl * 2.2 * t * t
        direction = (direction + dn * hug * seg / max(length, 1e-3) * 3 + side * bend * seg * 2).normalized()
        pos = pos + direction * seg
    rel = Vector(path[0]) - Vector(HC)
    dn = Vector((rel.x / HRAD[0] ** 2, rel.y / HRAD[1] ** 2, rel.z / HRAD[2] ** 2)).normalized()
    sidev = dn.cross(fdir).normalized()
    return tube(f"Strand{i}", path, radii, mat=mat, parent=head, around=8, flat=flat, up=tuple(sidev),
                twist=R.uniform(-0.35, 0.35))


idx = 0
# Layers over the back and sides, flowing down and around, tips flicking out.
rows = [  # elevation, count, length, width, lift, curl
    (1.3, 6, 0.24, 0.085, 0.25, 0.3),
    (1.0, 10, 0.25, 0.085, 0.18, 0.35),
    (0.68, 12, 0.24, 0.08, 0.14, 0.4),
    (0.36, 11, 0.21, 0.075, 0.12, 0.45),
    (0.04, 9, 0.18, 0.07, 0.1, 0.5),
    (-0.3, 7, 0.15, 0.065, 0.08, 0.55),
    (-0.55, 7, 0.14, 0.065, 0.06, 0.6),
    (-0.78, 6, 0.13, 0.065, 0.05, 0.7),
    (-0.98, 5, 0.11, 0.06, 0.04, 0.8),
]
for row, (el, count, ln, wd, lift, curl) in enumerate(rows):
    for i in range(count):
        az = 2 * math.pi * (i + 0.5 * (row % 2) + R.uniform(-0.15, 0.15)) / count
        az = math.atan2(math.sin(az), math.cos(az))
        limit = (0.0, 0.85, 1.2, 1.2, 1.45, 1.8, 2.05, 2.3, 2.45)[row]
        if abs(az) < limit:
            continue  # the face, and the fringe covers the front of the top
        flow = math.pi + R.uniform(-0.4, 0.4) + (0.35 if az > 0 else -0.35)
        mat_ = hair_dark if R.random() < 0.3 else hair
        hair_strand(idx, az, el + R.uniform(-0.05, 0.05), flow, lift + R.uniform(-0.04, 0.08),
                    ln * R.uniform(0.85, 1.15), wd * R.uniform(0.9, 1.1), curl * R.uniform(0.75, 1.25), mat_)
        idx += 1
# Crown: a few tufts standing up and back.
for i, (az, flow) in enumerate(((-2.6, 3.0), (-1.4, 2.6), (0.2, 3.3), (1.5, 3.6), (2.8, 3.2))):
    hair_strand(idx, az, 1.3, flow, 0.75, 0.21, 0.085, 0.5, hair_dark if i % 2 else hair)
    idx += 1
# Fringe: chunky strands from the top of the head sweeping down over the forehead, swinging to
# his left, tips flicking up and out above the brows.
fringe = [  # az, el, flow, length, width, curl, lift
    (-0.75, 0.95, 3.5, 0.27, 0.085, 0.5, 0.1),
    (-0.4, 1.1, 3.35, 0.31, 0.09, 0.45, 0.08),
    (-0.05, 1.12, 3.0, 0.32, 0.095, 0.45, 0.08),
    (0.3, 1.08, 2.75, 0.3, 0.09, 0.5, 0.08),
    (0.65, 0.95, 2.55, 0.27, 0.085, 0.55, 0.1),
    (1.0, 0.8, 2.6, 0.2, 0.075, 0.6, 0.12),
    (-1.05, 0.75, 3.7, 0.2, 0.075, 0.6, 0.12),
    (0.15, 1.35, 3.1, 0.24, 0.09, 0.4, 0.15),
    (-0.3, 1.4, 3.3, 0.22, 0.085, 0.4, 0.18),
]
for az, el, flow, ln, wd, curl, lift in fringe:
    hair_strand(idx, az, el, flow, lift, ln, wd, curl, hair if idx % 3 else hair_dark)
    idx += 1

# ---------------------------------------------------------------------------------------------
# Studio: a warm paper sweep, soft light.
# ---------------------------------------------------------------------------------------------
b.studio(background="#efe3d3", ground="#ece0cf", view="AgX", look="AgX - Punchy", key=3.4, fill=1.1, rim=2.2,
         sun=2.2, shadow_softness=0.45, exposure=0.15)
floor = bpy.data.objects.get("Floor")
floor.hide_render = True
# Seamless sweep: floor that curves up into a back wall.
sv, sf = [], []
prof = []
for k in range(14):
    y = -6 + k * 0.6
    prof.append((y, 0.0))
for k in range(1, 13):
    a = (math.pi / 2) * k / 12
    prof.append((1.8 + 2.2 * math.sin(a), 2.2 * (1 - math.cos(a))))
prof.append((4.0, 8.0))
xs = [-10 + 2 * i for i in range(11)]
for y, z in prof:
    for x in xs:
        sv.append((x, y, z))
nx = len(xs)
for k in range(len(prof) - 1):
    for i in range(nx - 1):
        a, c = k * nx + i, (k + 1) * nx + i
        sf.append((a, a + 1, c + 1, c))
bm = bmesh.new()
vs = [bm.verts.new(v) for v in sv]
for f in sf:
    bm.faces.new([vs[i] for i in f])
sweep_mesh = bpy.data.meshes.new("Sweep")
bm.to_mesh(sweep_mesh)
bm.free()
sweep = bpy.data.objects.new("Sweep", sweep_mesh)
for p in sweep.data.polygons:
    p.use_smooth = True
sweep.data.materials.append(b.mat("Paper", "#efe3d3", roughness=0.95))
bpy.context.scene.collection.objects.link(sweep)

if os.environ.get("CLAY_PREVIEW"):
    # Quick look at the head (front and 3/4) without the full renders.
    scene = bpy.context.scene
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x, scene.render.resolution_y = 1000, 600
    print(f"TRIANGLES {ID}: {b.triangles()}")
    out = os.environ["CLAY_PREVIEW"]
    for k, (cam_loc, tgt) in enumerate((((0, -3.2, 1.6), (0, 0, 1.5)), ((-1.9, -2.5, 1.85), (0, 0, 1.45)),
                                        ((1.2, 3.0, 1.55), (0, 0, 1.4)))):
        cam = b._camera(f"Prev{k}", cam_loc, tgt, lens=85)
        scene.camera = cam
        scene.render.filepath = f"{out}_{k}.png"
        bpy.ops.render.render(write_still=True)
else:
    b.render_all(ID)
    b.export(ID)
