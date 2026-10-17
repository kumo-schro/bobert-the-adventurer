"""Style 2: Cloaked Fox. Bobert as a young fox rogue in a tattered, deep charcoal-indigo hooded cloak,
in a moody, moonlit dark-fantasy picture-book style: rusty orange fur with a white chest and cheeks,
big pointed ears poking out of the hood, clever amber eyes and a sly smile, leather straps, belt and
pouches, bracers and wrapped shins, baggy dark trousers, furry dark paws, a huge bushy white-tipped
tail and a curved silver dagger with an ornate guard, held low and ready.

Fur is painted with vertex colors (gradients and the fox's white markings) under a fur texture with
sheen, plus clumpy stylized fur tufts on the cheeks, chest, ears, ankles and tail. The cloak, hood,
cowl and tunic are draped sheets with ragged, torn hems and real thickness.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/2_fox.py
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "fox"
b.reset()
R = random.Random(7)

FUR_TEX = b.texture(ID, "fur")
CLOAK_TEX = b.texture(ID, "cloak")
LEATHER_TEX = b.texture(ID, "leather")


def C(hexcol, k=1.0):
    """Linear RGBA of a hex color, optionally scaled (darker/brighter)."""
    r, g, bb, a = b.rgba(hexcol)
    return (r * k, g * k, bb * k, a)


def lerp(a, c, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, c))


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---- Palette ----
ORANGE = C("#d4651f")
ORANGE_HI = C("#ee8b3a")
RUST = C("#9c4316")
WHITE = C("#f3ece0")
CREAM = C("#e9dcc6")
PAW = C("#2a1b14")
EAR_BACK = C("#24170f")
CLOAK = C("#5f6390")
CLOAK_DK = C("#3a3c60")
TUNIC = C("#6c625e")
TROUSER = C("#5a504e")
LEATHER = C("#b88f70")
LEATHER_DK = C("#7a5d4a")


# ---- Materials ----

def textured(name, image=None, scale=2.0, strength=0.75, bump=0.25, roughness=0.8, sheen=0.0, metallic=0.0,
             coat=0.0, streaks=False, emission=None, emission_strength=0.0):
    """Base color = the mesh's vertex colors ('Col') x a box-projected texture (or procedural fur
    streaks when the texture is missing). Sheen is tinted with the same colors."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
    vc = nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    color_out = vc.outputs["Color"]
    detail = None
    coord = nodes.new("ShaderNodeTexCoord")
    if image:
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (scale, scale, scale)
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.35
        links.new(coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs[0], tex.inputs["Vector"])
        detail = tex.outputs["Color"]
    elif streaks:
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (45.0, 45.0, 7.0)
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 1.0
        noise.inputs["Detail"].default_value = 6.0
        links.new(coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs[0], noise.inputs["Vector"])
        ramp = nodes.new("ShaderNodeMapRange")
        ramp.inputs["From Min"].default_value = 0.3
        ramp.inputs["From Max"].default_value = 0.7
        ramp.inputs["To Min"].default_value = 0.55
        ramp.inputs["To Max"].default_value = 1.0
        links.new(noise.outputs["Fac"], ramp.inputs[0])
        detail = ramp.outputs[0]
    if detail is not None:
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = strength
        a_in = next(s for s in mix.inputs if s.identifier == "A_Color")
        b_in = next(s for s in mix.inputs if s.identifier == "B_Color")
        links.new(color_out, a_in)
        links.new(detail, b_in)
        color_out = next(s for s in mix.outputs if s.identifier == "Result_Color")
        if bump:
            bmp = nodes.new("ShaderNodeBump")
            bmp.inputs["Strength"].default_value = bump
            bmp.inputs["Distance"].default_value = 0.01
            links.new(detail, bmp.inputs["Height"])
            links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(color_out, bsdf.inputs["Base Color"])
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Roughness"].default_value = 0.35
        links.new(vc.outputs["Color"], bsdf.inputs["Sheen Tint"])
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = C(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    m.diffuse_color = (0.5, 0.5, 0.5, 1)
    return m


fur_m = textured("Fur", FUR_TEX, scale=3.0, strength=0.6, bump=0.35, roughness=0.85, sheen=0.7, streaks=True)
tuft_m = textured("FurTufts", FUR_TEX, scale=5.0, strength=0.45, bump=0.25, roughness=0.85, sheen=0.8, streaks=True)
cloak_m = textured("Cloak", CLOAK_TEX, scale=1.6, strength=0.85, bump=0.5, roughness=0.95, sheen=0.35)
cloth_m = textured("Cloth", CLOAK_TEX, scale=2.2, strength=0.7, bump=0.4, roughness=0.92, sheen=0.25)
leather_m = textured("Leather", LEATHER_TEX, scale=2.5, strength=0.75, bump=0.35, roughness=0.55, coat=0.15)
plain_m = textured("Painted", None, roughness=0.6)
nose_m = textured("Nose", None, roughness=0.25, coat=0.8)
eye_m = textured("Eye", None, roughness=0.15, coat=1.0, emission="#f0a030", emission_strength=0.35)
silver_m = textured("Silver", None, roughness=0.28, metallic=0.75, emission="#8fa4d0", emission_strength=0.25)
bronze_m = textured("Bronze", None, roughness=0.35, metallic=1.0)
gem_m = textured("MoonGem", None, roughness=0.1, coat=1.0, emission="#9fd4ff", emission_strength=2.0)
glint_m = b.mat("Catchlight", "#ffffff", flat=True)


# ---- Geometry builder with per-vertex colors ----

def catmull(ctrl, per=4):
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


def interp(table, x):
    """Piecewise-linear lookup in [(x, y), ...]."""
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def frame_z(direction, up=(0, 0, 1)):
    """Rotation matrix whose local +Z points along `direction` and local +X toward `up`."""
    z = Vector(direction).normalized()
    u = Vector(up)
    x = (u - z * u.dot(z))
    if x.length < 1e-6:
        x = Vector((1, 0, 0)) - z * z.x
    x.normalize()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()


class Geo:
    """A bmesh with a per-vertex color layer; many parts can be merged into one object."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.verts.layers.float_color.new("Col")

    def v(self, co, color):
        vert = self.bm.verts.new(co)
        vert[self.col] = color
        return vert

    def grid_faces(self, rings, closed=True):
        for a, c in zip(rings, rings[1:]):
            n = len(a)
            for j in range(n if closed else n - 1):
                j2 = (j + 1) % n
                self.bm.faces.new((a[j], a[j2], c[j2], c[j]))

    def ellipsoid(self, center, radii, color, segments=24, rings=14, matrix=None):
        """color: a color or a function(local point before matrix, unit direction) -> color."""
        M = matrix or Matrix.Identity(3)
        cen = Vector(center)
        top = []
        for i in range(1, rings):
            el = -math.pi / 2 + math.pi * i / rings
            ring = []
            for j in range(segments):
                az = 2 * math.pi * j / segments
                d = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
                p = Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2]))
                col = color(p, d) if callable(color) else color
                ring.append(self.v(cen + M @ p, col))
            top.append(ring)
        self.grid_faces(top)
        for pole, ring in ((-1, top[0]), (1, top[-1])):
            d = Vector((0, 0, pole))
            p = Vector((0, 0, pole * radii[2]))
            col = color(p, d) if callable(color) else color
            pv = self.v(cen + M @ p, col)
            n = len(ring)
            for j in range(n):
                f = (ring[j], ring[(j + 1) % n], pv) if pole > 0 else (ring[(j + 1) % n], ring[j], pv)
                self.bm.faces.new(f)

    def lathe(self, profile, color, segments=24, matrix=None, origin=(0, 0, 0), scale=(1, 1, 1), caps=True):
        """Spin [(r, z), ...] around local Z, then transform by matrix and move to origin."""
        M = matrix or Matrix.Identity(3)
        o = Vector(origin)
        rings = []
        for r, z in profile:
            ring = []
            for j in range(segments):
                a = 2 * math.pi * j / segments
                p = Vector((r * math.sin(a) * scale[0], -r * math.cos(a) * scale[1], z * scale[2]))
                col = color(p) if callable(color) else color
                ring.append(self.v(o + M @ p, col))
            rings.append(ring)
        self.grid_faces(rings)
        if caps:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])

    def tube(self, pts, radius, color, around=8, flat=1.0, up=None, caps=True):
        """A tube along points; radius(t) and color(t) may be functions of 0..1 along it."""
        pts = [Vector(p) for p in pts]
        n = len(pts)
        lengths = [0.0]
        for a, c in zip(pts, pts[1:]):
            lengths.append(lengths[-1] + (c - a).length)
        total = max(lengths[-1], 1e-6)
        tang = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
        ref = Vector(up) if up else (Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0)))
        nrm = (ref - tang[0] * ref.dot(tang[0])).normalized()
        rings = []
        for i, p in enumerate(pts):
            t = tang[i]
            nrm = (nrm - t * nrm.dot(t)).normalized()
            bi = t.cross(nrm)
            u = lengths[i] / total
            rr = radius(u) if callable(radius) else radius
            col = color(u) if callable(color) else color
            rings.append([self.v(p + (nrm * math.cos(a) * flat + bi * math.sin(a)) * rr, col)
                          for a in (2 * math.pi * j / around for j in range(around))])
        self.grid_faces(rings)
        if caps:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])

    def tuft(self, base, direction, normal, length, width, root_col, tip_col, bend=0.35, flat=0.45, around=5,
             curl=None):
        """One stylized fur clump: a flattened, curved, pointed cone growing from `base`.
        It leans along `direction`, lies flat against the surface `normal` and curls away from it."""
        d = Vector(direction).normalized()
        nrm = Vector(normal)
        nrm = (nrm - d * nrm.dot(d))
        if nrm.length < 1e-5:
            nrm = Vector((0, 0, 1)) - d * d.z
        nrm.normalize()
        side = d.cross(nrm)
        bend_v = nrm * bend if curl is None else Vector(curl)
        rings = []
        for t in (0.0, 0.3, 0.6, 0.85):
            c = Vector(base) + d * length * t + bend_v * length * t * t
            tan = (d + 2 * bend_v * t).normalized()
            s2 = tan.cross(nrm).normalized()
            n2 = s2.cross(tan).normalized()
            w = width * (1 - t ** 1.6)
            col = lerp(root_col, tip_col, t)
            ring = [self.v(c + (s2 * math.cos(a) + n2 * math.sin(a) * flat) * w, col)
                    for a in (2 * math.pi * j / around for j in range(around))]
            rings.append(ring)
        self.grid_faces(rings)
        tip = self.v(Vector(base) + d * length + bend_v * length, tip_col)
        last = rings[-1]
        for j in range(around):
            self.bm.faces.new((last[j], last[(j + 1) % around], tip))
        self.bm.faces.new(list(reversed(rings[0])))

    def build(self, name, material, parent=None, smooth_shade=True):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        obj = b._mesh_object(name, self.bm, (0, 0, 0), (0, 0, 0), material, parent, smooth_shade)
        if obj.data.color_attributes.get("Col"):
            obj.data.color_attributes.active_color = obj.data.color_attributes["Col"]
            obj.data.color_attributes.render_color_index = obj.data.color_attributes.active_color_index
        return obj


def solidify(obj, thickness=0.012, offset=0.0):
    mod = obj.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    return obj


def lumpy(obj, strength=0.01, size=0.12, kind="CLOUDS"):
    tex = bpy.data.textures.new(f"{obj.name}_lumps", kind)
    tex.noise_scale = size
    mod = obj.modifiers.new("Lumps", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.texture_coords = "GLOBAL"
    return obj


def bvh_of(obj):
    """A BVH tree of an object's mesh in its parent's space (where siblings are placed)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_basis)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


