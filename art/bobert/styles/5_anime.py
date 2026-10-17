"""Style 5: Manga Hero. Bobert as the hero of a black-and-white manga come to life: a wild mop of
spiky black hair, huge determined eyes and a big grin, a short open jacket over a white shirt,
baggy rolled-up cargo trousers, giant high-top sneakers, a big sword resting on his shoulder and
one splash of color: a long red scarf whipping out behind him.

Everything is printed ink on white paper: a Diffuse BSDF is read with Shader to RGB and snapped to
flat bands (shadow / lit / highlight). Each band is a screentone: a halftone dot (or hatch line)
pattern made in screen space (Window coordinates), so the dots stay round and evenly sized on the
"page" whatever the 3D surface does. Interior ink lines are inverted hulls; the outer silhouette
gets an extra heavy line in the compositor (an AOV mask, dilated). The backdrop is a white page
with manga speed lines radiating out behind him.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/5_anime.py
(ANIME_FAST=1 renders at half size for quick checks.)
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "anime"
FAST = bool(os.environ.get("ANIME_FAST"))
b.reset()
R = b.rng(5)

# Where the light comes from (the sun points the other way): front, Bobert's right, above.
LIGHT = Vector((-0.5, -0.75, 1.1)).normalized()
TONE_ROWS = 170      # screentone cells per render height
INK = "#111111"
PAPER = "#ffffff"
RED = "#e3141e"

EXPORT_COLORS = {}   # material name -> plain base color for the .glb
HERO_MATS = []       # materials that write the "hero" AOV (for the heavy silhouette line)


# =====================================================================================
# Materials: screentone cel shading
# =====================================================================================

def _node_math(nodes, links, op, a, b_=None, clamp=False):
    n = nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b_)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            links.new(v, n.inputs[i])
    return n.outputs[0]


def screentone_group():
    """Coverage (0 = paper .. 1 = solid ink), Paper, Ink, Lines (0 = dots, 1 = hatch) -> Color.
    A classic halftone: 0.5 + 0.25 (cos 2pi u + cos 2pi v) on a 45-degree screen grid, thresholded
    by the coverage, so low coverage = small ink dots, 0.5 = checker, high = small paper dots."""
    ng = bpy.data.node_groups.new("Screentone", "ShaderNodeTree")
    it = ng.interface
    it.new_socket("Coverage", in_out="INPUT", socket_type="NodeSocketFloat")
    it.new_socket("Paper", in_out="INPUT", socket_type="NodeSocketColor")
    it.new_socket("Ink", in_out="INPUT", socket_type="NodeSocketColor")
    it.new_socket("Lines", in_out="INPUT", socket_type="NodeSocketFloat")
    it.new_socket("Color", in_out="OUTPUT", socket_type="NodeSocketColor")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput")
    go = N.new("NodeGroupOutput")
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Window"], sep.inputs[0])
    sx = N.new("ShaderNodeValue")
    sx.name = "SX"
    sx.outputs[0].default_value = TONE_ROWS
    sy = N.new("ShaderNodeValue")
    sy.name = "SY"
    sy.outputs[0].default_value = TONE_ROWS
    X = _node_math(N, L, "MULTIPLY", sep.outputs["X"], sx.outputs[0])
    Y = _node_math(N, L, "MULTIPLY", sep.outputs["Y"], sy.outputs[0])
    u = _node_math(N, L, "MULTIPLY", _node_math(N, L, "ADD", X, Y), 0.7071 * 2 * math.pi)
    v = _node_math(N, L, "MULTIPLY", _node_math(N, L, "SUBTRACT", X, Y), 0.7071 * 2 * math.pi)
    dots = _node_math(N, L, "MULTIPLY_ADD", _node_math(N, L, "ADD", _node_math(N, L, "COSINE", u),
                                                      _node_math(N, L, "COSINE", v)), 0.25)
    dots.node.inputs[2].default_value = 0.5
    # Hatching: diagonal lines, a bit wider apart than the dots.
    lines = _node_math(N, L, "MULTIPLY_ADD", _node_math(N, L, "COSINE", _node_math(N, L, "MULTIPLY", u, 0.75)), 0.5)
    lines.node.inputs[2].default_value = 0.5
    mixv = N.new("ShaderNodeMix")
    mixv.data_type = "FLOAT"
    L.new(gi.outputs["Lines"], mixv.inputs["Factor"])
    L.new(dots, mixv.inputs[2])
    L.new(lines, mixv.inputs[3])
    thr = _node_math(N, L, "SUBTRACT", 1.0, gi.outputs["Coverage"])
    ink = _node_math(N, L, "GREATER_THAN", mixv.outputs[0], thr)
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    L.new(ink, mix.inputs["Factor"])
    L.new(gi.outputs["Paper"], mix.inputs[6])
    L.new(gi.outputs["Ink"], mix.inputs[7])
    L.new(mix.outputs[2], go.inputs["Color"])
    return ng


TONE = screentone_group()


def _tone_aspect(scene, *_):
    """Keep the screentone dots round in any render size (the turnaround is wide)."""
    r = scene.render
    TONE.nodes["SX"].outputs[0].default_value = TONE_ROWS * r.resolution_x / r.resolution_y


bpy.app.handlers.render_pre.append(_tone_aspect)


def _hero_aov(m, out_socket=None):
    nt = m.node_tree
    aov = nt.nodes.new("ShaderNodeOutputAOV")
    aov.aov_name = "hero"
    aov.inputs["Value"].default_value = 1.0
    HERO_MATS.append(m)


def _ramp(nodes, links, value, stops, color=False):
    """A constant ramp: stops = [(position, value_or_rgba), ...]."""
    r = nodes.new("ShaderNodeValToRGB")
    cr = r.color_ramp
    cr.interpolation = "CONSTANT"
    while len(cr.elements) < len(stops):
        cr.elements.new(0.5)
    for el, (pos, val) in zip(cr.elements, stops):
        el.position = pos
        el.color = val if color else (val, val, val, 1.0)
    links.new(value, r.inputs["Fac"])
    return r.outputs["Color"]


def manga(name, paper=PAPER, shadow=0.45, lit=0.0, hi=None, t1=0.42, t2=0.95, ink=INK, hatch=(0, 0, 0),
          rim=None, rim_width=0.72, export=None, hero=True, hi_paper=PAPER):
    """A printed-manga cel material.
    paper: the paper color (white, or red for the scarf). shadow / lit / hi: screentone coverage in
    the shadow, lit and highlight bands (0 = clean paper, 1 = solid ink); hi=None: no highlight band.
    hatch: per band (shadow, lit, hi), 1 = hatch lines instead of dots.
    rim: a crisp paper-white rim highlight on the lit side (for dark clothes), its coverage."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    N.remove(N.get("Principled BSDF"))
    out = N.get("Material Output")
    diff = N.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = N.new("ShaderNodeShaderToRGB")
    L.new(diff.outputs[0], s2r.inputs[0])
    bw = N.new("ShaderNodeRGBToBW")
    L.new(s2r.outputs["Color"], bw.inputs[0])
    val = bw.outputs[0]
    stops_c = [(0.0, shadow), (t1, lit)]
    stops_h = [(0.0, hatch[0]), (t1, hatch[1])]
    stops_p = [(0.0, b.rgba(paper)), (t1, b.rgba(paper))]
    if hi is not None:
        stops_c.append((t2, hi))
        stops_h.append((t2, hatch[2]))
        stops_p.append((t2, b.rgba(hi_paper)))
    cov = _ramp(N, L, val, stops_c)
    hat = _ramp(N, L, val, stops_h)
    pap = _ramp(N, L, val, stops_p, color=True)
    cov_f = N.new("ShaderNodeRGBToBW")
    L.new(cov, cov_f.inputs[0])
    hat_f = N.new("ShaderNodeRGBToBW")
    L.new(hat, hat_f.inputs[0])
    cov_s = cov_f.outputs[0]
    pap_s = pap
    if rim is not None:
        lw = N.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.5
        edge = _node_math(N, L, "GREATER_THAN", lw.outputs["Facing"], rim_width)
        lit_side = _node_math(N, L, "GREATER_THAN", val, t1 + 0.12)
        rmask = _node_math(N, L, "MULTIPLY", edge, lit_side)
        mx = N.new("ShaderNodeMix")
        mx.data_type = "FLOAT"
        L.new(rmask, mx.inputs["Factor"])
        L.new(cov_s, mx.inputs[2])
        mx.inputs[3].default_value = rim
        cov_s = mx.outputs[0]
    g = N.new("ShaderNodeGroup")
    g.node_tree = TONE
    L.new(cov_s, g.inputs["Coverage"])
    L.new(pap_s, g.inputs["Paper"])
    g.inputs["Ink"].default_value = b.rgba(ink)
    L.new(hat_f.outputs[0], g.inputs["Lines"])
    em = N.new("ShaderNodeEmission")
    L.new(g.outputs[0], em.inputs["Color"])
    L.new(em.outputs[0], out.inputs["Surface"])
    m.diffuse_color = b.rgba(export or paper)
    EXPORT_COLORS[m.name] = b.rgba(export or paper)
    if hero:
        _hero_aov(m)
    return m