def stick(tree, point, toward, push=0.0):
    """Project `point` along `toward` onto the surface; return (location + normal*push, normal)."""
    loc, nrm, _, _ = tree.ray_cast(Vector(point), Vector(toward).normalized())
    if loc is None:
        loc, nrm, _, _ = tree.find_nearest(Vector(point) + Vector(toward).normalized() * 0.5)
        print("STICK MISS", tuple(round(c, 3) for c in point))
    return loc + nrm * push, nrm


def drape(name, rows, cols, top_z, bot_z, rx, ry, cy, span, fold_amp, folds, jag, seed, colors,
          billow=None, holes=0, material=None, parent=None, thickness=0.012, notch=0.5):
    """A hanging cloth sheet around Z: theta 0 = front (-Y), + toward +X; span(t) = (theta0, theta1)
    in radians (t = 0 at the top edge, 1 at the hem). The hem is ragged (torn strips), the cloth
    folds, and a few small holes are torn near the hem. colors(t, theta) -> color."""
    rr = random.Random(seed)
    g = Geo()
    hem = []
    for j in range(cols + 1):
        u = j / cols
        mid = 0.5 + 0.5 * math.sin(u * 17.0 + seed) * math.sin(u * 7.3 + seed * 0.7)
        torn = rr.random() if j % 2 else 0.12 * rr.random()
        deep = 1.0 if rr.random() < 0.18 else 0.55
        hem.append(1.0 - jag * (0.35 * mid + notch * torn * deep))
    ph = [rr.uniform(0, 6.28) for _ in range(3)]
    rings = []
    for i in range(rows + 1):
        ring = []
        for j in range(cols + 1):
            u = j / cols
            t = i / rows * hem[j]
            a0, a1 = span(t)
            th = a0 + (a1 - a0) * u
            f = fold_amp(t) * (math.sin(folds * th + ph[0]) + 0.45 * math.sin(2.3 * folds * th + ph[1]))
            x = math.sin(th) * (rx(t) + f)
            y = cy(t) - math.cos(th) * (ry(t) + f)
            z = top_z + (bot_z - top_z) * t
            p = Vector((x, y, z))
            if billow:
                p += billow(th, t)
            ring.append(g.v(p, colors(t, th)))
        rings.append(ring)
    g.grid_faces(rings, closed=False)
    g.bm.faces.ensure_lookup_table()
    if holes:
        cand = [f for f in g.bm.faces if all(v.co.z < top_z + (bot_z - top_z) * 0.55 for v in f.verts)]
        rr.shuffle(cand)
        bmesh.ops.delete(g.bm, geom=cand[:holes], context="FACES")
    obj = g.build(name, material, parent)
    solidify(obj, thickness)
    return obj


root = b.pivot("Bobert")
LIFT = 0.1
body = b.pivot("Body", (0, 0, LIFT), parent=root)


def fur_shade(base, p, z0, z1, top=1.08, bottom=0.82):
    """Painterly value gradient: lighter toward the top, darker below."""
    t = smooth(z0, z1, p.z)
    k = bottom + (top - bottom) * t
    return (base[0] * k, base[1] * k, base[2] * k, 1.0)


# ---- Torso: tunic, white chest fur, neck ----
TUNIC_SY = 0.78
tunic_profile = [(0.02, 0.72), (0.17, 0.73), (0.2, 0.8), (0.205, 0.9), (0.195, 1.0), (0.21, 1.1),
                 (0.2, 1.2), (0.15, 1.28), (0.08, 1.33), (0.02, 1.34)]
g = Geo()
g.lathe([(Vector(c).x, Vector(c).y) for c in catmull([Vector(c) for c in tunic_profile], 3)],
        lambda p: fur_shade(TUNIC, p, 0.7, 1.3, 1.05, 0.7), segments=32, scale=(1, TUNIC_SY, 1))
tunic = g.build("Tunic", cloth_m, body)
tunic_tree = bvh_of(tunic)

# Chest fur: a white bib with clumpy tufts spilling down over the tunic's neckline.
g = Geo()
g.ellipsoid((0, -0.1, 1.18), (0.12, 0.075, 0.13), lambda p, d: lerp(WHITE, CREAM, 0.5 - d.z * 0.5),
            segments=20, rings=12)
g.lathe([(0.08, 1.26), (0.085, 1.34), (0.075, 1.44), (0.02, 1.45)],
        lambda p: lerp(ORANGE, WHITE, smooth(0.0, -0.05, p.y)), segments=20)
for k in range(34):
    a = R.uniform(-1.2, 1.2)
    el = R.uniform(-0.6, 0.7)
    p = Vector((0.11 * math.sin(a) * math.cos(el), -0.1 - 0.07 * math.cos(a) * math.cos(el), 1.18 + 0.12 * math.sin(el)))
    n = (p - Vector((0, -0.1, 1.18))).normalized()
    g.tuft(p, (R.uniform(-0.3, 0.3) + n.x * 0.4, n.y * 0.5, -1.0), n, R.uniform(0.06, 0.09), R.uniform(0.032, 0.042),
           CREAM, WHITE, bend=0.1, flat=0.35)
g.build("ChestFur", tuft_m, body)

# Tunic skirt: ragged flaps hanging below the belt.
drape("TunicSkirt", 8, 56, 0.92, 0.6, lambda t: 0.21 + 0.06 * t, lambda t: 0.165 + 0.05 * t, lambda t: 0.0,
      lambda t: (-math.pi, math.pi), lambda t: 0.012 * t, 9, 0.45, 3,
      lambda t, th: lerp(TUNIC, C("#2c2624"), t), material=cloth_m, parent=body, thickness=0.01)

# ---- Belt, buckle, pouches, cross strap ----
BELT_Z = 0.9
g = Geo()
g.lathe([(0.205, BELT_Z - 0.04), (0.222, BELT_Z - 0.035), (0.224, BELT_Z + 0.035), (0.205, BELT_Z + 0.04)],
        LEATHER, segments=40, scale=(1, 0.8, 1), caps=False)
# Low-slung second belt, tilted.
tilt = Matrix.Rotation(0.12, 3, "Y")
g.lathe([(0.225, -0.025), (0.24, -0.02), (0.24, 0.02), (0.225, 0.025)], LEATHER_DK, segments=40,
        matrix=tilt, origin=(0, 0.0, 0.83), scale=(1, 0.82, 1), caps=False)
g.build("Belts", leather_m, body)
g = Geo()
g.tube([(-0.035, -0.188, BELT_Z - 0.03), (-0.035, -0.188, BELT_Z + 0.03), (0.035, -0.188, BELT_Z + 0.03),
        (0.035, -0.188, BELT_Z - 0.03), (-0.035, -0.188, BELT_Z - 0.03)], 0.009, C("#a88a5c"), around=6)
g.build("Buckle", bronze_m, body)


def pouch(name, loc, rot_z, size=(0.1, 0.06, 0.1), col=LEATHER):
    pv = b.pivot(name, loc, parent=body, rotation=(0, 0, rot_z))
    g = Geo()
    sx, sy, sz = size
    g.ellipsoid((0, 0, 0), (sx / 2, sy / 2, sz / 2), col, segments=16, rings=10,
                matrix=Matrix.Diagonal((1.0, 1.0, 1.0)))
    g.ellipsoid((0, -0.006, sz * 0.22), (sx * 0.53, sy * 0.45, sz * 0.3), lerp(col, LEATHER_DK, 0.5), segments=16, rings=8)
    g.build(name + "Bag", leather_m, pv)
    g = Geo()
    g.ellipsoid((0, -sy * 0.5 - 0.004, sz * 0.12), (0.011, 0.011, 0.011), C("#a88a5c"), segments=10, rings=6)
    g.build(name + "Stud", bronze_m, pv)
    return pv


pouch("PouchL", (0.15, -0.14, 0.86), 0.65)
pouch("PouchFront", (0.065, -0.185, 0.84), 0.08, size=(0.085, 0.05, 0.08), col=LEATHER_DK)
pouch("PouchR", (-0.19, -0.08, 0.84), -1.05, size=(0.09, 0.06, 0.11))
# Loose strap ends hanging from the belt.
g = Geo()
g.tube([(0.07, -0.19, 0.885), (0.08, -0.205, 0.83), (0.085, -0.205, 0.77), (0.078, -0.198, 0.72)],
       lambda t: 0.017 * (1 - 0.25 * t), LEATHER_DK, around=6, flat=0.22)
g.tube([(0.115, -0.175, 0.875), (0.128, -0.19, 0.82), (0.13, -0.19, 0.775)], 0.014, LEATHER, around=6, flat=0.22)
g.build("StrapEnds", leather_m, body)


def strap(name, pts, width, col, tree, center_fn, parent, push=0.008, thick=0.008):
    """A flat leather strap lying on a surface: points are projected onto the surface (rays aimed at
    center_fn(point)), then a ribbon of `width` is laid along them."""
    proj = []
    for p in pts:
        p = Vector(p)
        c = Vector(center_fn(p))
        loc, nrm = stick(tree, c + (p - c) * 3.0, c - p, push)
        proj.append((loc, nrm))
    g = Geo()
    rings = []
    for i, (p, n) in enumerate(proj):
        nxt = proj[min(i + 1, len(proj) - 1)][0]
        prv = proj[max(i - 1, 0)][0]
        t = (nxt - prv).normalized()
        s = t.cross(n).normalized()
        rings.append([g.v(p + s * width / 2, col), g.v(p - s * width / 2, col),
                      g.v(p - s * width / 2 + n * thick, col), g.v(p + s * width / 2 + n * thick, col)])
    g.grid_faces(rings)
    g.bm.faces.new(list(reversed(rings[0])))
    g.bm.faces.new(rings[-1])
    return g.build(name, leather_m, parent)


axis = lambda p: (0, 0, p.z)  # noqa: E731
line = [Vector((-0.17, -0.1, 1.27)).lerp(Vector((0.19, -0.1, 0.88)), k / 14) for k in range(15)]
strap("CrossStrap", line, 0.045, LEATHER, tunic_tree, axis, body)
back = [Vector((-0.17, 0.1, 1.27)).lerp(Vector((0.19, 0.1, 0.88)), k / 14) for k in range(15)]
strap("CrossStrapBack", back, 0.045, LEATHER, tunic_tree, axis, body)
g = Geo()
for k, f in enumerate((0.3, 0.62)):
    p = line[0].lerp(line[-1], f)
    loc, n = stick(tunic_tree, Vector((p.x, -0.6, p.z)), (0, 1, 0), 0.016)
    s = Vector((0.36, 0, -0.39)).normalized()
    g.tube([loc - s * 0.022 + Vector((0, 0, 0.012)), loc + s * 0.022 + Vector((0, 0, 0.012)),
            loc + s * 0.022 - Vector((0, 0, 0.012)), loc - s * 0.022 - Vector((0, 0, 0.012)),
            loc - s * 0.022 + Vector((0, 0, 0.012))], 0.006, C("#a88a5c"), around=6)
g.build("StrapBuckles", bronze_m, body)

# ---- Legs: baggy trousers, wrapped shins, furry ankles, dark paws ----
LEG_Z = 0.72 + LIFT
for side, nm in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{nm}", (side * 0.095, 0, LEG_Z), parent=root,
                  rotation=(0.0 if side > 0 else -0.06, side * -0.07, side * 0.22))
    g = Geo()
    thigh = [(0.02, 0.08), (0.105, 0.06), (0.128, -0.08), (0.138, -0.24), (0.124, -0.36), (0.085, -0.43),
             (0.02, -0.44)]
    g.lathe([(c.x, c.y) for c in catmull([Vector(c) for c in thigh], 3)],
            lambda p: fur_shade(TROUSER, p, -0.44, 0.1, 1.08, 0.72), segments=26)
    if side < 0:  # a mended patch on the right knee, with big stitches
        g.ellipsoid((0.01, -0.128, -0.22), (0.055, 0.02, 0.05), lerp(TROUSER, C("#9a8a70"), 0.6), segments=12, rings=6,
                    matrix=Matrix.Rotation(0.2, 3, "Y"))
        for k in range(6):
            a = 2 * math.pi * k / 6
            pt = Vector((0.01 + 0.052 * math.cos(a), -0.142, -0.22 + 0.046 * math.sin(a)))
            g.tube([pt - Vector((0, 0, 0.008)), pt + Vector((0, 0, 0.008))], 0.003, C("#d8c8a0"), around=4)
    trouser = g.build(f"Trouser{nm}", cloth_m, leg)
    lumpy(trouser, 0.014, 0.07)
    # Shin wraps: a leather sleeve with flat strips wound around it, crossing each other.
    g = Geo()
    shin_r = [(-0.71, 0.06), (-0.62, 0.062), (-0.5, 0.074), (-0.4, 0.078)]
    g.lathe([(0.02, -0.39), (0.078, -0.4), (0.074, -0.5), (0.062, -0.62), (0.06, -0.7), (0.02, -0.71)],
            LEATHER_DK, segments=20)
    for k in range(9):
        z = -0.42 - k * 0.032
        slope = 0.045 if k % 2 else -0.03
        pts = []
        for st in range(17):
            u = st / 16
            ang = 2 * math.pi * u + k * 0.7
            zz = z + slope * math.sin(ang)
            r = interp(shin_r, zz) + 0.006 + 0.002 * (k % 2)
            pts.append((r * math.sin(ang), -r * math.cos(ang), zz))
        g.tube(pts, 0.015, lerp(LEATHER, LEATHER_DK, 0.15 + (k % 3) * 0.25), around=6, flat=0.28, caps=False)
    g.build(f"ShinWrap{nm}", leather_m, leg)
    # Ankle fur and the paw.
    g = Geo()
    g.lathe([(0.02, -0.76), (0.07, -0.755), (0.073, -0.72), (0.062, -0.69), (0.02, -0.68)], ORANGE, segments=18)
    for k in range(18):
        ang = 2 * math.pi * k / 18 + R.uniform(-0.1, 0.1)
        n = Vector((math.sin(ang), -math.cos(ang), 0))
        g.tuft(Vector((0, 0, -0.69)) + n * 0.064, n * 0.35 + Vector((0, 0, -1)), n, R.uniform(0.06, 0.08), 0.032,
               RUST, ORANGE_HI, bend=0.4)
    g.build(f"AnkleFur{nm}", tuft_m, leg)
    g = Geo()
    g.ellipsoid((0, -0.055, -0.765), (0.09, 0.135, 0.06), lambda p, d: lerp(PAW, C("#45301f"), 0.5 + 0.5 * d.z),
                segments=20, rings=12)
    for k in range(4):
        x = (k - 1.5) * 0.042
        g.ellipsoid((x, -0.175 + abs(x) * 0.6, -0.783), (0.028, 0.038, 0.034), lerp(PAW, C("#45301f"), 0.3),
                    segments=10, rings=6)
        g.tuft(Vector((x, -0.2 + abs(x) * 0.6, -0.79)), (0, -1, -0.5), (0, 0, 1), 0.025, 0.008, C("#d9cbb0"),
               C("#f0e6d0"), bend=-0.6, flat=0.8, around=4)
    g.build(f"Paw{nm}", fur_m, leg)