def flat(name, color, export=None):
    m = b.mat(name, color, flat=True)
    EXPORT_COLORS[m.name] = b.rgba(export or color)
    _hero_aov(m)
    return m


def tone_flat(name, coverage, paper=PAPER, export="#888888", lines=0.0):
    """A flat screentone (no lighting), for printed details like iris shading or a tongue."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes.get("Principled BSDF"))
    g = nt.nodes.new("ShaderNodeGroup")
    g.node_tree = TONE
    g.inputs["Coverage"].default_value = coverage
    g.inputs["Paper"].default_value = b.rgba(paper)
    g.inputs["Ink"].default_value = b.rgba(INK)
    g.inputs["Lines"].default_value = lines
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(g.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], nt.nodes.get("Material Output").inputs["Surface"])
    EXPORT_COLORS[m.name] = b.rgba(export)
    _hero_aov(m)
    return m


# ---- Palette: black, white, greys (as screentone) and one red ----
skin = manga("Skin", shadow=0.22, lit=0.0, t1=0.36, export="#fbe3cf")
shirt = manga("Shirt", shadow=0.36, lit=0.0, t1=0.4, export="#f4f4f0")
jacket = manga("Jacket", shadow=1.0, lit=0.86, hi=0.5, t2=1.02, rim=0.0, rim_width=0.78, export="#2b2b30")
lining = manga("Lining", shadow=0.55, lit=0.18, t1=0.4, export="#bdbdbd")
trim = manga("Trim", shadow=0.3, lit=0.0, export="#d8d8d8")
pants = manga("Pants", shadow=0.9, lit=0.45, hi=0.25, t2=1.02, hatch=(1, 0, 0), rim=0.0, rim_width=0.8,
              export="#55555c")
pants_roll = manga("PantsRoll", shadow=0.5, lit=0.2, export="#8a8a90")
leather = manga("Leather", shadow=1.0, lit=0.88, rim=0.0, rim_width=0.8, export="#3b3632")
strap = manga("Strap", shadow=0.95, lit=0.55, export="#4a4440")
metal = manga("Metal", shadow=0.6, lit=0.0, hi=0.0, t1=0.5, export="#cfd3d8")
glove = manga("Glove", shadow=1.0, lit=0.85, rim=0.0, rim_width=0.75, export="#222226")
shoe = manga("Shoe", shadow=1.0, lit=0.9, rim=0.0, rim_width=0.74, export="#1d1d22")
sole = manga("Sole", shadow=0.4, lit=0.0, t1=0.38, export="#f2f2ee")
sock = manga("Sock", shadow=0.35, lit=0.0, export="#f0f0f0")
steel = manga("Steel", shadow=0.42, lit=0.0, hi=0.0, t1=0.55, t2=0.95, export="#dfe4ea")
grip = manga("Grip", shadow=1.0, lit=0.8, export="#2a2420")
hair = manga("Hair", shadow=1.0, lit=0.97, hi=0.84, t1=0.4, t2=1.0, hatch=(0, 0, 1), export="#16161a")
scarf = manga("Scarf", paper=RED, shadow=0.4, lit=0.0, t1=0.4, hatch=(1, 0, 0), export=RED)
scarf_dark = manga("ScarfFold", paper=RED, shadow=0.7, lit=0.25, t1=0.4, hatch=(1, 1, 0), export="#b80f18")
ink = flat("Ink", INK)
white = flat("White", "#ffffff")
iris_tone = tone_flat("IrisTone", 0.55, export="#3a3a3a")
tongue_tone = tone_flat("TongueTone", 0.35, export="#c85a5a")
blush_tone = tone_flat("BlushTone", 0.0, export="#ffffff", lines=1.0)

OUTLINES = []  # (object, thickness)


def ol(obj, t=0.009):
    OUTLINES.append((obj, t))
    return obj


# =====================================================================================
# Mesh helpers
# =====================================================================================

def frame(direction, toward):
    """A rotation matrix whose -Z axis points along `direction` and -Y axis leans toward `toward`."""
    z = -Vector(direction).normalized()
    y = -Vector(toward)
    y = y - z * y.dot(z)
    if y.length < 1e-5:
        y = z.orthogonal()
    y.normalize()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def set_world_rot(obj, m3):
    bpy.context.view_layer.update()
    pr = obj.parent.matrix_world.to_3x3().normalized() if obj.parent else Matrix.Identity(3)
    obj.rotation_euler = (pr.inverted() @ m3).to_euler()


def open_shell(name, profile, gap, sy=1.0, segs=32, mats=(), parent=None, location=(0, 0, 0), thickness=0.012):
    """A lathe that's open at the front (a jacket): gap(z) = half the opening angle (radians).
    Made solid with a Solidify modifier; its rim faces get the second material (trim)."""
    bm = bmesh.new()
    rows = []
    for r, z in profile:
        g = gap(z)
        row = []
        for i in range(segs + 1):
            a = g + (2 * math.pi - 2 * g) * i / segs
            row.append(bm.verts.new((r * math.sin(a), -r * math.cos(a) * sy, z)))
        rows.append(row)
    for k in range(len(rows) - 1):
        for i in range(segs):
            bm.faces.new((rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]))
    obj = b._mesh_object(name, bm, location, (0, 0, 0), None, parent, True)
    for m_ in mats:
        obj.data.materials.append(m_)
    mod = obj.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = -1
    mod.use_rim = True
    mod.use_even_offset = True
    mod.material_offset_rim = 1
    return obj


def sweep(name, pts, up, profile, closed=False, mat=None, parent=None, location=(0, 0, 0), scales=None):
    """Sweep a 2D profile [(a, b), ...] along a path of points. `a` goes along `up` (made
    perpendicular to the path), `b` along the side. scales: per point profile scale."""
    bm = bmesh.new()
    n = len(pts)
    rings = []
    for i, p in enumerate(pts):
        p = Vector(p)
        if closed:
            t = Vector(pts[(i + 1) % n]) - Vector(pts[i - 1])
        else:
            t = Vector(pts[min(i + 1, n - 1)]) - Vector(pts[max(i - 1, 0)])
        t.normalize()
        u = Vector(up(i) if callable(up) else up)
        u = (u - t * u.dot(t)).normalized()
        s = t.cross(u)
        k = scales[i] if scales else 1.0
        rings.append([bm.verts.new(p + u * a * k + s * c * k) for a, c in profile])
    m = len(profile)
    for i in range(n if closed else n - 1):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for j in range(m):
            bm.faces.new((r0[j], r0[(j + 1) % m], r1[(j + 1) % m], r1[j]))
    if not closed:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return b._mesh_object(name, bm, location, (0, 0, 0), mat, parent, True)


def ellipse(a, c, n=10, phase=0.0):
    return [(a * math.cos(2 * math.pi * i / n + phase), c * math.sin(2 * math.pi * i / n + phase)) for i in range(n)]


def rect(a, c, round_=0.3):
    """A rounded rectangle profile (for straps)."""
    pts = []
    for cx, cy, a0 in ((a, c, 0), (-a, c, 90), (-a, -c, 180), (a, -c, 270)):
        rr = min(a, c) * round_
        for k in range(3):
            ang = math.radians(a0 + 45 * k)
            pts.append((cx - math.copysign(rr, cx) + rr * math.cos(ang), cy - math.copysign(rr, cy) + rr * math.sin(ang)))
    return pts


def square_ring(name, size, bar, depth, location, rotation, mat, parent):
    """A square buckle frame facing -Y."""
    bm = bmesh.new()
    for sx, sz, w, h in ((0, size / 2 - bar / 2, size, bar), (0, -size / 2 + bar / 2, size, bar),
                         (size / 2 - bar / 2, 0, bar, size - 2 * bar), (-size / 2 + bar / 2, 0, bar, size - 2 * bar)):
        geom = bmesh.ops.create_cube(bm, size=1.0)
        for v in geom["verts"]:
            v.co = Vector((sx + v.co.x * w, v.co.y * depth, sz + v.co.z * h))
    return b._mesh_object(name, bm, location, rotation, mat, parent, False)


def spike(name, length, radius, location, direction, bend_dir, bend=0.3, mat=None, parent=None, segments=6,
          flat=0.5, twist=0.0):
    """A sharp, tapering, curving anime hair spike: base at `location`, tip along `direction`,
    curling toward `bend_dir`. Flattened cross-section (flat < 1) for blade-like clumps."""
    L = length
    prof = [(radius * 0.8, -0.05), (radius, 0.0), (radius * 0.95, 0.2 * L), (radius * 0.75, 0.45 * L),
            (radius * 0.45, 0.72 * L), (radius * 0.18, 0.9 * L), (0.004, L)]
    z = Vector(direction).normalized()
    x = Vector(bend_dir)
    x = (x - z * x.dot(z))
    if x.length < 1e-4:
        x = z.orthogonal()
    x.normalize()
    y = z.cross(x)
    rot = Matrix((x, y, z)).transposed().to_euler()
    obj = b.from_points(name, prof, location, rot, mat=mat, parent=parent, segments=segments, scale=(flat, 1, 1))
    for v in obj.data.vertices:
        t = max(0.0, v.co.z / L)
        v.co.x += bend * L * t * t
    for p in obj.data.polygons:
        p.use_smooth = False
    return obj


class Projector:
    """Projects 2D drawings onto a mesh along +Y (like painting on a front view), for face decals."""

    def __init__(self, obj):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()
        self.obj = obj

    def decal(self, name, poly, mat, push=0.002, cuts=2, parent=None):
        """poly: [(x, z), ...] in the target's local space (counter-clockwise seen from the front)."""
        bm = bmesh.new()
        verts = [bm.verts.new((x, 0, z)) for x, z in poly]
        face = bm.faces.new(verts)
        bmesh.ops.triangulate(bm, faces=[face], quad_method="BEAUTY", ngon_method="EAR_CLIP")
        if cuts:
            bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts, use_grid_fill=True)
        for v in bm.verts:
            hit = self.bvh.ray_cast(Vector((v.co.x, -2.0, v.co.z)), Vector((0, 1, 0)))
            if hit[0] is not None:
                v.co = hit[0] + hit[1] * push
        bm.normal_update()
        for f in bm.faces:
            if f.normal.y > 0:
                f.normal_flip()
        obj = b._mesh_object(name, bm, self.obj.location, (0, 0, 0), mat, parent or self.obj.parent, True)
        obj.visible_shadow = False
        return obj