# ---- Hips ----
g = Geo()
g.ellipsoid((0, 0, 0.76), (0.215, 0.165, 0.11), TROUSER, segments=24, rings=10)
g.build("Hips", cloth_m, body)


# ---- Arms: furry upper arms, leather bracers, dark paw hands ----
def set_world(obj, matrix3, location=None):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    loc = mw.to_translation() if location is None else Vector(location)
    obj.matrix_world = Matrix.Translation(loc) @ matrix3.to_4x4()
    bpy.context.view_layer.update()


def neg_z_frame(v, front=(0, -1, 0)):
    """Local -Z along v, local -Y as close to `front` as possible."""
    z = -Vector(v).normalized()
    f = -Vector(front)
    y = (f - z * f.dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


UPPER, FORE = 0.25, 0.23


def arm(side, nm, hand_target, elbow_out):
    shoulder = Vector((side * 0.22, 0.0, 1.2 + LIFT))
    a = b.pivot(f"Arm{nm}", tuple(shoulder), parent=root)
    fore = b.pivot(f"Forearm{nm}", (0, 0, -UPPER), parent=a)
    hand = b.pivot(f"Hand{nm}", (0, 0, -FORE), parent=fore)
    # Two-bone IK: find the elbow, then aim each bone at the next joint.
    tgt = Vector(hand_target)
    d = tgt - shoulder
    dist = min(d.length, UPPER + FORE - 1e-3)
    cos_a = (UPPER ** 2 + dist ** 2 - FORE ** 2) / (2 * UPPER * dist)
    along = d.normalized()
    pole = Vector(elbow_out)
    pole = (pole - along * pole.dot(along)).normalized()
    elbow = shoulder + along * UPPER * cos_a + pole * UPPER * math.sqrt(max(0, 1 - cos_a ** 2))
    set_world(a, neg_z_frame(elbow - shoulder))
    set_world(fore, neg_z_frame(tgt - elbow))
    # Upper arm: orange fur with a few tufts; a little shoulder ball under the cowl.
    g = Geo()
    g.ellipsoid((0, 0, -0.02), (0.075, 0.075, 0.08), ORANGE, segments=18, rings=10)
    g.lathe([(0.02, 0.0), (0.068, -0.02), (0.062, -0.12), (0.055, -0.22), (0.05, -0.26), (0.02, -0.27)],
            lambda p: fur_shade(ORANGE, p, -0.27, 0.0, 1.05, 0.8), segments=18)
    for k in range(8):
        ang = 2 * math.pi * k / 8 + R.uniform(-0.2, 0.2)
        n = Vector((math.sin(ang), -math.cos(ang), 0))
        g.tuft(Vector((0, 0, -0.2)) + n * 0.052, n * 0.3 + Vector((0, 0, -1)), n, 0.06, 0.026, ORANGE, ORANGE_HI)
    g.build(f"UpperArm{nm}", fur_m, a)
    # Forearm: a leather bracer laced up the front.
    g = Geo()
    g.lathe([(0.02, 0.01), (0.05, 0.0), (0.06, -0.04), (0.064, -0.12), (0.058, -0.19), (0.05, -0.21), (0.02, -0.215)],
            lambda p: lerp(LEATHER, LEATHER_DK, smooth(-0.05, -0.2, p.z) * 0.6), segments=18)
    g.lathe([(0.064, -0.035), (0.07, -0.03), (0.07, -0.015), (0.062, -0.01)], LEATHER_DK, segments=18, caps=False)
    g.lathe([(0.06, -0.2), (0.066, -0.195), (0.066, -0.175), (0.06, -0.17)], LEATHER_DK, segments=18, caps=False)
    for k in range(4):
        z = -0.05 - k * 0.035
        g.tube([(-0.02, -0.064 + k * 0.001, z), (0.02, -0.064 + k * 0.001, z - 0.02)], 0.005, C("#c9b48a"), around=4)
        g.tube([(0.02, -0.064, z), (-0.02, -0.064, z - 0.02)], 0.005, C("#c9b48a"), around=4)
    g.build(f"Bracer{nm}", leather_m, fore)
    return a, fore, hand


arm_r, fore_r, hand_r = arm(-1, "R", (-0.25, -0.3, 0.88 + LIFT), (-1, 0.4, 0))
arm_l, fore_l, hand_l = arm(1, "L", (0.36, -0.06, 0.84 + LIFT), (1, 0.6, 0.0))

# Left hand: a relaxed dark paw.
g = Geo()
g.ellipsoid((0, 0, -0.045), (0.05, 0.042, 0.058), PAW, segments=14, rings=8)
for k in range(4):
    x = (k - 1.5) * 0.022
    g.tube([(x, -0.03, -0.08), (x * 1.1, -0.035, -0.11), (x * 1.1, -0.02, -0.13)], 0.012, PAW, around=6)
g.tube([(0.0, -0.035, -0.03), (-0.035, -0.045, -0.06), (-0.04, -0.04, -0.09)], 0.013, PAW, around=6)
g.build("PawHandL", fur_m, hand_l)

# ---- Dagger: a curved silver blade with an ornate curled guard, held low and ready ----
blade_dir = Vector((0.3, -0.9, -0.22)).normalized()
grip_frame = frame_z(blade_dir, up=(0, 0, 1))
dagger = b.pivot("Dagger", (0, 0, -0.05), parent=hand_r)
set_world(dagger, grip_frame)
# Grip from z -0.1 to 0, guard at 0, blade from 0 to L curving toward +X (the edge is on -X).
g = Geo()
L = 0.4
rings = []
N = 18
for i in range(N + 1):
    s = i / N
    z = 0.03 + L * s
    xc = 0.17 * (s * L) ** 2 / L
    w = 0.07 * (1.0 - s ** 3.2) * (0.85 + 0.25 * math.sin(s * math.pi * 0.8)) + 0.0015
    th = 0.011 * (1 - 0.7 * s)
    spine = xc + w * 0.45
    edge = xc - w * 0.55 - 0.012 * math.sin(s * math.pi) * (s > 0.5)
    col = lerp(C("#dfe6f0"), C("#b9c4d6"), s)
    rings.append([g.v((spine, -th / 2, z), col), g.v((xc - w * 0.05, -th * 0.35, z), col),
                  g.v((edge, 0, z), C("#f4f8ff")), g.v((xc - w * 0.05, th * 0.35, z), col),
                  g.v((spine, th / 2, z), col)])
g.grid_faces(rings)
g.bm.faces.new(list(reversed(rings[0])))
g.bm.faces.new(rings[-1])
# Ornate guard: a crossbar with curled quillons, and a round boss with a pale moon gem.
for sx in (-1, 1):
    pts = [(0, 0, 0.012), (sx * 0.035, 0, 0.012), (sx * 0.06, 0, 0.026), (sx * 0.07, 0, 0.045),
           (sx * 0.06, 0, 0.055), (sx * 0.05, 0, 0.045), (sx * 0.055, 0, 0.037)]
    g.tube(catmull([Vector(p) for p in pts], 3), lambda t: 0.009 * (1 - 0.55 * t), C("#c7cfdb"), around=7)
g.lathe([(0.001, -0.002), (0.022, 0.0), (0.026, 0.012), (0.022, 0.026), (0.001, 0.03)], C("#c7cfdb"), segments=16,
        matrix=Matrix.Rotation(math.pi / 2, 3, "X"), origin=(0, 0.0, 0.014), scale=(1, 1, 0.6))
# Pommel.
g.ellipsoid((0, 0, -0.115), (0.02, 0.02, 0.024), C("#c7cfdb"), segments=12, rings=8)
g.tube([(0, 0, -0.1), (0, 0, -0.092)], 0.014, C("#aab4c4"), around=10)
g.build("DaggerMetal", silver_m, dagger, smooth_shade=True)
g = Geo()
g.ellipsoid((0, -0.018, 0.014), (0.009, 0.006, 0.009), C("#bfe6ff"), segments=10, rings=6)
g.ellipsoid((0, 0.018, 0.014), (0.009, 0.006, 0.009), C("#bfe6ff"), segments=10, rings=6)
g.build("DaggerGem", gem_m, dagger)
g = Geo()
g.lathe([(0.015, -0.095), (0.017, -0.05), (0.015, -0.002)], C("#2a1a12"), segments=10)
for k in range(6):
    z = -0.09 + k * 0.015
    g.tube([(0.018 * math.cos(a), 0.018 * math.sin(a), z + 0.01 * a / 6.28) for a in
            [2 * math.pi * s / 10 for s in range(11)]], 0.004, C("#4a3020"), around=4, caps=False)
g.build("DaggerGrip", leather_m, dagger)
# The paw fist wraps the grip: knuckles on the outside, thumb over the top.
g = Geo()
g.ellipsoid((0.0, 0, -0.05), (0.048, 0.05, 0.055), PAW, segments=16, rings=10)
for k in range(4):
    z = -0.025 - k * 0.022
    g.ellipsoid((-0.012, -0.05, z), (0.028, 0.02, 0.013), lerp(PAW, C("#3d2a1f"), 0.4), segments=10, rings=6)
g.tube([(0.03, 0.02, -0.02), (0.035, 0.0, 0.0), (0.02, -0.035, 0.002)], 0.014, PAW, around=7)
g.build("PawFistR", fur_m, dagger)

# ---- Tail: huge, bushy, white-tipped ----
tail = b.pivot("Tail", (-0.07, 0.15, 0.8 + LIFT), parent=root)
spine_ctrl = [Vector(p) for p in ((0, 0, 0), (-0.14, 0.04, -0.08), (-0.33, 0.08, -0.1), (-0.52, 0.06, 0.02),
                                  (-0.63, -0.02, 0.24), (-0.64, -0.06, 0.48), (-0.56, -0.08, 0.66))]
spine = catmull(spine_ctrl, 6)
radius_tab = [(0.0, 0.04), (0.12, 0.08), (0.35, 0.16), (0.6, 0.18), (0.82, 0.14), (0.94, 0.09), (1.0, 0.03)]
WHITE_FROM = 0.8


def tail_color(t, k=1.0):
    c = lerp(lerp(RUST, ORANGE, smooth(0.0, 0.2, t)), WHITE, smooth(WHITE_FROM - 0.05, WHITE_FROM + 0.05, t))
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


g = Geo()
g.tube(spine, lambda t: interp(radius_tab, t) * 1.1, lambda t: tail_color(t), around=18)
tail_core = g.build("TailCore", fur_m, tail)
lengths = [0.0]
for a, c in zip(spine, spine[1:]):
    lengths.append(lengths[-1] + (c - a).length)
total = lengths[-1]


def spine_at(t):
    d = t * total
    for i in range(len(spine) - 1):
        if lengths[i + 1] >= d:
            f = (d - lengths[i]) / max(lengths[i + 1] - lengths[i], 1e-6)
            return spine[i].lerp(spine[i + 1], f), (spine[i + 1] - spine[i]).normalized()
    return spine[-1], (spine[-1] - spine[-2]).normalized()


g = Geo()
for k in range(260):
    t = min(0.97, 0.04 + 0.96 * (k / 260) ** 0.9 + R.uniform(-0.01, 0.01))
    p, tan = spine_at(t)
    ref = Vector((0, 0, 1)) if abs(tan.z) < 0.9 else Vector((1, 0, 0))
    n1 = tan.cross(ref).normalized()
    n2 = tan.cross(n1)
    a = R.uniform(0, 2 * math.pi)
    n = n1 * math.cos(a) + n2 * math.sin(a)
    r = interp(radius_tab, t)
    base = p + n * r * 0.85
    length = 0.1 + r * 0.9
    g.tuft(base, tan * 1.0 + n * 0.15, n, length * R.uniform(0.85, 1.15), 0.05 + r * 0.3,
           tail_color(t, 0.97 * R.uniform(0.92, 1.05)), tail_color(min(1, t + 0.05), 1.06), bend=-0.04, flat=0.3)
# The white tip: a final spray of long clumps.
p, tan = spine_at(0.97)
for k in range(10):
    a = 2 * math.pi * k / 10
    ref = Vector((0, 0, 1)) if abs(tan.z) < 0.9 else Vector((1, 0, 0))
    n1 = tan.cross(ref).normalized()
    n2 = tan.cross(n1)
    n = n1 * math.cos(a) + n2 * math.sin(a)
    g.tuft(p - tan * 0.04 + n * 0.02, tan + n * 0.3, n, 0.12, 0.04, CREAM, WHITE, bend=0.15)
g.build("TailFur", tuft_m, tail)

# ---- Head: a fox head with a long muzzle, white cheeks, amber eyes and big ears ----
head = b.pivot("Head", (0, 0, 1.3 + LIFT), parent=root, rotation=(0.06, 0.07, -0.18))
HC = Vector((0, 0, 0.2))
HR = (0.19, 0.175, 0.18)
MUZ_O = Vector((0, -0.07, 0.125))
MUZ_M = Matrix.Rotation(math.pi / 2 + 0.12, 3, "X")


def face_color(p):
    """The fox's markings: white lower face and cheeks, orange forehead and muzzle bridge,
    a deeper rust toward the top and back of the head."""
    rel = p - HC
    front = -p.y
    # Muzzle bridge: orange on top of the muzzle.
    mz = MUZ_O.z - (front - (-MUZ_O.y)) * math.tan(0.12)  # muzzle axis height at this depth
    on_muzzle = front > 0.14
    line = -0.045 + 0.32 * max(0.0, abs(rel.x) - 0.04) ** 1.0
    w = smooth(0.012, -0.012, rel.z - line)  # 1 below the cheek line
    if on_muzzle:
        w = max(w * 0.0, smooth(0.008, -0.01, p.z - (mz + 0.012 - 0.15 * abs(p.x))))
    w *= smooth(-0.12, -0.02, front)
    base = lerp(ORANGE, RUST, smooth(0.05, 0.2, rel.z) * 0.5 + smooth(0.0, 0.17, p.y) * 0.4)
    if rel.z > 0.03 and abs(rel.x) < 0.12 and front > 0.1:
        base = lerp(base, ORANGE_HI, 0.35)
    return lerp(base, WHITE, w)


g = Geo()
g.ellipsoid(HC, HR, lambda p, d: face_color(HC + p), segments=36, rings=22)
MUZ_LEN = 0.25
muzzle = [(0.001, -0.06), (0.1, -0.04), (0.098, 0.02), (0.084, 0.09), (0.063, 0.15), (0.041, 0.2),
          (0.022, 0.233), (0.001, MUZ_LEN)]
g.lathe(muzzle, lambda p: face_color(MUZ_O + MUZ_M @ p), segments=24, matrix=MUZ_M, origin=MUZ_O,
        scale=(1.0, 0.82, 1.0))
# Jaw / chin: white, under the muzzle.
g.ellipsoid((0, -0.145, 0.078), (0.066, 0.085, 0.04), WHITE, segments=18, rings=10)
skull = g.build("Skull", fur_m, head)
head_tree = bvh_of(skull)
NOSE_TIP = MUZ_O + MUZ_M @ Vector((0, 0, MUZ_LEN))

# Nose.
g = Geo()
g.ellipsoid(NOSE_TIP + Vector((0, 0.005, 0.012)), (0.034, 0.026, 0.024), C("#0e0b0a"), segments=16, rings=10)
g.build("Nose", nose_m, head)

# Eyes: amber, big and almond-shaped, with dark lids, round pupils and catchlights.
g_eye = Geo()
g_dark = Geo()
g_glint = Geo()
g_lid_parts = []
LOOK = Vector((-0.12, -1.0, 0.04)).normalized()


def eye_frame(out, up=(0, 0, 1)):
    z = -Vector(out).normalized()  # local +Z into the head, -Z out of the face
    u = Vector(up)
    y = (u - z * u.dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


for side in (1, -1):
    loc, nrm = stick(head_tree, (side * 0.09, -0.6, 0.24), (0, 1, 0))
    out = (nrm + Vector((side * 0.2, -0.2, 0))).normalized()
    Mt = eye_frame(out) @ Matrix.Rotation(side * -0.22, 3, "Z")  # outer corners tilt up
    c = loc - out * 0.006
    ER = (0.054, 0.036, 0.024)
    g_dark.ellipsoid(c + Mt @ Vector((0, 0, 0.004)), (0.061, 0.043, 0.024), C("#1a110c"), segments=20, rings=10, matrix=Mt)
    g_eye.ellipsoid(c, ER, lambda p, d: lerp(C("#ffd468"), C("#c66a12"), 0.5 + 0.5 * d.y), segments=20, rings=10,
                    matrix=Mt)
    dx, dy = side * 0.006 + 0.005, 0.001
    dz = -ER[2] * math.sqrt(max(0.05, 1 - (dx / ER[0]) ** 2 - (dy / ER[1]) ** 2)) - 0.0005
    g_dark.ellipsoid(c + Mt @ Vector((dx, dy, dz)), (0.021, 0.026, 0.005), C("#070404"), segments=14, rings=8, matrix=Mt)
    g_glint.ellipsoid(c + Mt @ Vector((dx - 0.012, dy + 0.011, dz - 0.002)), (0.0085, 0.0085, 0.003), C("#ffffff"),
                      segments=8, rings=6, matrix=Mt)
    g_glint.ellipsoid(c + Mt @ Vector((dx + 0.01, dy - 0.012, dz - 0.002)), (0.004, 0.004, 0.002), C("#ffffff"),
                      segments=6, rings=4, matrix=Mt)
    g_lid_parts.append((c, Mt, ER))
    # A thick dark upper lash line.
    lash = []
    for k in range(12):
        u = -1 + 2 * k / 11
        x = u * 0.052
        y = ER[1] * math.sqrt(max(0, 1 - (x / (ER[0] * 1.04)) ** 2)) * 0.92 + 0.002
        z = -ER[2] * math.sqrt(max(0, 1 - (x / ER[0]) ** 2 - (y / ER[1]) ** 2 * 0.8)) * 0.8 - 0.002
        lash.append(c + Mt @ Vector((x, y, z)))
    g_dark.tube(lash, lambda t: 0.0045 + 0.0035 * math.sin(math.pi * t), C("#140c08"), around=6)
    # Brows: a short dark sweep, the inner end lower for a sly, clever look.
    bro = []
    for k in range(6):
        u = k / 5
        x = side * (0.04 + 0.09 * u)
        z = 0.302 + 0.026 * math.sin(u * math.pi) + (0.016 if side < 0 else 0.0) - 0.016 * u
        p, _ = stick(head_tree, (x, -0.6, z), (0, 1, 0), 0.006)
        bro.append(p)
    g_dark.tube(bro, lambda t: 0.009 * (1 - 0.6 * abs(t - 0.4)), C("#3a1d0d"), around=6, flat=0.5)
g_eye.build("Eyes", eye_m, head)
g_dark.build("EyeLids", plain_m, head)
g_glint.build("Catchlights", glint_m, head)
g = Geo()
for c, Mt, ER in g_lid_parts:
    g.ellipsoid(c + Mt @ Vector((0, ER[1] * 1.05, 0.006)), (ER[0] * 1.12, ER[1] * 0.55, ER[2] * 0.95),
                lambda p, d: lerp(ORANGE, RUST, 0.25), segments=18, rings=8, matrix=Mt)
g.build("UpperLids", fur_m, head)

# Mouth: a sly smile, one corner higher than the other.
g = Geo()
mouth = []
for k in range(11):
    u = -1 + 2 * k / 10
    x = u * 0.075
    z = NOSE_TIP.z - 0.04 + 0.03 * u * u + 0.018 * max(0, -u) ** 2
    p, _ = stick(head_tree, (x, -0.6, z), (0, 1, 0), 0.003)
    mouth.append(p)
g.tube(mouth, lambda t: 0.004 + 0.003 * math.sin(math.pi * t), C("#2a120a"), around=6)
g.build("Mouth", plain_m, head)

# Cheek ruffs and forehead fur: white clumps spilling out at the sides of the face.
g = Geo()
for side in (1, -1):
    for k in range(18):
        az = side * R.uniform(0.7, 1.3)
        el = R.uniform(-0.6, -0.05)
        loc, rot = b.on_surface(HC, HR, az, el, push=-0.018)
        n = Vector((math.sin(az), -math.cos(az) * 0.6, math.sin(el) * 0.4)).normalized()
        g.tuft(Vector(loc), n * 0.8 + Vector((0, -0.25, -0.55)), n, R.uniform(0.06, 0.09), R.uniform(0.03, 0.04),
               lerp(CREAM, WHITE, 0.5), WHITE, bend=-0.15, flat=0.4)
g.build("FaceFur", tuft_m, head)

# Ears: big and pointed with dark backs and pale fluffy insides, poking out through the hood.
for side, nm in ((1, "L"), (-1, "R")):
    loc, _ = b.on_surface(HC, HR, side * 0.5, 0.95, push=-0.025)
    ear = b.pivot(f"Ear{nm}", loc, parent=head, rotation=(-0.1, side * 0.3, side * 0.22))
    g = Geo()
    prof = [(0.001, -0.02), (0.095, 0.0), (0.1, 0.08), (0.085, 0.17), (0.056, 0.26), (0.024, 0.33), (0.001, 0.37)]

    def ear_col(p):
        back = smooth(-0.005, 0.02, p.y)
        top = smooth(0.17, 0.3, p.z)
        return lerp(lerp(ORANGE, RUST, top * 0.4), EAR_BACK, max(back * smooth(0.05, 0.2, p.z), top * 0.9))

    g.lathe(prof, ear_col, segments=20, scale=(1.0, 0.42, 1.0))
    g.lathe([(0.001, 0.0), (0.07, 0.02), (0.064, 0.12), (0.042, 0.22), (0.016, 0.285), (0.001, 0.3)],
            lambda p: lerp(CREAM, C("#b88f78"), smooth(0.0, 0.25, p.z) * 0.6), segments=16,
            origin=(0, -0.026, 0.0), scale=(1.0, 0.3, 1.0))
    g.build(f"EarShell{nm}", fur_m, ear)
    g = Geo()
    for k in range(10):
        z = R.uniform(0.06, 0.15)
        x = R.uniform(-0.045, 0.045) * (1 - z / 0.3)
        g.tuft(Vector((x, -0.04, z)), Vector((x * 5 + side * 0.1, -0.25, 1.0)), Vector((0, -1, 0)),
               R.uniform(0.06, 0.09), 0.03, CREAM, WHITE, bend=-0.1, flat=0.35)
    g.build(f"EarFluff{nm}", tuft_m, ear)

# ---- Hood: around the head, open at the face, with the ears poking through ----
HOOD_C = Vector((0, 0.02, 0.215))
HOOD_R = (0.225, 0.222, 0.235)
g = Geo()
rows, cols = 22, 44
grid = []
rr = random.Random(5)
for i in range(rows + 1):
    el = math.radians(-78 + (90 + 78) * i / rows)
    ring = []
    for j in range(cols):
        az = 2 * math.pi * j / cols - math.pi
        d = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
        drop = smooth(-0.2, -1.3, el)
        p = Vector((d.x * HOOD_R[0] * (1 + 0.35 * drop), d.y * HOOD_R[1] * (1 + 0.3 * drop), d.z * HOOD_R[2]))
        p += Vector((0, 0.08, 0.06)) * max(0.0, d.dot(Vector((0, 0.6, 0.8)))) ** 5  # a soft peak at the back
        rimness = smooth(1.6, 0.9, math.hypot(az / math.radians(64), (el - math.radians(-12)) / math.radians(58)))
        p *= 1 + (0.03 * math.sin(az * 5 + el * 3) + 0.045 * rimness * math.sin(az * 9 + 1.3)
                  + rr.uniform(-0.006, 0.006)) * math.cos(el)
        col = lerp(CLOAK, CLOAK_DK, 0.6 * smooth(0.3, -0.6, d.y) + 0.3 * smooth(0.5, -0.5, el))
        ring.append(g.v(HOOD_C + p, col))
    grid.append(ring)
for i in range(rows):
    for j in range(cols):
        el = math.radians(-78 + (90 + 78) * (i + 0.5) / rows)
        az = 2 * math.pi * (j + 0.5) / cols - math.pi
        opening = (az / math.radians(64)) ** 2 + ((el - math.radians(-12)) / math.radians(58)) ** 2 < 1.0
        chin = el < math.radians(-30) and abs(az) < math.radians(80)
        if opening or chin:
            continue
        j2 = (j + 1) % cols
        g.bm.faces.new((grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]))
loose = [v for v in g.bm.verts if not v.link_faces]
bmesh.ops.delete(g.bm, geom=loose, context="VERTS")
# A ragged, folded rim around the face.
for v in g.bm.verts:
    if v.is_boundary and v.co.z > 0.0:
        v.co += (v.co - HOOD_C).normalized() * rr.uniform(-0.004, 0.014) + Vector((0, rr.uniform(-0.02, 0.012), 0))
hood = g.build("Hood", cloak_m, head)
solidify(hood, 0.018, offset=1.0)
lumpy(hood, 0.008, 0.06)

# ---- Cowl (short cape around the shoulders) with the crescent-moon clasp ----
cloak_piv = b.pivot("Cloak", (0, 0, LIFT), parent=root)
drape("Cowl", 10, 64, 1.36, 1.02, lambda t: 0.13 + 0.27 * t ** 0.6, lambda t: 0.12 + 0.17 * t ** 0.6,
      lambda t: 0.015, lambda t: (math.radians(10 + 30 * t), math.radians(350 - 30 * t)),
      lambda t: 0.025 * t, 11, 0.5, 21, lambda t, th: lerp(CLOAK, CLOAK_DK, 0.35 * t + 0.3 * smooth(-0.5, -1, math.cos(th))),
      material=cloak_m, parent=cloak_piv, thickness=0.014, holes=3)

# The long cloak: behind the arms, pulled back on his right (where the tail comes out) and
# billowing out to his left.


def cloak_span(t):
    left = math.radians(108 - 30 * smooth(0.2, 1.0, t))
    right = math.radians(255 - 32 * smooth(0.1, 0.55, t))
    return left, right


def cloak_billow(th, t):
    w = smooth(math.radians(200), math.radians(110), th)  # 1 on his left side
    out = Vector((math.sin(th), -math.cos(th), 0))
    return out * (0.3 * t * t * w) + Vector((0.16 * w, 0.14 - 0.12 * w, 0.12 * w)) * t * t


drape("CloakLong", 26, 72, 1.26, 0.06, lambda t: 0.25 + 0.2 * t, lambda t: 0.2 + 0.12 * t, lambda t: 0.06 + 0.06 * t,
      cloak_span, lambda t: 0.015 + 0.07 * t, 10, 0.26, 13,
      lambda t, th: lerp(CLOAK, CLOAK_DK, 0.5 * t + 0.2 * smooth(0, 1, math.cos(th - math.pi))),
      billow=cloak_billow, material=cloak_m, parent=cloak_piv, thickness=0.016, holes=6, notch=0.6)

# Clasp: a silver crescent moon on a little round plate at the throat.
clasp = b.pivot("Clasp", (0, -0.205, 1.24), parent=cloak_piv, rotation=(-0.35, 0, 0))
g = Geo()
pts = []
for k in range(17):
    a = math.radians(-140 + 280 * k / 16)
    pts.append((0.05 * math.sin(a), 0, 0.05 * math.cos(a)))
g.tube(pts, lambda t: 0.002 + 0.015 * math.sin(math.pi * t) ** 0.8, C("#e6ebf2"), around=8, flat=0.6)
g.lathe([(0.001, 0.0), (0.016, 0.0), (0.018, 0.005), (0.015, 0.008), (0.001, 0.008)], C("#7d8697"), segments=20,
        matrix=Matrix.Rotation(math.pi / 2, 3, "X"), origin=(0.008, 0.008, 0.0))
g.build("ClaspMetal", silver_m, clasp)

# ---- Night scene: moonlit backdrop, rock, lights, fireflies ----


def night_studio():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Night")
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    bg = nodes.get("Background")
    coord = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Generated"], sep.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = C("#2a2a5e")
    ramp.color_ramp.elements[1].position = 0.45
    ramp.color_ramp.elements[1].color = C("#0d0e26")
    mr = nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.1
    mr.inputs["From Max"].default_value = 0.8
    links.new(sep.outputs["Z"], mr.inputs[0])
    links.new(mr.outputs[0], ramp.inputs[0])
    links.new(ramp.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    # Light the scene with a dim violet ambient, but let the camera see the gradient sky.
    amb = nodes.new("ShaderNodeBackground")
    amb.inputs["Color"].default_value = C("#3a3c78")
    amb.inputs["Strength"].default_value = 0.35
    lp = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    links.new(amb.outputs[0], mix.inputs[1])
    links.new(bg.outputs[0], mix.inputs[2])
    out = nodes.get("World Output")
    links.new(mix.outputs[0], out.inputs["Surface"])
    scene.world = world

    # Ground: a mossy rock ledge fading into night haze.
    gm = bpy.data.materials.new("Ground")
    gm.use_nodes = True
    n2, l2 = gm.node_tree.nodes, gm.node_tree.links
    bsdf = n2.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.95
    tc = n2.new("ShaderNodeTexCoord")
    noise = n2.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.5
    noise.inputs["Detail"].default_value = 8
    l2.new(tc.outputs["Object"], noise.inputs["Vector"])
    cr = n2.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position = 0.4
    cr.color_ramp.elements[0].color = C("#1d2030")
    cr.color_ramp.elements[1].position = 0.65
    cr.color_ramp.elements[1].color = C("#26301f")
    l2.new(noise.outputs["Fac"], cr.inputs[0])
    dist = n2.new("ShaderNodeVectorMath")
    dist.operation = "LENGTH"
    l2.new(tc.outputs["Object"], dist.inputs[0])
    fade = n2.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = 1.5
    fade.inputs["From Max"].default_value = 7.0
    l2.new(dist.outputs["Value"], fade.inputs[0])
    mixc = n2.new("ShaderNodeMix")
    mixc.data_type = "RGBA"
    l2.new(fade.outputs[0], mixc.inputs[0])
    l2.new(cr.outputs[0], next(s for s in mixc.inputs if s.identifier == "A_Color"))
    next(s for s in mixc.inputs if s.identifier == "B_Color").default_value = C("#15163a")
    l2.new(next(s for s in mixc.outputs if s.identifier == "Result_Color"), bsdf.inputs["Base Color"])
    bmp = n2.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.6
    l2.new(noise.outputs["Fac"], bmp.inputs["Height"])
    l2.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    floor = bpy.data.objects.new("Floor", bpy.data.meshes.new("Floor"))
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=64, radius=10)
    bm.to_mesh(floor.data)
    bm.free()
    floor.data.materials.append(gm)
    floor.location.z = -0.2
    scene.collection.objects.link(floor)

    def light(name, kind, energy, location, target, size=1.0, color="#ffffff", spot=None):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = C(color)[:3]
        if kind == "AREA":
            data.size = size
        if kind == "SUN":
            data.angle = size
        if kind == "SPOT":
            data.spot_size = spot or 0.6
            data.spot_blend = 0.8
            data.shadow_soft_size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(obj)
        return obj

    light("Moon", "SUN", 7.0, (2.0, 6.0, 5.0), (0, 0, 0.9), size=0.04, color="#b9c8ff")
    light("MoonRimL", "AREA", 900, (-2.6, 2.8, 2.6), (0, 0, 1.1), size=1.5, color="#9fb2ff")
    light("WarmKey", "AREA", 260, (-2.0, -2.8, 2.4), (0, 0, 1.2), size=2.0, color="#ffc48a")
    light("FaceLight", "SPOT", 60, (-0.7, -1.7, 1.75), (0, 0, 1.5), size=0.3, color="#ffd3a0", spot=0.5)
    light("Fill", "AREA", 120, (2.8, -2.4, 1.2), (0, 0, 0.9), size=3.0, color="#6d76d6")

    # Fireflies (scene dressing, not part of Bobert).
    ff = bpy.data.materials.new("Firefly")
    ff.use_nodes = True
    fn = ff.node_tree.nodes
    fb = fn.get("Principled BSDF")
    fb.inputs["Base Color"].default_value = C("#ffe27a")
    fb.inputs["Emission Color"].default_value = C("#ffd860")
    fb.inputs["Emission Strength"].default_value = 40.0
    rf = random.Random(3)
    spots = [(-0.9, -0.6, 1.4), (0.85, -0.5, 1.7), (-1.2, 0.4, 0.6), (1.1, 0.2, 0.9), (0.6, -0.9, 0.45),
             (-0.55, -1.0, 0.95), (1.4, -0.2, 1.3), (-1.5, -0.3, 1.8), (0.3, 0.9, 2.0), (-0.3, -1.3, 0.3),
             (1.7, 0.6, 0.35), (-1.8, 0.8, 1.1)]
    for i, p in enumerate(spots):
        me = bpy.data.meshes.new(f"Firefly{i}")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=rf.uniform(0.01, 0.018))
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(f"Firefly{i}", me)
        o.location = p
        me.materials.append(ff)
        scene.collection.objects.link(o)
        pl = bpy.data.lights.new(f"FireflyGlow{i}", "POINT")
        pl.energy = 3.0
        pl.color = C("#ffd860")[:3]
        pl.shadow_soft_size = 0.02
        pl.use_shadow = False
        plo = bpy.data.objects.new(f"FireflyGlow{i}", pl)
        plo.location = p
        scene.collection.objects.link(plo)

    scene.render.engine = "BLENDER_EEVEE"
    eevee = scene.eevee
    for attr, value in (("taa_render_samples", 64), ("use_shadows", True), ("use_raytracing", True),
                        ("use_gtao", True), ("gtao_distance", 0.25)):
        if hasattr(eevee, attr):
            setattr(eevee, attr, value)
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = 0.3
    scene.render.film_transparent = False
    # A soft glow around the bright bits (fireflies, eyes, the gem).
    try:
        tree = bpy.data.node_groups.new("FoxComp", "CompositorNodeTree")
        rl = tree.nodes.new("CompositorNodeRLayers")
        glare = tree.nodes.new("CompositorNodeGlare")
        for key, value in (("Type", "Bloom"), ("Quality", "High"), ("Threshold", 1.2), ("Strength", 0.5),
                           ("Size", 0.7)):
            try:
                glare.inputs[key].default_value = value
            except (TypeError, KeyError) as e:
                print("GLARE", key, e)
        outn = tree.nodes.new("NodeGroupOutput")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        tree.links.new(rl.outputs["Image"], glare.inputs[0])
        tree.links.new(glare.outputs[0], outn.inputs[0])
        scene.compositing_node_group = tree
    except Exception as e:  # noqa: BLE001
        print("COMPOSITOR SKIPPED", e)


night_studio()


def scenery():
    """A mossy rock ledge under his paws, a big moon and pine silhouettes (not part of Bobert)."""
    scene = bpy.context.scene

    def plain(name, color, rough=0.9, emit=None, strength=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bs = m.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Base Color"].default_value = C(color)
        bs.inputs["Roughness"].default_value = rough
        if emit:
            bs.inputs["Emission Color"].default_value = C(emit)
            bs.inputs["Emission Strength"].default_value = strength
        return m

    def add(name, bm, material, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        o.location = loc
        me.materials.append(material)
        for poly in me.polygons:
            poly.use_smooth = True
        scene.collection.objects.link(o)
        return o

    # Rock ledge: stone with moss on top.
    rock_m = bpy.data.materials.new("Rock")
    rock_m.use_nodes = True
    nn, ll = rock_m.node_tree.nodes, rock_m.node_tree.links
    bs = nn.get("Principled BSDF")
    bs.inputs["Roughness"].default_value = 0.95
    tc = nn.new("ShaderNodeTexCoord")
    nz = nn.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.0
    nz.inputs["Detail"].default_value = 10
    ll.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nn.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = C("#3a3f4c")
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = C("#4a5a30")
    ll.new(nz.outputs["Fac"], ramp.inputs[0])
    ll.new(ramp.outputs[0], bs.inputs["Base Color"])
    bp = nn.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.8
    ll.new(nz.outputs["Fac"], bp.inputs["Height"])
    ll.new(bp.outputs["Normal"], bs.inputs["Normal"])
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=20, radius=1.0)
    for v in bm.verts:
        v.co.x *= 1.25
        v.co.y *= 0.95
        v.co.z *= 0.3
    rock = add("Ledge", bm, rock_m, (0.05, 0.1, -0.285))
    rock["hero_only"] = True
    tex = bpy.data.textures.new("LedgeLumps", "VORONOI")
    tex.noise_scale = 0.35
    sub = rock.modifiers.new("Sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    mod = rock.modifiers.new("Lumps", "DISPLACE")
    mod.texture = tex
    mod.strength = 0.06
    mod.mid_level = 1.0
    mod.texture_coords = "GLOBAL"

    # Moon: a big pale disc low in the sky behind him (seen from the hero camera).
    cam = Vector((-1.85, -3.45, 1.925))
    fwd = (Vector((0, 0, 0.925)) - cam).normalized()
    flat = Vector((fwd.x, fwd.y, 0)).normalized()
    right = flat.cross(Vector((0, 0, 1)))
    d = (flat * math.cos(math.radians(2)) + Vector((0, 0, math.sin(math.radians(2))))).normalized()
    d = (Quaternion(Vector((0, 0, 1)), math.radians(-13)) @ d)
    moon_pos = cam + d * 40
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=48, radius=2.2)
    moon = add("MoonDisc", bm, plain("MoonDisc", "#fff6dc", emit="#fff1d0", strength=6.0), moon_pos)
    moon.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()
    moon["hero_only"] = True
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=48, radius=4.5)
    halo_m = bpy.data.materials.new("MoonHalo")
    halo_m.use_nodes = True
    hn, hl = halo_m.node_tree.nodes, halo_m.node_tree.links
    out = hn.get("Material Output")
    hn.remove(hn.get("Principled BSDF"))
    em = hn.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = C("#8c96e0")
    em.inputs["Strength"].default_value = 1.0
    tr = hn.new("ShaderNodeBsdfTransparent")
    grad_c = hn.new("ShaderNodeTexCoord")
    ln = hn.new("ShaderNodeVectorMath")
    ln.operation = "LENGTH"
    hl.new(grad_c.outputs["Object"], ln.inputs[0])
    mr = hn.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 2.0
    mr.inputs["From Max"].default_value = 4.5
    mr.inputs["To Min"].default_value = 0.55
    mr.inputs["To Max"].default_value = 1.0
    hl.new(ln.outputs["Value"], mr.inputs[0])
    mx = hn.new("ShaderNodeMixShader")
    hl.new(mr.outputs[0], mx.inputs[0])
    hl.new(em.outputs[0], mx.inputs[1])
    hl.new(tr.outputs[0], mx.inputs[2])
    hl.new(mx.outputs[0], out.inputs["Surface"])
    halo_m.blend_method = "BLEND" if hasattr(halo_m, "blend_method") else None
    halo = add("MoonHalo", bm, halo_m, moon_pos + d * 0.5)
    halo.rotation_euler = moon.rotation_euler
    halo["hero_only"] = True

    # Pine silhouettes on the far side, fading into the haze.
    pine_m = plain("Pines", "#141638", rough=1.0, emit="#1e2154", strength=0.6)
    rp = random.Random(9)
    for i in range(22):
        ang = rp.uniform(-1.25, 1.25)
        dist = rp.uniform(6.5, 10.0)
        x, y = math.sin(ang) * dist * 1.1, math.cos(ang) * dist
        if abs(x) < 4.2 and y < 8.5:
            continue
        hgt = rp.uniform(1.6, 3.4)
        bm = bmesh.new()
        tiers = 4
        for t in range(tiers):
            z0 = hgt * (0.15 + 0.2 * t)
            r = hgt * 0.32 * (1 - t / (tiers + 0.5))
            bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=0.0, depth=hgt * 0.35,
                                  matrix=Matrix.Translation((0, 0, z0 + hgt * 0.17)))
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=hgt * 0.04, radius2=hgt * 0.04,
                              depth=hgt * 0.3, matrix=Matrix.Translation((0, 0, hgt * 0.15)))
        add(f"Pine{i}", bm, pine_m, (x, y, -0.2))["hero_only"] = True

    # Night haze: a thin, cool volumetric mist around the clearing (moonbeams through it).
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 16
        v.co.y *= 16
        v.co.z *= 5
    fog_m = bpy.data.materials.new("Haze")
    fog_m.use_nodes = True
    fn, fl = fog_m.node_tree.nodes, fog_m.node_tree.links
    fn.remove(fn.get("Principled BSDF"))
    vol = fn.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = C("#6f78c4")
    vol.inputs["Density"].default_value = float(os.environ.get("FOX_FOG", "0.01"))
    fl.new(vol.outputs[0], fn.get("Material Output").inputs["Volume"])
    haze = add("Haze", bm, fog_m, (0, 2.0, 2.3))
    haze["hero_only"] = True