def bez(p0, p1, p2, n=10):
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * c + t * t * d for a, c, d in zip(p0, p1, p2)))
    return out


def stroke(p0, p1, p2, w0, w1, n=10, wmid=None):
    """A tapered brush stroke along a quadratic curve, as a closed polygon."""
    c = bez(p0, p1, p2, n)
    left, right = [], []
    for i, (x, z) in enumerate(c):
        t = i / n
        a = c[min(i + 1, n)]
        bb = c[max(i - 1, 0)]
        tx, tz = a[0] - bb[0], a[1] - bb[1]
        ln = math.hypot(tx, tz) or 1
        nx, nz = -tz / ln, tx / ln
        if wmid is None:
            w = w0 + (w1 - w0) * t
        else:
            w = (w0 * (1 - t) ** 2 + 2 * wmid * t * (1 - t) + w1 * t * t)
        left.append((x + nx * w / 2, z + nz * w / 2))
        right.append((x - nx * w / 2, z - nz * w / 2))
    return right + list(reversed(left))


def mirror(poly):
    return [(-x, z) for x, z in reversed(poly)]


def crease(obj, name, path, width=0.0065, push=0.002, sy=1.0):
    """An inked fold line drawn on a lathe-like part: path = [(azimuth, z), ...] in its local space
    (azimuth 0 = front, -Y). Each point is shot onto the surface from outside."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bvh = BVHTree.FromBMesh(bm)
    bm.free()
    pts = []
    for az, z in path:
        d = Vector((math.sin(az), -math.cos(az) * sy, 0)).normalized()
        hit = bvh.ray_cast(Vector((0, 0, z)) + d * 1.0, -d)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1] * push)
    if len(pts) < 2:
        return None
    n = len(pts)
    sc = [math.sin(math.pi * (i + 0.5) / n) ** 0.6 for i in range(n)]
    o = sweep(name, pts, (0, 0, 1), ellipse(width, width * 0.6, 6), mat=ink, parent=obj.parent,
              location=obj.location, scales=sc)
    o.rotation_euler = obj.rotation_euler
    o.visible_shadow = False
    return o


# =====================================================================================
# Rig and body
# =====================================================================================
root = b.pivot("Bobert")
body = b.pivot("Body", (0, 0, 0), parent=root)

HIP_Z = 0.97

# ---- Torso: white shirt, short open jacket with white piping and a popped collar ----
torso = b.from_points("Shirt", [(0.1, 0.92), (0.145, 0.96), (0.155, 1.04), (0.158, 1.14), (0.168, 1.24),
                                (0.172, 1.31), (0.158, 1.37), (0.118, 1.42), (0.065, 1.455)],
                      mat=shirt, parent=body, scale=(1, 0.74, 1), segments=28)
ol(torso, 0.008)
# Shirt folds peeking out of the jacket: a loose hem bunched over the belt.
hem = b.from_points("ShirtHem", [(0.15, 1.06), (0.166, 1.08), (0.17, 1.12), (0.16, 1.15)],
                    mat=shirt, parent=body, scale=(1, 0.8, 1), segments=28)
for v in hem.data.vertices:
    a = math.atan2(v.co.y, v.co.x)
    v.co.z += 0.012 * math.sin(5 * a)
ol(hem, 0.007)
for k, path in enumerate((((-0.12, 1.36), (-0.05, 1.3), (0.02, 1.26)), ((0.1, 1.24), (0.04, 1.19), (-0.05, 1.16)))):
    crease(torso, f"ShirtFold{k}", path, width=0.005, sy=0.74)

JACKET = [(0.182, 1.12), (0.188, 1.18), (0.19, 1.26), (0.19, 1.32), (0.177, 1.38), (0.138, 1.43), (0.09, 1.465)]
jk = open_shell("Jacket", JACKET, lambda z: 0.62 - 0.32 * (z - 1.12) / 0.35, sy=0.8, segs=36,
                mats=(jacket, trim), parent=body, thickness=0.014)
ol(jk, 0.009)
# The jacket hem flares a little.
for v in jk.data.vertices:
    if v.co.z < 1.13:
        v.co.x *= 1.04
        v.co.y *= 1.04
collar = open_shell("Collar", [(0.1, 1.43), (0.125, 1.47), (0.145, 1.52), (0.16, 1.565)],
                    lambda z: 0.75, sy=0.92, segs=24, mats=(jacket, trim), parent=body, thickness=0.012)
ol(collar, 0.008)

# Shoulder tabs with buckles (epaulettes) on both shoulders.
for s in (1, -1):
    tab = b.box(f"ShoulderTab{s}", (0.06, 0.13, 0.016), (s * 0.18, 0.0, 1.405), (0, s * -0.42, 0), mat=strap,
                parent=body, bevel=0.005, segments=1)
    ol(tab, 0.005)
    ol(square_ring(f"TabBuckle{s}", 0.04, 0.009, 0.01, (s * 0.165, -0.04, 1.43), (math.pi / 2 - 0.0, s * -0.42, 0),
                   metal, body), 0.004)

# ---- Hips and belt ----
hips = b.from_points("Hips", [(0.09, 0.84), (0.15, 0.87), (0.178, 0.93), (0.18, 1.0), (0.172, 1.06), (0.15, 1.08)],
                     mat=pants, parent=body, scale=(1, 0.78, 1), segments=28)
ol(hips, 0.009)
belt = b.from_points("Belt", [(0.176, 1.015), (0.186, 1.02), (0.188, 1.075), (0.178, 1.08)],
                     mat=leather, parent=body, scale=(1, 0.8, 1), segments=32)
ol(belt, 0.007)
ol(square_ring("BeltBuckle", 0.062, 0.012, 0.014, (0.045, -0.152, 1.048), (0, 0, 0.25), metal, body), 0.005)
ol(b.box("BeltTongue", (0.05, 0.012, 0.03), (0.0, -0.148, 1.048), (0, 0, 0.25), mat=leather, parent=body,
         bevel=0.004, segments=1), 0.004)
# A loose second belt slung low on the left hip, with a hanging end.
belt2_pts = []
for i in range(40):
    a = 2 * math.pi * i / 40
    belt2_pts.append((0.19 * math.sin(a), -0.19 * 0.8 * math.cos(a), 0.985 - 0.045 * math.sin(a + 0.3)))
ol(sweep("SlungBelt", belt2_pts, (0, 0, 1), rect(0.017, 0.006), closed=True, mat=strap, parent=body), 0.006)
ol(square_ring("SlungBuckle", 0.05, 0.01, 0.012, (0.13, -0.135, 0.955), (0, 0, 0.75), metal, body), 0.004)
hang = [(0.155, -0.12, 0.95), (0.17, -0.115, 0.9), (0.175, -0.1, 0.84), (0.172, -0.09, 0.79)]
ol(sweep("BeltEnd", hang, (0, 1, 0), rect(0.006, 0.016), mat=strap, parent=body), 0.005)

# ---- Chest strap: from the right shoulder across to the left hip, buckle on the chest ----
def chest_strap():
    tmp = b.from_points("_tmp", [(r + 0.012, z) for r, z in JACKET], mat=None, parent=None, scale=(1, 0.8, 1),
                        segments=48)
    bm = bmesh.new()
    bm.from_mesh(tmp.data)
    bvh = BVHTree.FromBMesh(bm)
    bm.free()
    bpy.data.objects.remove(tmp)
    center = Vector((0.0, 0.0, 1.25))
    axis = Vector((0.37, 0.0, -0.42)).normalized()     # along the strap, across the chest
    nrm = axis.cross(Vector((0, 1, 0))).normalized()  # the band's plane normal
    pts = []
    n = 48
    for i in range(n):
        a = 2 * math.pi * i / n
        d = (axis * math.cos(a) + Vector((0, -1, 0)) * math.sin(a)).normalized()
        hit = bvh.ray_cast(center + d * 1.0, -d)
        p = hit[0] if hit[0] is not None else center + d * 0.2
        pts.append(p + d * 0.006)
    return sweep("ChestStrap", pts, tuple(nrm), rect(0.022, 0.006), closed=True, mat=strap, parent=body)


cs = ol(chest_strap(), 0.006)
ol(square_ring("ChestBuckle", 0.055, 0.011, 0.014, (-0.075, -0.168, 1.29), (0, 0.85, 0.2), metal, body), 0.005)

# ---- Neck ----
ol(b.capsule("Neck", 0.05, 0.12, (0, -0.005, 1.48), mat=skin, parent=body, segments=16, rings=8), 0.007)


# =====================================================================================
# Legs: baggy cargo trousers rolled up below the knee, big high-top sneakers
# =====================================================================================
def fold(obj, below, amp=0.04, folds=5, phase=0.0, zamp=0.0):
    for v in obj.data.vertices:
        if v.co.z < below:
            t = min(1.0, (below - v.co.z) / 0.2)
            a = math.atan2(v.co.y, v.co.x)
            k = 1 + amp * t * math.sin(folds * a + phase)
            v.co.x *= k
            v.co.y *= k
            v.co.z += zamp * t * math.sin(3 * a + phase)


LEGS = {}
for side, nm in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{nm}", (side * 0.095, 0, HIP_Z), parent=root)
    thigh = b.from_points(f"Thigh{nm}", [(0.1, -0.41), (0.122, -0.37), (0.132, -0.3), (0.134, -0.18), (0.13, -0.06),
                                         (0.11, 0.06)], mat=pants, parent=leg, segments=22)
    fold(thigh, -0.2, 0.06, 5, side)
    ol(thigh, 0.009)
    for k, (a0, z0, a1, z1) in enumerate(((-0.35, -0.02, -0.1, -0.16), (0.25, -0.2, 0.5, -0.32),
                                          (-0.15, -0.26, 0.15, -0.34), (2.6, -0.05, 2.9, -0.25))):
        crease(thigh, f"ThighCrease{nm}{k}", [(a0 * side + (a1 - a0) * side * t / 6, z0 + (z1 - z0) * t / 6
                                               + 0.01 * math.sin(t)) for t in range(7)])
    knee = b.pivot(f"Knee{nm}", (0, 0, -0.37), parent=leg)
    shin_t = b.from_points(f"ShinTrouser{nm}", [(0.13, -0.15), (0.134, -0.1), (0.128, -0.02), (0.112, 0.06)],
                           mat=pants, parent=knee, segments=22)
    fold(shin_t, 0.02, 0.07, 4, side * 2, zamp=0.01)
    ol(shin_t, 0.009)
    for k, (a0, z0, a1, z1) in enumerate(((-0.3, 0.02, 0.2, -0.06), (0.4, -0.02, 0.7, -0.1))):
        crease(shin_t, f"ShinCrease{nm}{k}", [(a0 * side + (a1 - a0) * side * t / 6, z0 + (z1 - z0) * t / 6)
                                              for t in range(7)])
    roll = b.torus(f"Cuff{nm}", 0.118, 0.034, (0, 0, -0.16), (0, 0, 0), mat=pants_roll, parent=knee, segments=22,
                   minor_segments=8)
    for v in roll.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        v.co.z += 0.012 * math.sin(2 * a + side)
    ol(roll, 0.008)
    ol(b.capsule(f"Shin{nm}", 0.04, 0.2, (0, 0, -0.25), mat=sock, parent=knee, segments=14, rings=6), 0.007)
    ankle = b.pivot(f"Ankle{nm}", (0, 0, -0.4), parent=knee)
    ankle.scale = (1.15, 1.15, 1.15)
    LEGS[nm] = (leg, knee, ankle)

    # Sneaker (ankle space; the floor is about 0.12 below the ankle). Toe toward -Y.
    sole_o = b.box(f"Sole{nm}", (0.17, 0.37, 0.05), (0, -0.065, -0.095), mat=sole, parent=ankle, bevel=0.022,
                   segments=3)
    for v in sole_o.data.vertices:  # rounder toe and heel
        if abs(v.co.y) > 0.12:
            v.co.x *= 1 - 1.4 * (abs(v.co.y) - 0.12) ** 1.2
        if v.co.y < -0.14 and v.co.z > 0:
            v.co.z += 0.012
    ol(sole_o, 0.008)
    # sole stripe
    ol(b.box(f"SoleStripe{nm}", (0.174, 0.22, 0.008), (0, -0.04, -0.083), mat=ink, parent=ankle, bevel=0.003,
             segments=1), 0.0)
    toe = b.ball(f"ToeCap{nm}", 1.0, (0, -0.165, -0.07), scale=(0.078, 0.085, 0.052), mat=sole, parent=ankle,
                 segments=20, rings=10)
    ol(toe, 0.008)
    upper = b.ball(f"Upper{nm}", 1.0, (0, -0.06, -0.045), scale=(0.083, 0.155, 0.07), mat=shoe, parent=ankle,
                   segments=24, rings=12)
    ol(upper, 0.008)
    hightop = b.from_points(f"HighTop{nm}", [(0.074, -0.08), (0.078, 0.0), (0.075, 0.08), (0.079, 0.13)],
                            (0, 0.02, 0), mat=shoe, parent=ankle, segments=20, scale=(1, 1.12, 1))
    ol(hightop, 0.008)
    ol(b.torus(f"Collar{nm}", 0.078, 0.016, (0, 0.02, 0.13), (0, 0, 0), mat=sole, parent=ankle, segments=20,
               minor_segments=6, scale=(1, 1.12, 1)), 0.006)
    tongue = b.box(f"Tongue{nm}", (0.06, 0.03, 0.16), (0, -0.07, 0.05), (-0.35, 0, 0), mat=shoe, parent=ankle,
                   bevel=0.012, segments=2)
    ol(tongue, 0.006)
    for i in range(4):  # white laces criss-crossing up the front
        zz = -0.03 + i * 0.045
        yy = -0.12 + i * 0.016 if i == 0 else -0.088 + (i - 1) * 0.008
        for k in (1, -1):
            ol(b.box(f"Lace{nm}{i}{k}", (0.075, 0.012, 0.013), (0, yy - 0.01, zz), (0, k * 0.35, 0), mat=sole,
                     parent=ankle, bevel=0.004, segments=1), 0.004)
    # The round ankle patch on the outer side.
    ol(b.cylinder(f"Patch{nm}", 0.034, 0.008, (side * 0.083, 0.03, 0.035), (0, math.pi / 2, 0), mat=sole,
                  parent=ankle, segments=20), 0.004)
    b.cylinder(f"PatchDot{nm}", 0.012, 0.01, (side * 0.085, 0.03, 0.035), (0, math.pi / 2, 0), mat=ink,
               parent=ankle, segments=12)

# Cargo pocket with a buckled flap on his left thigh, a strap on his right thigh.
legL = LEGS["L"][0]
ol(b.box("CargoPocket", (0.05, 0.13, 0.15), (0.125, 0.0, -0.2), (0, 0.06, 0), mat=pants, parent=legL, bevel=0.015,
         segments=2), 0.007)
ol(b.box("CargoFlap", (0.055, 0.14, 0.045), (0.132, 0.0, -0.13), (0, 0.06, 0), mat=pants_roll, parent=legL,
         bevel=0.01, segments=2), 0.006)
ol(square_ring("CargoBuckle", 0.035, 0.008, 0.01, (0.165, -0.0, -0.15), (0, 0, math.pi / 2), metal, legL), 0.004)
for s, nm in ((1, "L"), (-1, "R")):
    lg = LEGS[nm][0]
    zz = -0.33 if nm == "R" else -0.36
    band = b.torus(f"ThighStrap{nm}", 0.128, 0.012, (0, 0, zz), (0.0, 0.08 * s, 0), mat=strap, parent=lg,
                   segments=24, minor_segments=6, scale=(1, 1, 1.5))
    ol(band, 0.005)
    ol(square_ring(f"ThighBuckle{nm}", 0.032, 0.008, 0.01, (s * 0.06, -0.12, zz), (0, 0, s * 0.45), metal, lg), 0.004)


# =====================================================================================
# Arms: jacket sleeves rolled up to the elbow, bare forearms, fingerless gloves
# =====================================================================================
def arm(side, nm):
    a = b.pivot(f"Arm{nm}", (side * 0.2, 0, 1.37), parent=root)
    ol(b.ball(f"Shoulder{nm}", 0.072, (0, 0, -0.005), mat=jacket, parent=a, segments=20, rings=10), 0.009)
    ol(b.capsule(f"Sleeve{nm}", 0.066, 0.13, (0, 0, -0.1), mat=jacket, parent=a, radius_bottom=0.06, segments=20,
                 rings=8), 0.009)
    cuff = b.torus(f"SleeveRoll{nm}", 0.062, 0.024, (0, 0, -0.205), (0.1, 0, 0), mat=lining, parent=a,
                   segments=20, minor_segments=8)
    for v in cuff.data.vertices:
        ang = math.atan2(v.co.y, v.co.x)
        v.co.z += 0.01 * math.sin(2 * ang + side)
    ol(cuff, 0.008)
    # Sleeve strap with a buckle.
    ol(b.torus(f"SleeveStrap{nm}", 0.068, 0.009, (0, 0, -0.07), (0, 0, 0), mat=strap, parent=a, segments=20,
               minor_segments=6, scale=(1, 1, 1.6)), 0.004)
    ol(square_ring(f"SleeveBuckle{nm}", 0.03, 0.007, 0.008, (side * 0.068, 0, -0.07), (0, 0, math.pi / 2), metal,
                   a), 0.003)
    el = b.pivot(f"Elbow{nm}", (0, 0, -0.22), parent=a)
    ol(b.capsule(f"Forearm{nm}", 0.042, 0.15, (0, 0, -0.1), mat=skin, parent=el, radius_bottom=0.036, segments=16,
                 rings=8), 0.007)
    hand = b.pivot(f"Hand{nm}", (0, 0, -0.22), parent=el)
    # Glove cuff (wrist), with a strap and a stud.
    ol(b.cylinder(f"GloveCuff{nm}", 0.046, 0.07, (0, 0, -0.005), mat=glove, parent=hand, segments=18, bevel=0.01),
       0.007)
    ol(b.torus(f"GloveStrap{nm}", 0.047, 0.008, (0, 0, -0.005), (0, 0, 0), mat=trim, parent=hand, segments=18,
               minor_segments=6, scale=(1, 1, 1.4)), 0.003)
    # Fist: gloved back of the hand, bare curled fingers, thumb (grip along local Y).
    ol(b.box(f"Fist{nm}", (0.07, 0.085, 0.08), (0, 0, -0.07), mat=glove, parent=hand, bevel=0.024, segments=3),
       0.007)
    for i, y in enumerate((-0.03, -0.01, 0.01, 0.03)):
        ol(b.ball(f"Finger{nm}{i}", 0.019, (side * -0.022, y, -0.115), scale=(1.1, 0.95, 1.0), mat=skin, parent=hand,
                  segments=10, rings=6), 0.005)
    ol(b.capsule(f"Thumb{nm}", 0.017, 0.035, (side * -0.04, -0.038, -0.08), (0.6, 0, side * 0.3), mat=skin,
                 parent=hand, segments=10, rings=6), 0.005)
    return a, el, hand


armR, elbowR, handR = arm(-1, "R")
armL, elbowL, handL = arm(1, "L")

# =====================================================================================
# Sword: big blade with a chisel tip, square crossguard, wrapped grip, ring pommel
# =====================================================================================
sword = b.pivot("Sword", (0, 0, -0.07), parent=handR)


def blade_mesh(name, length=0.98, width=0.11, thick=0.022, location=(0, 0, 0), parent=None, mat=None):
    """Diamond cross-section with a slanted chisel tip, flat-shaded: each bevel prints as one tone."""
    bm = bmesh.new()
    rings = []
    stations = [(0.0, 1.0, 0.0), (0.82, 1.0, 0.0), (1.0, 0.0, 0.5)]
    for f, w, off in stations:
        z = f * length
        hw = width / 2
        ht = thick / 2 * max(w, 0.2)
        if f == 1.0:
            ring = [bm.verts.new((hw * 0.9, 0, z)), bm.verts.new((hw * 0.9, -0.003, z)),
                    bm.verts.new((hw * 0.9 - 0.004, 0, z)), bm.verts.new((hw * 0.9, 0.003, z))]
        else:
            ring = [bm.verts.new((hw, 0, z)), bm.verts.new((0, -ht, z)), bm.verts.new((-hw, 0, z)),
                    bm.verts.new((0, ht, z))]
        rings.append(ring)
    # The chisel tip: the back edge (-x side) slants up to the point.
    rings[1][2].co.z = length * 0.82
    for k in range(len(rings) - 1):
        a, c = rings[k], rings[k + 1]
        for i in range(4):
            bm.faces.new((a[i], a[(i + 1) % 4], c[(i + 1) % 4], c[i]))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return b._mesh_object(name, bm, location, (0, 0, 0), mat, parent, False)


ol(blade_mesh("Blade", location=(0, 0, 0.13), parent=sword, mat=steel), 0.008)
# Fuller groove: an ink line down each face of the blade.
for s in (1, -1):
    ol(b.box(f"Fuller{s}", (0.008, 0.004, 0.62), (0.0, s * 0.0085, 0.5), mat=ink, parent=sword, bevel=0.0,
             segments=0, smooth=False), 0.0)
guard = b.box("Guard", (0.24, 0.045, 0.04), (0, 0, 0.11), mat=metal, parent=sword, bevel=0.008, segments=1,
              smooth=False)
for v in guard.data.vertices:  # flare and hook the ends
    if abs(v.co.x) > 0.08:
        v.co.z += 0.018 * (abs(v.co.x) - 0.08) / 0.04 * (1 if v.co.z > 0 else 0.4)
ol(guard, 0.006)
ol(b.box("GuardCore", (0.06, 0.06, 0.06), (0, 0, 0.11), mat=metal, parent=sword, bevel=0.01, segments=1,
         smooth=False), 0.006)
ol(b.cylinder("GripCore", 0.021, 0.2, (0, 0, -0.01), mat=grip, parent=sword, segments=12), 0.006)
for i in range(6):
    ol(b.torus(f"Wrap{i}", 0.022, 0.006, (0, 0, -0.09 + i * 0.033), (0.35, 0, 0), mat=trim, parent=sword,
               segments=12, minor_segments=4), 0.0)
ol(b.torus("PommelRing", 0.032, 0.009, (0, 0, -0.145), (0, math.pi / 2, 0), mat=metal, parent=sword, segments=16,
           minor_segments=6), 0.004)
ol(b.ball("Pommel", 0.026, (0, 0, -0.118), mat=metal, parent=sword, segments=12, rings=6), 0.005)


# =====================================================================================
# Head: anime face, huge eyes, big grin, wild spiky black hair
# =====================================================================================
head = b.pivot("Head", (0, 0, 1.49), parent=root)
head.scale = (1.25, 1.25, 1.25)
C = Vector((0, 0, 0.2))
RAD = (0.192, 0.185, 0.2)


def skull_mesh():
    obj = b.ball("Skull", 1.0, C, scale=RAD, mat=skin, parent=head, segments=40, rings=20)
    for v in obj.data.vertices:
        x, y, z = v.co
        t = max(0.0, -z / RAD[2])          # 0 at the middle .. 1 at the bottom
        # Narrow, slightly pointed anime jaw and chin; flatter cheeks; fuller back of the head.
        v.co.x = x * (1 - 0.34 * t ** 1.5)
        if y < 0:
            v.co.y = y * (0.96 - 0.12 * t ** 2)
            v.co.z = z - 0.025 * t ** 2 * max(0.0, 1 - abs(x) / 0.1)
        else:
            v.co.y = y * (1 - 0.3 * t ** 2)
    return obj


skull = ol(skull_mesh(), 0.009)
for s in (1, -1):
    loc, rot = b.on_surface(C, RAD, s * math.radians(90), math.radians(-6), push=-0.01)
    ol(b.ball(f"Ear{s}", 0.055, loc, rot, scale=(0.5, 0.8, 1.0), mat=skin, parent=head, segments=14, rings=8),
       0.006)

proj = Projector(skull)
FZ = C.z  # face decal heights are given relative to the skull center (in skull-local space anyway)


def eye_shapes(s):
    """s = +1 his left (+X), -1 his right. Returns polygons in skull-local (x, z)."""
    def X(x):
        return s * x
    inner, outer = 0.035, 0.14
    # Eye white: a flattish, slanted top (determined) and a rounder bottom.
    top = bez((inner, 0.005), (0.085, 0.045), (outer, 0.035), 10)
    bot = bez((outer, 0.035), (0.11, -0.085), (inner + 0.003, 0.0), 10)
    white_poly = [(X(x), z) for x, z in top + bot[1:-1]]
    # Iris: a tall oval, cut off at the top by the upper lash line.
    iris = [(X(0.083 + 0.034 * math.cos(a)), -0.012 + 0.05 * math.sin(a)) for a in
            [2 * math.pi * i / 20 for i in range(20)]]
    pupil = [(X(0.083 + 0.017 * math.cos(a)), -0.006 + 0.027 * math.sin(a)) for a in
             [2 * math.pi * i / 14 for i in range(14)]]
    tone = [(X(0.083 + 0.026 * math.cos(a)), -0.032 + 0.02 * math.sin(a)) for a in
            [2 * math.pi * i / 14 for i in range(14)]]
    shine1 = [(X(0.072 + 0.013 * math.cos(a)), 0.006 + 0.015 * math.sin(a)) for a in
              [2 * math.pi * i / 10 for i in range(10)]]
    shine2 = [(X(0.099 + 0.006 * math.cos(a)), -0.04 + 0.006 * math.sin(a)) for a in
              [2 * math.pi * i / 8 for i in range(8)]]
    lash = stroke((inner - 0.008, -0.005), (0.085, 0.052), (outer + 0.016, 0.03), 0.012, 0.016, 14, wmid=0.026)
    lash = [(X(x), z) for x, z in lash]
    flick = stroke((outer + 0.005, 0.035), (outer + 0.02, 0.03), (outer + 0.03, 0.01), 0.014, 0.003, 4)
    flick = [(X(x), z) for x, z in flick]
    lower = stroke((0.07, -0.072), (0.11, -0.07), (0.128, -0.045), 0.003, 0.008, 6)
    lower = [(X(x), z) for x, z in lower]
    brow = stroke((0.03, 0.085), (0.09, 0.11), (0.155, 0.122), 0.024, 0.012, 10, wmid=0.03)
    brow = [(X(x), z) for x, z in brow]
    polys = [white_poly, iris, pupil, tone, shine1, shine2, lash, flick, lower, brow]
    return [p if s < 0 else list(reversed(p)) for p in polys]


for s, nm in ((1, "L"), (-1, "R")):
    wp, ir, pu, tn, s1, s2, la, fl, lo, br = eye_shapes(s)
    proj.decal(f"EyeWhite{nm}", wp, white, push=0.0015, cuts=2)
    proj.decal(f"Iris{nm}", ir, ink, push=0.003, cuts=1)
    proj.decal(f"IrisTone{nm}", tn, iris_tone, push=0.0042, cuts=1)
    proj.decal(f"Pupil{nm}", pu, ink, push=0.0045, cuts=1)
    proj.decal(f"Shine{nm}", s1, white, push=0.006, cuts=1)
    proj.decal(f"Shine2{nm}", s2, white, push=0.006, cuts=0)
    proj.decal(f"Lash{nm}", la, ink, push=0.0075, cuts=1)
    proj.decal(f"LashFlick{nm}", fl, ink, push=0.0075, cuts=1)
    proj.decal(f"LowerLid{nm}", lo, ink, push=0.004, cuts=1)
    proj.decal(f"Brow{nm}", br, ink, push=0.004, cuts=1)
    # Manga blush: three short hatch strokes on each cheek.
    for k in range(3):
        x0 = s * (0.105 + k * 0.016)
        poly = stroke((x0 - s * 0.008, -0.075), (x0, -0.065), (x0 + s * 0.006, -0.055), 0.004, 0.003, 3)
        proj.decal(f"Blush{nm}{k}", poly if s < 0 else list(reversed(poly)), ink, push=0.003, cuts=0)

# Nose: a small inked wedge on the shadow side.
nose = stroke((0.004, -0.04), (0.01, -0.058), (0.0, -0.062), 0.006, 0.003, 4)
proj.decal("Nose", list(reversed(nose)), ink, push=0.003, cuts=0)

# The big grin: a wide open D-shaped mouth, a row of white teeth, a toned tongue.
mouth_top = bez((-0.078, -0.082), (0.0, -0.096), (0.082, -0.076), 12)
mouth_bot = bez((0.082, -0.076), (0.015, -0.215), (-0.078, -0.082), 12)
mouth = list(reversed(mouth_top + mouth_bot[1:-1]))
proj.decal("Mouth", mouth, ink, push=0.002, cuts=2)
teeth_top = bez((-0.066, -0.089), (0.0, -0.1), (0.07, -0.083), 10)
teeth_bot = bez((0.07, -0.083), (0.004, -0.122), (-0.066, -0.089), 10)
proj.decal("Teeth", list(reversed(teeth_top + teeth_bot[1:-1])), white, push=0.0032, cuts=1)
tongue = [(0.014 + 0.036 * math.cos(a), -0.137 + 0.013 * math.sin(a)) for a in
          [2 * math.pi * i / 12 for i in range(12)]]
proj.decal("Tongue", tongue, tongue_tone, push=0.0032, cuts=1)
# Little smile creases at the corners.
for s in (1, -1):
    crease = stroke((s * 0.072, -0.076), (s * 0.085, -0.085), (s * 0.08, -0.1), 0.003, 0.006, 4)
    proj.decal(f"Crease{s}", crease if s < 0 else list(reversed(crease)), ink, push=0.002, cuts=0)

# ---- Hair: a black cap and lots of sharp spikes flying out in every direction ----
HC = Vector((0, 0.03, 0.235))
HR = (0.205, 0.198, 0.19)
cap = ol(b.ball("HairCap", 1.0, HC, scale=HR, mat=hair, parent=head, segments=28, rings=14), 0.008)
for v in cap.data.vertices:  # tuck the cap behind the hairline at the front
    if v.co.y < -0.1 and v.co.z < 0.0:
        v.co.y *= 0.8

HAIR = []


def hair_point(az, el, push=-0.02):
    loc, _ = b.on_surface(tuple(HC), HR, az, el, push=push)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    n = Vector((d.x / HR[0], d.y / HR[1], d.z / HR[2])).normalized()
    return Vector(loc), n


def add_spike(nm, az, el, length, radius, lift=0.0, sweep_=(0, 0, 0), bend=0.4, flat=0.55, push=-0.03):
    loc, n = hair_point(az, el, push)
    up = Vector((0, 0, 1))
    d = n + up * lift + Vector(sweep_)
    side = n.cross(d)
    bend_dir = d.cross(side) if side.length > 1e-4 else Vector((0, 1, 0))
    o = spike(nm, length, radius, loc, d, -bend_dir * 0 + Vector((0, 0, 1)) * 0.0 + n * 0.0 + bend_dir,
              bend=bend, mat=hair, parent=head, flat=flat)
    HAIR.append(ol(o, 0.007))
    return o


# Crown and sides: big spikes radiating out and up (wild, like the concept).
spec = [
    # az(deg), el(deg), length, radius, lift
    (0, 78, 0.26, 0.085, 0.6), (40, 70, 0.27, 0.085, 0.4), (-40, 70, 0.27, 0.085, 0.4),
    (100, 60, 0.26, 0.08, 0.3), (-100, 60, 0.26, 0.08, 0.3), (160, 62, 0.25, 0.08, 0.35), (-160, 62, 0.25, 0.08, 0.35),
    (65, 40, 0.27, 0.08, 0.15), (-65, 40, 0.27, 0.08, 0.15), (120, 30, 0.25, 0.08, 0.05), (-120, 30, 0.25, 0.08, 0.05),
    (180, 30, 0.24, 0.08, 0.0), (90, 12, 0.22, 0.075, -0.1), (-90, 12, 0.22, 0.075, -0.1),
    (145, 5, 0.22, 0.075, -0.25), (-145, 5, 0.22, 0.075, -0.25), (180, -5, 0.2, 0.075, -0.3),
    (110, -15, 0.16, 0.06, -0.5), (-110, -15, 0.16, 0.06, -0.5), (160, -25, 0.16, 0.065, -0.5),
    (-160, -25, 0.16, 0.065, -0.5), (20, 55, 0.22, 0.08, 0.5), (-20, 55, 0.22, 0.08, 0.5),
    (75, 75, 0.22, 0.075, 0.6), (-75, 75, 0.22, 0.075, 0.6), (130, 80, 0.2, 0.075, 0.7), (-130, 80, 0.2, 0.075, 0.7),
]
for i, (az, el, ln, rd, lift) in enumerate(spec):
    add_spike(f"Spike{i}", math.radians(az + R.uniform(-6, 6)), math.radians(el + R.uniform(-4, 4)),
              ln * R.uniform(0.92, 1.12) * 0.78, rd * 0.95, lift=lift, bend=R.uniform(0.25, 0.55))

# Bangs: sharp clumps falling over the forehead between and above the eyes.
bangs = [(-48, 38, 0.17, 0.06, (-0.25, -0.2, -0.9)), (-25, 44, 0.19, 0.065, (-0.1, -0.35, -1.0)),
         (-3, 46, 0.2, 0.065, (0.05, -0.35, -1.0)), (20, 44, 0.19, 0.065, (0.2, -0.35, -1.0)),
         (45, 38, 0.17, 0.06, (0.3, -0.25, -0.9)), (-65, 25, 0.16, 0.055, (-0.2, -0.1, -1.0)),
         (65, 25, 0.16, 0.055, (0.2, -0.1, -1.0))]
for i, (az, el, ln, rd, d) in enumerate(bangs):
    loc, n = hair_point(math.radians(az), math.radians(el), push=-0.035)
    dirv = Vector(d).normalized() + n * 0.45
    o = spike(f"Bang{i}", ln, rd, loc, dirv, n, bend=0.35, mat=hair, parent=head, flat=0.5)
    HAIR.append(ol(o, 0.007))
# Sideburn spikes in front of the ears.
for s in (1, -1):
    loc, n = hair_point(s * math.radians(82), math.radians(-5), push=-0.03)
    o = spike(f"Sideburn{s}", 0.13, 0.04, loc, Vector((s * 0.15, -0.2, -1.0)), n, bend=0.3, mat=hair, parent=head,
              flat=0.5)
    HAIR.append(ol(o, 0.006))


# =====================================================================================
# Scarf: wrapped around the neck, two long torn tails whipping out behind him
# =====================================================================================
def scarf_wrap():
    pts, n = [], 36
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 0.105 + 0.008 * math.sin(3 * a)
        pts.append((r * math.sin(a), -r * 0.95 * math.cos(a) - 0.005, 1.475 - 0.022 * math.cos(a)
                    + 0.006 * math.sin(4 * a)))
    prof = ellipse(0.042, 0.024, 10)
    return sweep("ScarfWrap", pts, (0, 0, 1), prof, closed=True, mat=scarf, parent=body,
                 scales=[1 + 0.18 * math.sin(2 * math.pi * i / n * 2 + 0.5) for i in range(n)])


ol(scarf_wrap(), 0.008)


def tail(name, start, direction, length, width, waves, phase, twist, droop=0.0, cols=6, rows=28, thick=0.012,
         jag=0.14, seed=1, mat=scarf):
    """A long fluttering ribbon with a torn end (columns end at different lengths)."""
    rr = b.rng(seed)
    D = Vector(direction).normalized()
    up0 = Vector((0, 0, 1))
    up0 = (up0 - D * up0.dot(D)).normalized()
    side0 = D.cross(up0)
    ends = [1.0 - jag * rr.random() * (1 if j % 2 else 0.4) for j in range(cols)]

    def center(s):
        wave = math.sin(2 * math.pi * waves * s + phase)
        return (Vector(start) + D * (length * s) + up0 * (0.09 * wave * s - droop * s * s)
                + side0 * (0.06 * math.sin(2 * math.pi * waves * 0.7 * s + phase + 1.0) * s))

    def across(s):
        ang = twist * math.sin(math.pi * 1.4 * s + phase)
        return (up0 * math.cos(ang) + side0 * math.sin(ang)).normalized()

    bm = bmesh.new()
    top, bot = [], []
    for j in range(cols):
        tcol, bcol = [], []
        for i in range(rows + 1):
            s = ends[j] * i / rows
            c = center(s)
            ds = (center(s + 0.01) - c).normalized()
            w = width * (1.0 - 0.15 * s) * (1 + 0.15 * s * math.sin(9 * s + j))
            a = across(s)
            nrm = ds.cross(a).normalized()
            p = c + a * w * (j / (cols - 1) - 0.5)
            tcol.append(bm.verts.new(p + nrm * thick / 2))
            bcol.append(bm.verts.new(p - nrm * thick / 2))
        top.append(tcol)
        bot.append(bcol)
    for j in range(cols - 1):
        for i in range(rows):
            bm.faces.new((top[j][i], top[j + 1][i], top[j + 1][i + 1], top[j][i + 1]))
            bm.faces.new((bot[j][i], bot[j][i + 1], bot[j + 1][i + 1], bot[j + 1][i]))
    for i in range(rows):  # long edges
        bm.faces.new((top[0][i], top[0][i + 1], bot[0][i + 1], bot[0][i]))
        bm.faces.new((top[-1][i], bot[-1][i], bot[-1][i + 1], top[-1][i + 1]))
    for j in range(cols - 1):  # root and torn end
        bm.faces.new((top[j][0], bot[j][0], bot[j + 1][0], top[j + 1][0]))
        bm.faces.new((top[j][-1], top[j + 1][-1], bot[j + 1][-1], bot[j][-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return b._mesh_object(name, bm, (0, 0, 0), (0, 0, 0), mat, None, True)


scarf_rig = b.pivot("Scarf", (0.06, 0.08, 1.48), parent=body)
t1o = tail("ScarfTail1", (0.0, 0.0, 0.0), (0.92, 0.3, 0.22), 1.15, 0.18, 1.3, 0.3, 0.7, droop=0.02, seed=3)
t2o = tail("ScarfTail2", (0.0, 0.01, -0.02), (0.9, 0.42, -0.06), 0.9, 0.15, 1.6, 2.0, 0.9, droop=0.05, seed=7)
for i, o in enumerate((t1o, t2o)):
    piv = b.pivot(f"ScarfTail{'AB'[i]}", (0, 0, 0), parent=scarf_rig)
    o.parent = piv
    ol(o, 0.007)
knot = b.ball("ScarfKnot", 0.04, (0.0, 0.0, 0.0), scale=(1.1, 1.0, 1.0), mat=scarf, parent=scarf_rig, segments=14,
              rings=8)
ol(knot, 0.007)


# =====================================================================================
# Pose
# =====================================================================================
def pose():
    # Legs: a wide, planted stance; his left foot a little forward.
    for nm, s, fwd in (("L", 1, -0.06), ("R", -1, 0.05)):
        leg, knee, ankle = LEGS[nm]
        foot = Vector((s * 0.25, fwd - 0.0, 0.12))
        hip = Vector((s * 0.095, 0, HIP_Z))
        d = foot - hip
        knee_bend = 0.12
        set_world_rot(leg, frame(d, (0, -1, 0)) @ Matrix.Rotation(-knee_bend, 3, "X"))
        knee.rotation_euler = (knee_bend * 2, 0, 0)
        set_world_rot(ankle, Matrix.Rotation(s * 0.28, 3, "Z"))

    # Right arm: raised, fist up by his shoulder, sword resting back over it.
    sh = Vector((-0.2, 0, 1.37))
    elbow = sh + Vector((-0.75, 0.05, -0.6)).normalized() * 0.22
    wrist = elbow + Vector((0.08, -0.12, 1.0)).normalized() * 0.22
    set_world_rot(armR, frame(elbow - sh, (0, -1, 0)))
    blade_dir = Vector((-0.3, 0.72, 0.62)).normalized()
    fore = (wrist - elbow)
    set_world_rot(elbowR, frame(fore, (0, -1, 0)))
    hm = frame(fore, -blade_dir)  # hand: -Z continues the forearm, +Y points along the blade
    set_world_rot(handR, hm)
    # The sword's +Z axis along the blade (through the fist).
    zax = blade_dir
    xax = zax.cross(Vector((0, 0, 1))).normalized()
    yax = zax.cross(xax)
    set_world_rot(sword, Matrix((xax, yax, zax)).transposed())

    # Left arm: down and a little out, a clenched fist.
    shl = Vector((0.2, 0, 1.37))
    el = shl + Vector((0.08, 0.02, -1)).normalized() * 0.22
    wr = el + Vector((0.07, -0.08, -1)).normalized() * 0.22
    set_world_rot(armL, frame(el - shl, (0, -1, 0)))
    set_world_rot(elbowL, frame(wr - el, (0, -1, 0)))
    set_world_rot(handL, frame(wr - el, (0.3, -1, 0)))

    head.rotation_euler = (0.06, 0.0, -0.12)


pose()


def ground_him():
    bpy.context.view_layer.update()
    low = min((o.matrix_world @ v.co).z for o in b.meshes() if o.name.startswith(("Sole", "ToeCap"))
              for v in o.data.vertices)
    root.location.z -= low
    bpy.context.view_layer.update()


ground_him()


# =====================================================================================
# Ink outlines (inverted hulls) and the hero mask
# =====================================================================================
def no_shadow(m):
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


def ink_outlines(items):
    om = flat("Outline", "#000000")
    om.use_backface_culling = True
    if hasattr(om, "use_backface_culling_shadow"):
        om.use_backface_culling_shadow = True
    no_shadow(om)
    for obj, thickness in items:
        if thickness <= 0 or obj.type != "MESH":
            continue
        obj.data.materials.append(om)
        mod = obj.modifiers.new("Outline", "SOLIDIFY")
        mod.thickness = thickness
        mod.offset = 1
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.use_even_offset = False
        mod.material_offset = len(obj.data.materials) - 1


ink_outlines(OUTLINES)

# Faces' decals and the outline should not cast shadows; neither should the hair onto the face much.
for m_ in (ink, white, iris_tone, tongue_tone, hair):
    no_shadow(m_)
for o in HAIR + [cap]:
    o.visible_shadow = False
# Long thin things (scarf tails, sword) would throw stray shadow shapes across the page.
for o in b.meshes():
    if o.name.startswith(("ScarfTail", "Blade", "Fuller", "Guard", "Grip", "Wrap", "Pommel")):
        o.visible_shadow = False


# =====================================================================================
# Studio: a white manga page with speed lines, one sun, flat print
# =====================================================================================
def page_studio():
    b.studio(view="Standard")
    scene = bpy.context.scene
    for o in list(scene.collection.objects):
        if o.name in ("Floor", "Sun", "Key", "Fill", "Rim"):
            bpy.data.objects.remove(o)
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.28
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = math.pi
    sun.angle = math.radians(1.0)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (-LIGHT).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(so)

    # Paper cyclorama: floor sweeping up into a wall behind him.
    bm = bmesh.new()
    prof = [(-14 + i * 2.0, 0.0) for i in range(10)]
    for i in range(1, 13):
        a = i / 12 * math.pi / 2
        prof.append((5 + 4 * math.sin(a), 4 * (1 - math.cos(a))))
    prof += [(9, 10.0), (9, 18.0)]
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
    if bm.faces[0].normal.z < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Page")
    bm.to_mesh(me)
    bm.free()
    page = bpy.data.objects.new("Page", me)
    scene.collection.objects.link(page)

    # Page material: white paper, cast shadows printed as a screentone, speed lines radiating
    # from the middle of the frame (in screen space) out to the edges.
    m = manga("PageMat", shadow=0.3, lit=0.0, t1=0.4, hero=False)
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    g = [n for n in N if n.type == "GROUP"][0]
    cov_in = g.inputs["Coverage"].links[0].from_socket
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Window"], sep.inputs[0])
    asp = N.new("ShaderNodeValue")
    asp.name = "Aspect"
    asp.outputs[0].default_value = 1.0
    amount = N.new("ShaderNodeValue")
    amount.name = "Amount"
    amount.outputs[0].default_value = 1.0
    dx = _node_math(N, L, "MULTIPLY", _node_math(N, L, "SUBTRACT", sep.outputs["X"], 0.5), asp.outputs[0])
    dy = _node_math(N, L, "SUBTRACT", sep.outputs["Y"], 0.56)
    rr = _node_math(N, L, "SQRT", _node_math(N, L, "ADD", _node_math(N, L, "MULTIPLY", dx, dx),
                                              _node_math(N, L, "MULTIPLY", dy, dy)))
    ang = _node_math(N, L, "ARCTAN2", dy, dx)
    sectors = 240
    a_ = _node_math(N, L, "MULTIPLY", _node_math(N, L, "ADD", _node_math(N, L, "DIVIDE", ang, 2 * math.pi), 0.5),
                    sectors)
    cell = _node_math(N, L, "FLOOR", a_)
    f = _node_math(N, L, "ABSOLUTE", _node_math(N, L, "SUBTRACT", _node_math(N, L, "FRACT", a_), 0.5))
    wn = N.new("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = "1D"
    L.new(cell, wn.inputs["W"])
    wn2 = N.new("ShaderNodeTexWhiteNoise")
    wn2.noise_dimensions = "1D"
    L.new(_node_math(N, L, "ADD", cell, 71.3), wn2.inputs["W"])
    h, h2 = wn.outputs["Value"], wn2.outputs["Value"]
    present = _node_math(N, L, "GREATER_THAN", h, 0.42)
    # Each line starts at its own distance from the middle and widens outward (a tapered stroke).
    start = _node_math(N, L, "MULTIPLY_ADD", h2, 0.2)
    start.node.inputs[2].default_value = 0.4
    grow = _node_math(N, L, "MULTIPLY", _node_math(N, L, "SUBTRACT", rr, start), 0.9, clamp=False)
    wf = _node_math(N, L, "MULTIPLY_ADD", h, 0.6)
    wf.node.inputs[2].default_value = 0.2
    width = _node_math(N, L, "MULTIPLY", _node_math(N, L, "MAXIMUM", grow, 0.0), wf)
    line = _node_math(N, L, "MULTIPLY", _node_math(N, L, "LESS_THAN", f, width), present)
    line = _node_math(N, L, "MULTIPLY", line, amount.outputs[0])
    tot = _node_math(N, L, "MAXIMUM", cov_in, line)
    L.new(tot, g.inputs["Coverage"])
    me.materials.append(m)

    def aspect(scene, *_):
        k = scene.render.resolution_x / scene.render.resolution_y
        asp.outputs[0].default_value = k
        amount.outputs[0].default_value = 1.0 if k < 1.5 else 0.0  # a clean model sheet for the turnaround
    bpy.app.handlers.render_pre.append(aspect)

    eevee = scene.eevee
    for attr, value in (("taa_render_samples", 24 if FAST else 48), ("use_raytracing", False), ("use_gtao", False),
                        ("shadow_ray_count", 1), ("shadow_step_count", 6)):
        if hasattr(eevee, attr):
            setattr(eevee, attr, value)
    scene.render.filter_size = 1.0


def silhouette_line(px=4):
    """Compositor: a heavy ink line around the whole figure (the 'hero' AOV mask, dilated)."""
    scene = bpy.context.scene
    vl = bpy.context.view_layer
    aov = vl.aovs.add()
    aov.name = "hero"
    aov.type = "VALUE"
    for m_ in HERO_MATS:
        nt = m_.node_tree
        for n in nt.nodes:
            if n.type == "OUTPUT_AOV":
                n.aov_name = "hero"
    ng = bpy.data.node_groups.new("Page", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    scene.compositing_node_group = ng
    N, L = ng.nodes, ng.links
    rl = N.new("CompositorNodeRLayers")
    rl.scene = scene
    dil = N.new("CompositorNodeDilateErode")
    dil.inputs["Type"].default_value = "Distance"
    dil.inputs["Size"].default_value = px
    L.new(rl.outputs["hero"], dil.inputs["Mask"])
    aa = N.new("CompositorNodeAntiAliasing")
    L.new(dil.outputs[0], aa.inputs["Image"])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    L.new(aa.outputs[0], mix.inputs["Factor"])
    L.new(rl.outputs["Image"], mix.inputs[6])
    mix.inputs[7].default_value = (0, 0, 0, 1)
    mix2 = N.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    L.new(rl.outputs["hero"], mix2.inputs["Factor"])
    L.new(mix.outputs[2], mix2.inputs[6])
    L.new(rl.outputs["Image"], mix2.inputs[7])
    go = N.new("NodeGroupOutput")
    L.new(mix2.outputs[2], go.inputs[0])

    def size(scene, *_):
        dil.inputs["Size"].default_value = max(2, round(px * scene.render.resolution_y / 1200))
    bpy.app.handlers.render_pre.append(size)


page_studio()
silhouette_line(5)

tris = b.triangles()
print(f"ANIME parts={len(b.meshes())} tris={tris}")
if FAST:
    b.render_all(ID, hero_size=600, turn_size=(1200, 500))
else:
    b.render_all(ID)


# =====================================================================================
# Export: plain base colors (the game would do its own toon + screentone shading)
# =====================================================================================
def prepare_export():
    for m in bpy.data.materials:
        if m.name not in EXPORT_COLORS or not m.use_nodes:
            continue
        nt = m.node_tree
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = EXPORT_COLORS[m.name]
        p.inputs["Roughness"].default_value = 1.0
        if m.name in ("Outline", "Ink", "White"):
            p.inputs["Emission Color"].default_value = EXPORT_COLORS[m.name]
            p.inputs["Emission Strength"].default_value = 1.0
        nt.links.new(p.outputs[0], nt.nodes.get("Material Output").inputs["Surface"])


prepare_export()
b.export(ID)