scenery()


def export_glb(style_id):
    os.makedirs(b.MODELS, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.collections[b.COLLECTION].all_objects:
        o.select_set(True)
    path = os.path.join(b.MODELS, style_id + ".glb")
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
              export_animations=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    print(f"EXPORTED {path} ({os.path.getsize(path) // 1024} KB)")


def render_all(style_id, hero_size=1200, turn_size=(2400, 1000), height=1.95):
    """Like b.render_all, but the pines and the moon only appear in the hero shot."""
    os.makedirs(b.RENDERS, exist_ok=True)
    scene = bpy.context.scene
    print(f"TRIANGLES {style_id}: {b.triangles()}")
    scene.render.resolution_x = scene.render.resolution_y = hero_size
    mid = height * 0.5
    scene.camera = b._camera("HeroCam", (-1.85, -3.45, mid + 0.95), (0, 0, mid - 0.05), lens=50)
    scene.render.filepath = os.path.join(b.RENDERS, f"{style_id}_hero.png")
    bpy.ops.render.render(write_still=True)
    for o in scene.collection.objects:
        if o.get("hero_only"):
            o.hide_render = True
    bpy.data.objects["Floor"].location.z = 0.0
    coll = bpy.data.collections[b.COLLECTION]
    bpy.context.view_layer.layer_collection.children[b.COLLECTION].exclude = True
    spacing = 1.75
    for i, turn in enumerate((0, 45, 90, 180)):
        inst = bpy.data.objects.new(f"View{turn}", None)
        inst.instance_type = "COLLECTION"
        inst.instance_collection = coll
        inst.location = ((i - 1.5) * spacing, 0, 0)
        inst.rotation_euler = (0, 0, math.radians(-turn))
        scene.collection.objects.link(inst)
    scene.render.resolution_x, scene.render.resolution_y = turn_size
    scene.camera = b._camera("TurnCam", (0, -12, mid + 1.2), (0, 0, mid), ortho_scale=spacing * 4 + 0.2)
    scene.render.filepath = os.path.join(b.RENDERS, f"{style_id}_turnaround.png")
    bpy.ops.render.render(write_still=True)
    for o in [o for o in scene.collection.objects if o.name.startswith("View")]:
        bpy.data.objects.remove(o)
    for o in scene.collection.objects:
        if o.get("hero_only"):
            o.hide_render = False
    bpy.context.view_layer.layer_collection.children[b.COLLECTION].exclude = False


if os.environ.get("FOX_FACE"):
    # Debug close-up of the face (not one of the deliverables).
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = 700
    sc.camera = b._camera("FaceCam", (-0.5, -1.3, 1.75), (0, 0, 1.55), lens=50)
    sc.render.filepath = os.path.join(b.HERE, "logs", "fox_face.png")
    bpy.ops.render.render(write_still=True)
    sys.exit(0)
if os.environ.get("FOX_QUICK"):
    render_all(ID, hero_size=700, turn_size=(1600, 667))
else:
    render_all(ID)
export_glb(ID)
