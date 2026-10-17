"""Style 1: Steampunk Robot. Bobert as a small clockwork robot adventurer: a round, riveted copper
body with teal patina panels and brass trim, chest gauges and a vent grille, a brass helmet head
with a glass dome full of gears, big glowing amber lens eyes, a puffing chimney, a wind-up key on
his back, spring-and-piston legs in big copper boots, and a short sword held in a brass claw.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/1_robot.py
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "robot"
b.reset()
R = b.rng(7)

TEX_COPPER = b.texture(ID, "copper")
TEX_PATINA = b.texture(ID, "patina")
TEX_BRASS = b.texture(ID, "brass")
TEX_LEATHER = b.texture(ID, "leather")


# ---- Materials ----

def _bsdf(m):
    return m.node_tree.nodes.get("Principled BSDF")


def vary_roughness(m, lo, hi, scale=6.0, detail=3.0):
    """Roughness that wanders between lo and hi (smudges and polish on the metal)."""
    nodes, links = m.node_tree.nodes, m.node_tree.links
    coord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    links.new(coord.outputs["Object"], noise.inputs["Vector"])
    rng_ = nodes.new("ShaderNodeMapRange")
    rng_.inputs["From Min"].default_value = 0.3
    rng_.inputs["From Max"].default_value = 0.7
    rng_.inputs["To Min"].default_value = lo
    rng_.inputs["To Max"].default_value = hi
    links.new(noise.outputs["Fac"], rng_.inputs[0])
    links.new(rng_.outputs[0], _bsdf(m).inputs["Roughness"])
    return m


def metal(name, color, tex=None, tint="#ffffff", roughness=(0.2, 0.4), metallic=1.0, scale=2.0, bump=0.0,
          strength=1.0):
    if tex:
        m = b.mat(name, tint, roughness=roughness[0], metallic=metallic, image=tex, image_scale=scale,
                  image_strength=strength, bump=bump)
    else:
        m = b.mat(name, color, roughness=roughness[0], metallic=metallic)
    m.diffuse_color = b.rgba(color)
    return vary_roughness(m, *roughness)


def glass_mat(name, color="#ffffff", alpha=0.08, roughness=0.03):
    m = b.mat(name, color, roughness=roughness, metallic=0.0)
    bs = _bsdf(m)
    bs.inputs["Alpha"].default_value = alpha
    bs.inputs["Coat Weight"].default_value = 1.0
    bs.inputs["Specular IOR Level"].default_value = 1.0
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    m.diffuse_color = b.rgba(color, alpha)
    return m


def lens_mat(name):
    """Glowing amber lens: hot yellow in the middle, deep orange toward the rim."""
    m = b.mat(name, "#1a0600", roughness=0.03, emission="#ffa020", emission_strength=1.5)
    _bsdf(m).inputs["Specular IOR Level"].default_value = 0.15
    nodes, links = m.node_tree.nodes, m.node_tree.links
    lw = nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    ramp = nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = b.rgba("#ffc23a")
    els[1].position = 0.62
    els[1].color = b.rgba("#5a1200")
    mid = els.new(0.25)
    mid.color = b.rgba("#ff6a00")
    links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], _bsdf(m).inputs["Emission Color"])
    return m


def steam_mat(name):
    m = b.mat(name, "#f6efe6", roughness=1.0, emission="#fff4e4", emission_strength=0.35)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bs = _bsdf(m)
    lw = nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    inv = nodes.new("ShaderNodeMapRange")
    inv.inputs["From Min"].default_value = 0.0
    inv.inputs["From Max"].default_value = 1.0
    inv.inputs["To Min"].default_value = 0.5
    inv.inputs["To Max"].default_value = 0.0
    links.new(lw.outputs["Facing"], inv.inputs[0])
    links.new(inv.outputs[0], bs.inputs["Alpha"])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    m.diffuse_color = b.rgba("#f6efe6", 0.5)
    return m


copper = metal("Copper", "#c25a3a", TEX_COPPER, tint="#ffb4a0", roughness=(0.22, 0.42), scale=1.6, bump=0.15)
copper_plain = metal("CopperTrim", "#c45a3c", roughness=(0.2, 0.35))
patina = metal("Patina", "#4e9b88", TEX_PATINA, tint="#e4fff6", roughness=(0.45, 0.7), metallic=0.35, scale=1.8,
               bump=0.25)
brass = metal("Brass", "#e3b54a", TEX_BRASS, tint="#fff7b8", roughness=(0.16, 0.34), scale=2.5, bump=0.05)
brass_dark = metal("BrassDark", "#a8782c", roughness=(0.3, 0.45))
steel = metal("DarkSteel", "#3b3330", roughness=(0.3, 0.5), metallic=0.9)
spring_m = metal("Spring", "#5a463a", roughness=(0.25, 0.4), metallic=1.0)
iron = metal("Iron", "#2c2522", roughness=(0.6, 0.8), metallic=0.6)
blade_m = metal("Blade", "#eceef2", roughness=(0.22, 0.4), metallic=1.0)
leather = b.mat("Leather", "#ffffff" if TEX_LEATHER else "#7a4a2a", roughness=0.6, image=TEX_LEATHER,
                image_scale=4.0, bump=0.2 if TEX_LEATHER else 0.0)
leather.diffuse_color = b.rgba("#7a4a2a")
if TEX_LEATHER:
    _bsdf(leather).inputs["Base Color"].default_value = b.rgba("#d8b49a")
    leather.node_tree.nodes["Mix"].inputs["A"].default_value = b.rgba("#e0c0a8")
dial = b.mat("Dial", "#f2e6c6", roughness=0.45)
ink = b.mat("DialInk", "#2a1b12", roughness=0.5)
needle_m = b.mat("Needle", "#9a1f12", roughness=0.35, metallic=0.4)
hole = b.mat("Shadow", "#120a06", roughness=0.9)
mouth_m = b.mat("Mouth", "#1c0f08", roughness=0.4, emission="#ff7a10", emission_strength=0.15)
glass = glass_mat("Glass")
lens = lens_mat("Lens")
steam = steam_mat("Steam")


# ---- Geometry helpers (this style only) ----

def mtx(loc=(0, 0, 0), rot=None, scale=(1, 1, 1)):
    if rot is None:
        r = Matrix.Identity(3)
    elif isinstance(rot, Matrix):
        r = rot.to_3x3()
    else:
        r = Euler(rot).to_matrix()
    return Matrix.Translation(Vector(loc)) @ r.to_4x4() @ Matrix.Diagonal((*scale, 1.0))


def frame(n, up=(0, 0, 1)):
    """Rotation that turns local +Z to n, keeping local +Y as close to `up` as it can."""
    n = Vector(n).normalized()
    x = Vector(up).cross(n)
    if x.length < 1e-6:
        x = Vector((1, 0, 0)).cross(n)
    x.normalize()
    y = n.cross(x)
    return Matrix((x, y, n)).transposed()


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


def smooth_profile(ctrl, per=4):
    return [tuple(v) for v in catmull([Vector(c) for c in ctrl], per)]


class Kit:
    """Many machine parts merged into one mesh (one material) to keep the object count down."""

    def __init__(self):
        self.bm = bmesh.new()

    def _shade(self, verts, smooth, axis=None):
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            if axis is not None and smooth:
                f.smooth = abs(f.normal.normalized().dot(axis)) < 0.9
            else:
                f.smooth = smooth

    def sphere(self, loc, r, rot=None, scale=(1, 1, 1), seg=12, rings=6, smooth=True):
        g = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=r,
                                      matrix=mtx(loc, rot, scale))
        self._shade(g["verts"], smooth)

    def cyl(self, loc, r, depth, rot=None, seg=16, r2=None, scale=(1, 1, 1), smooth=True):
        M = mtx(loc, rot, scale)
        g = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                                  radius2=r if r2 is None else r2, depth=depth, matrix=M)
        bmesh.ops.recalc_face_normals(self.bm, faces=list({f for v in g["verts"] for f in v.link_faces}))
        axis = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
        self._shade(g["verts"], smooth, axis)

    def box(self, loc, size, rot=None, bevel=0.0, smooth=False, segs=1):
        g = bmesh.ops.create_cube(self.bm, size=1.0, matrix=mtx(loc, rot, size))
        verts = g["verts"]
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            res = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=segs, profile=0.5, affect="EDGES",
                                  clamp_overlap=True)
            verts = list(set(verts) | set(res.get("verts", [])))
            verts = list({v for f in res.get("faces", []) for v in f.verts} | set(v for v in verts if v.is_valid))
        self._shade([v for v in verts if v.is_valid], smooth)

    def lathe(self, profile, loc=(0, 0, 0), rot=None, scale=(1, 1, 1), seg=24, caps=True, smooth=True):
        M = mtx(loc, rot, scale)
        rings = []
        for r, z in profile:
            rings.append([self.bm.verts.new(M @ Vector((r * math.cos(2 * math.pi * i / seg),
                                                        r * math.sin(2 * math.pi * i / seg), z)))
                          for i in range(seg)])
        faces = []
        for k in range(len(rings) - 1):
            a, c = rings[k], rings[k + 1]
            for i in range(seg):
                faces.append(self.bm.faces.new((a[i], a[(i + 1) % seg], c[(i + 1) % seg], c[i])))
        for f in faces:
            f.smooth = smooth
        if caps:
            for ring, rev in ((rings[0], True), (rings[-1], False)):
                if profile[0 if rev else -1][0] > 1e-5:
                    f = self.bm.faces.new(list(reversed(ring)) if rev else ring)
                    f.smooth = False
                    faces.append(f)
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)

    def torus(self, loc, major, minor, rot=None, scale=(1, 1, 1), seg=24, mseg=8, arc=None, start=None):
        """A ring around local Z. arc: an open capped piece of it, centered on angle `start`
        (default: the -Y side)."""
        M = mtx(loc, rot, scale)
        closed = arc is None
        count = seg if closed else seg + 1
        mid = -math.pi / 2 if start is None else start
        rings = []
        for i in range(count):
            a = 2 * math.pi * i / seg if closed else mid - arc / 2 + arc * i / seg
            ring = []
            for j in range(mseg):
                t = 2 * math.pi * j / mseg
                rr = major + minor * math.cos(t)
                ring.append(self.bm.verts.new(M @ Vector((rr * math.cos(a), rr * math.sin(a), minor * math.sin(t)))))
            rings.append(ring)
        faces = []
        for i in range(seg):
            a, c = rings[i], rings[(i + 1) % count]
            for j in range(mseg):
                faces.append(self.bm.faces.new((a[j], c[j], c[(j + 1) % mseg], a[(j + 1) % mseg])))
        for f in faces:
            f.smooth = True
        if not closed:
            for ring in (rings[0], rings[-1]):
                f = self.bm.faces.new(ring)
                f.smooth = False
                faces.append(f)
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)

    def tube(self, pts, r, around=8, caps=True, r_end=None):
        pts = [Vector(p) for p in pts]
        n = len(pts)
        tang = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
        ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = tang[0].cross(ref).normalized()
        rings = []
        for i, p in enumerate(pts):
            t = tang[i]
            nrm = (nrm - t * nrm.dot(t)).normalized()
            bi = t.cross(nrm)
            rr = r if r_end is None else r + (r_end - r) * i / max(n - 1, 1)
            rings.append([self.bm.verts.new(p + (nrm * math.cos(a) + bi * math.sin(a)) * rr)
                          for a in (2 * math.pi * j / around for j in range(around))])
        faces = []
        for i in range(n - 1):
            for j in range(around):
                j2 = (j + 1) % around
                faces.append(self.bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j])))
        for f in faces:
            f.smooth = True
        if caps:
            faces.append(self.bm.faces.new(list(reversed(rings[0]))))
            faces.append(self.bm.faces.new(rings[-1]))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)

    def gear(self, loc, rot, r, teeth, thick, tooth=0.2, rim=0.62, spokes=5):
        """A spur gear in local XY: toothed rim, spokes and a hub."""
        M = mtx(loc, rot)
        rr = r * (1 - tooth)
        ri = r * rim
        outer, inner = [], []
        for i in range(teeth):
            a0 = 2 * math.pi * i / teeth
            da = 2 * math.pi / teeth
            for f, rad in ((0.0, rr), (0.12, r), (0.4, r), (0.52, rr)):
                a = a0 + f * da
                outer.append((rad * math.cos(a), rad * math.sin(a)))
                inner.append((ri * math.cos(a), ri * math.sin(a)))
        n = len(outer)
        layers = {}
        for zs in (-1, 1):
            z = zs * thick / 2
            layers[zs] = ([self.bm.verts.new(M @ Vector((x, y, z))) for x, y in outer],
                          [self.bm.verts.new(M @ Vector((x, y, z))) for x, y in inner])
        faces = []
        for i in range(n):
            i2 = (i + 1) % n
            (ot, it), (ob, ib) = layers[1], layers[-1]
            faces.append(self.bm.faces.new((ot[i], ot[i2], it[i2], it[i])))
            faces.append(self.bm.faces.new((ob[i2], ob[i], ib[i], ib[i2])))
            faces.append(self.bm.faces.new((ob[i], ob[i2], ot[i2], ot[i])))
            faces.append(self.bm.faces.new((ib[i2], ib[i], it[i], it[i2])))
        for f in faces:
            f.smooth = False
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        R3 = M.to_3x3()
        for k in range(spokes):
            a = 2 * math.pi * k / spokes + 0.3
            mid_r = (ri + r * 0.18) / 2
            self.box(M @ Vector((mid_r * math.cos(a), mid_r * math.sin(a), 0)),
                     (ri - r * 0.12, r * 0.12, thick * 0.8), R3 @ Euler((0, 0, a)).to_matrix())
        self.cyl(M @ Vector((0, 0, 0)), r * 0.22, thick * 1.7, R3, seg=12)
        self.cyl(M @ Vector((0, 0, 0)), r * 0.08, thick * 2.2, R3, seg=8)

    def build(self, name, material, parent=None):
        mesh = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        obj = bpy.data.objects.new(name, mesh)
        b._link(obj, parent)
        obj.data.materials.append(material)
        return obj


def aim(piv, world_dir, up=(0, 0, 1)):
    """Turn a limb pivot so its local -Z (the way the limb hangs) points along world_dir."""
    bpy.context.view_layer.update()
    parent_rot = piv.parent.matrix_world.to_3x3().normalized() if piv.parent else Matrix.Identity(3)
    want = frame(-Vector(world_dir), up)
    piv.rotation_euler = (parent_rot.inverted() @ want).to_euler()


# ---- The egg body's surface (body-local coordinates; the Body pivot sits at the hips) ----

HIP = 0.6
BODY_SY = 0.86
BODY_CTRL = [(0.0, -0.06), (0.14, -0.056), (0.245, -0.03), (0.315, 0.02), (0.36, 0.09), (0.383, 0.18),
             (0.39, 0.28), (0.382, 0.38), (0.355, 0.47), (0.315, 0.55), (0.275, 0.615), (0.255, 0.655),
             (0.0, 0.665)]
BODY_PROFILE = smooth_profile(BODY_CTRL, 3)


def body_r(z):
    for (r0, z0), (r1, z1) in zip(BODY_PROFILE, BODY_PROFILE[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-6)
    return 0.0


def body_pt(az, z, push=0.0):
    """Point and outward normal on the body. az 0 = front (-Y), + toward his left (+X)."""
    r = body_r(z)
    dr = (body_r(z + 0.004) - body_r(z - 0.004)) / 0.008
    n = Vector((math.sin(az), -math.cos(az) / BODY_SY, -dr)).normalized()
    p = Vector((r * math.sin(az), -BODY_SY * r * math.cos(az), z))
    return p + n * push, n


def patch(kit, z0, z1, az_range, push, depth=0.014, nz=10, nu=12):
    """A curved plate lying on the body: az_range(z) -> (az0, az1)."""
    top, bot = [], []
    for i in range(nz + 1):
        z = z0 + (z1 - z0) * i / nz
        a0, a1 = az_range(z)
        rt, rb = [], []
        for j in range(nu + 1):
            a = a0 + (a1 - a0) * j / nu
            rt.append(kit.bm.verts.new(body_pt(a, z, push)[0]))
            rb.append(kit.bm.verts.new(body_pt(a, z, push - depth)[0]))
        top.append(rt)
        bot.append(rb)
    faces = []
    for i in range(nz):
        for j in range(nu):
            faces.append(kit.bm.faces.new((top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j])))
    border = [top[0][j] for j in range(nu + 1)] + [top[i][nu] for i in range(1, nz + 1)] + \
             [top[nz][j] for j in range(nu - 1, -1, -1)] + [top[i][0] for i in range(nz - 1, 0, -1)]
    border_b = [bot[0][j] for j in range(nu + 1)] + [bot[i][nu] for i in range(1, nz + 1)] + \
               [bot[nz][j] for j in range(nu - 1, -1, -1)] + [bot[i][0] for i in range(nz - 1, 0, -1)]
    for k in range(len(border)):
        k2 = (k + 1) % len(border)
        f = kit.bm.faces.new((border[k], border_b[k], border_b[k2], border[k2]))
        f.smooth = False
        faces.append(f)
    for f in faces[:nz * nu]:
        f.smooth = True
    bmesh.ops.recalc_face_normals(kit.bm, faces=faces)


def strap_range(az, width):
    return lambda z: (az - width / 2 / max(body_r(z), 0.05), az + width / 2 / max(body_r(z), 0.05))


def rivet(kit, loc, normal, r=0.011, seg=6, rings=3):
    kit.sphere(loc, r, frame(normal), (1, 1, 0.6), seg=seg, rings=rings)


# =====================================================================================
root = b.pivot("Bobert")
body = b.pivot("Body", (0, 0, HIP), parent=root)

# ---- Body: patina shell, copper plates, brass straps, rivets ----
b.from_points("BodyShell", BODY_PROFILE, mat=patina, parent=body, segments=48, scale=(1, BODY_SY, 1))
cop = Kit()
brs = Kit()
riv = Kit()
FRONT = (-0.72, 0.74)
PLATE_Z = (0.04, 0.5)
patch(cop, PLATE_Z[0], PLATE_Z[1], lambda z: FRONT, 0.008, nz=14, nu=18)
patch(cop, 0.05, 0.5, lambda z: (math.pi - 0.62, math.pi + 0.62), 0.008, nz=12, nu=14)
# Copper belly bowl underneath.
bowl = [(r + 0.006, z) for r, z in BODY_PROFILE if z <= 0.05]
cop.lathe(bowl + [(body_r(0.05) + 0.006, 0.05)], scale=(1, BODY_SY, 1), seg=56)
cop.lathe([(body_r(0.545) + 0.004, 0.545)] + [(r + 0.005, z) for r, z in BODY_PROFILE if z > 0.55], scale=(1, BODY_SY, 1),
          seg=48)
# Brass trim: waist band, shoulder collar and neck ring.
for z0, z1, push in ((0.03, 0.075, 0.014), (0.5, 0.56, 0.014)):
    prof = [(body_r(z0) + push - 0.012, z0)]
    for k in range(5):
        z = z0 + (z1 - z0) * k / 4
        prof.append((body_r(z) + push, z))
    prof.append((body_r(z1) + push - 0.012, z1))
    brs.lathe(prof, scale=(1, BODY_SY, 1), seg=48, caps=False)
brs.torus((0, 0, 0.64), 0.262, 0.03, scale=(1, BODY_SY + 0.02, 1), seg=40, mseg=8)
# Vertical straps at the plate edges, and on the sides.
for az in (FRONT[0], FRONT[1], math.pi - 0.62, math.pi + 0.62, -1.75, 1.75):
    patch(brs, 0.06, 0.5, strap_range(az, 0.042), 0.017, depth=0.02, nz=12, nu=2)
    z = 0.1
    while z < 0.48:
        p, n = body_pt(az, z, 0.019)
        rivet(riv, p, n, 0.0095)
        z += 0.065
# Rivet rows along the trim bands.
for z, push, count in ((0.052, 0.016, 28), (0.53, 0.016, 26)):
    for k in range(count):
        az = 2 * math.pi * (k + 0.5) / count
        p, n = body_pt(az, z, push)
        rivet(riv, p, n, 0.0095)
# Rivets along the top and bottom of the front plate.
for z in (0.075, 0.475):
    for k in range(9):
        az = FRONT[0] + 0.1 + (FRONT[1] - FRONT[0] - 0.2) * k / 8
        p, n = body_pt(az, z, 0.01)
        rivet(riv, p, n, 0.009)

# ---- Chest: the big pressure gauge, a small gauge and a round vent grille ----
dk = Kit()   # dark bits (ticks, slots)
dl = Kit()   # dial faces
gl = Kit()   # gauge glass


def gauge(az, z, rad, needle_angle, ticks=12):
    p, n = body_pt(az, z, 0.0)
    F = frame(n)
    out = lambda d: p + n * d  # noqa: E731
    brs.cyl(out(0.012), rad * 1.05, 0.07, F, seg=24)  # body of the gauge, sunk into the chest
    brs.torus(out(0.05), rad * 0.98, rad * 0.13, F, seg=28, mseg=6)
    dl.cyl(out(0.05), rad * 0.9, 0.006, F, seg=32)
    for k in range(ticks):
        a = 2 * math.pi * k / ticks
        big = k % 3 == 0
        L = rad * (0.2 if big else 0.12)
        d = rad * 0.86 - L / 2
        loc = out(0.054) + F @ Vector((d * math.cos(a), d * math.sin(a), 0))
        dk.box(loc, (L, rad * (0.06 if big else 0.035), 0.003), F @ Euler((0, 0, a)).to_matrix())
    dk.torus(out(0.0535), rad * 0.6, rad * 0.018, F, seg=32, mseg=4, arc=4.4, start=math.pi * 1.5 + math.pi)
    na = needle_angle
    loc = out(0.058) + F @ Vector((rad * 0.3 * math.cos(na), rad * 0.3 * math.sin(na), 0))
    needle = Kit()
    needle.box(loc, (rad * 0.78, rad * 0.06, 0.004), F @ Euler((0, 0, na)).to_matrix())
    needle.build(f"Needle{az:.2f}", needle_m, body)
    brs.cyl(out(0.06), rad * 0.09, 0.012, F, seg=12)
    gl.sphere(out(0.05), rad * 0.9, F, (1, 1, 0.22), seg=24, rings=8)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        rivet(riv, out(0.05) + F @ Vector((rad * 1.12 * math.cos(a), rad * 1.12 * math.sin(a), -0.012)), n,
              0.0085)


gauge(0.06, 0.33, 0.125, 2.2)
gauge(0.6, 0.31, 0.06, 0.6, ticks=8)
# Vent grille.
p, n = body_pt(0.04, 0.14, 0.0)
F = frame(n)
brs.cyl(p + n * 0.01, 0.112, 0.05, F, seg=32)
brs.torus(p + n * 0.035, 0.103, 0.017, F, seg=28, mseg=6)
dk.cyl(p + n * 0.034, 0.088, 0.006, F, seg=32)
for k in range(-3, 4):
    y = k * 0.022
    w = 2 * math.sqrt(max(0.088 ** 2 - y ** 2, 0)) - 0.01
    brs.cyl(p + n * 0.04 + F @ Vector((0, y, 0)), 0.008, w, F @ Euler((0, math.pi / 2, 0)).to_matrix(), seg=8)
brs.cyl(p + n * 0.045, 0.03, 0.02, F, seg=16)
for k in range(8):
    a = 2 * math.pi * (k + 0.5) / 8
    rivet(riv, p + n * 0.035 + F @ Vector((0.126 * math.cos(a), 0.126 * math.sin(a), 0)), n, 0.0085)

# ---- Leather pouch on a strap, on his right side ----
lth = Kit()
patch(lth, 0.235, 0.29, lambda z: (-1.72, -0.7), 0.012, depth=0.016, nz=2, nu=14)
p, n = body_pt(-1.12, 0.2, 0.05)
F = frame(n)
lth.box(p, (0.17, 0.15, 0.08), F, bevel=0.022)
lth.box(p + F @ Vector((0, 0.035, 0.045)), (0.175, 0.09, 0.018), F, bevel=0.008)
lth.box(p + F @ Vector((0, -0.005, 0.048)), (0.16, 0.06, 0.012), F @ Euler((0.5, 0, 0)).to_matrix(), bevel=0.005)
for sx in (-0.045, 0.045):
    lth.box(p + F @ Vector((sx, 0.0, 0.05)), (0.022, 0.15, 0.01), F, bevel=0.003)
    brs.box(p + F @ Vector((sx, -0.018, 0.058)), (0.032, 0.026, 0.008), F, bevel=0.003)
    dk.box(p + F @ Vector((sx, -0.018, 0.0625)), (0.016, 0.012, 0.004), F)

# ---- Wind-up key on his back ----
KEY_AZ = math.pi + 0.5
key = b.pivot("Key", body_pt(KEY_AZ, 0.45, 0.0)[0], parent=body, rotation=(0, 0, KEY_AZ - math.pi))
kk = Kit()
kk.cyl((0, 0.03, 0), 0.07, 0.03, (math.pi / 2, 0, 0), seg=24)
kk.torus((0, 0.045, 0), 0.06, 0.012, (math.pi / 2, 0, 0), seg=24, mseg=6)
kk.cyl((0, 0.13, 0), 0.028, 0.18, (math.pi / 2, 0, 0), seg=16)
kk.cyl((0, 0.21, 0), 0.045, 0.03, (math.pi / 2, 0, 0), seg=16)
kk.box((0, 0.28, 0), (0.035, 0.11, 0.1), None, bevel=0.012, segs=2)
for sz in (-1, 1):
    kk.torus((0, 0.33, sz * 0.12), 0.088, 0.034, (0, math.pi / 2, 0), scale=(1, 1, 0.55), seg=28, mseg=8)
    kk.cyl((0, 0.33, sz * 0.12), 0.088, 0.03, (0, math.pi / 2, 0), seg=24)
key_holes = Kit()
for sz in (-1, 1):
    key_holes.cyl((0, 0.33, sz * 0.12), 0.05, 0.04, (0, math.pi / 2, 0), seg=20)
kk.build("KeyBrass", brass, key)
key_holes.build("KeyHoles", hole, key)

# ---- Head: brass helmet, glass dome full of gears, lens eyes, ear bolts, chimney ----
head = b.pivot("Head", (0, 0, 0.655), parent=body)
HEAD_SY = 0.88
HEAD_CTRL = [(0.0, -0.01), (0.2, -0.005), (0.29, 0.02), (0.35, 0.07), (0.378, 0.14), (0.388, 0.22),
             (0.385, 0.3), (0.374, 0.37), (0.36, 0.41), (0.0, 0.415)]
HEAD_PROFILE = smooth_profile(HEAD_CTRL, 3)


def head_r(z):
    for (r0, z0), (r1, z1) in zip(HEAD_PROFILE, HEAD_PROFILE[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-6)
    return 0.0


def head_pt(az, z, push=0.0):
    r = head_r(z)
    dr = (head_r(z + 0.004) - head_r(z - 0.004)) / 0.008
    n = Vector((math.sin(az), -math.cos(az) / HEAD_SY, -dr)).normalized()
    return Vector((r * math.sin(az), -HEAD_SY * r * math.cos(az), z)) + n * push, n


b.cylinder("Neck", 0.17, 0.12, (0, 0, -0.01), mat=steel, parent=head, segments=32)
b.from_points("Helmet", HEAD_PROFILE, mat=brass, parent=head, segments=48, scale=(1, HEAD_SY, 1))
hb = Kit()   # helmet brass details
hc = Kit()   # helmet copper details
for z, minor in ((0.03, 0.026), (0.385, 0.024)):
    r = head_r(z)
    hb.torus((0, 0, z), r + 0.004, minor, scale=(1, HEAD_SY + 0.01, 1), seg=48, mseg=8)
# A copper band around the brow line, under the eyes' rims.
prof = [(head_r(0.31) - 0.004, 0.31), (head_r(0.315) + 0.008, 0.315), (head_r(0.355) + 0.008, 0.355),
        (head_r(0.36) - 0.004, 0.36)]
hc.lathe(prof, scale=(1, HEAD_SY, 1), seg=48, caps=False)
for z, count in ((0.07, 20), (0.335, 20)):
    for k in range(count):
        az = 2 * math.pi * (k + 0.5) / count
        p, n = head_pt(az, z, 0.003 if z < 0.2 else 0.01)
        rivet(hb, p, n, 0.0095)
# A riveted seam strip up the back of the helmet.
for k in range(5):
    p, n = head_pt(math.pi, 0.1 + k * 0.05, 0.002)
    rivet(hb, p, n, 0.01)

# Eyes: brass rims around big glowing amber lenses.
EYE_Z, EYE_R = 0.205, 0.122
for side in (-1, 1):
    az = side * 0.47
    p, n = head_pt(az, EYE_Z, 0.0)
    n = (n + Vector((0, -0.6, 0))).normalized()
    F = frame(n)
    rim = [(EYE_R + 0.01, -0.06), (EYE_R + 0.014, 0.03), (EYE_R + 0.006, 0.058), (EYE_R - 0.016, 0.062),
           (EYE_R - 0.024, 0.045), (EYE_R - 0.026, 0.0)]
    hb.lathe(rim, p, F, seg=32, caps=False)
    hc.torus(p + n * 0.03, EYE_R + 0.012, 0.014, F, seg=32, mseg=6)
    sock = Kit()
    sock.cyl(p + n * 0.0, EYE_R - 0.02, 0.04, F, seg=32)
    sock.build(f"EyeSocket{side}", hole, head)
    lens_k = Kit()
    lens_k.sphere(p + n * 0.012, EYE_R - 0.024, F, (1, 1, 0.55), seg=24, rings=10)
    lens_k.build(f"Lens{side}", lens, head)
    for k in range(8):
        a = 2 * math.pi * (k + 0.25) / 8
        rivet(hb, p + n * 0.06 + F @ Vector(((EYE_R - 0.005) * math.cos(a), (EYE_R - 0.005) * math.sin(a), 0)),
              n, 0.0075, seg=6, rings=3)
    # A little brass brow plate above each eye.
    pb, nb = head_pt(side * 0.47, EYE_Z + EYE_R + 0.03, 0.004)
    hb.box(pb, (0.13, 0.03, 0.012), frame(nb), bevel=0.005)

# Smile: a dark slot below the eyes, with a brass lip.
mouth = Kit()
mouth_lip = Kit()
for k in range(1):
    p, n = head_pt(0.0, 0.06, 0.0)
    F = frame(n)
    pts = []
    lip = []
    for i in range(11):
        t = -1 + 2 * i / 10
        az = t * 0.2
        el = 0.075 - (1 - t * t) * 0.03
        q, qn = head_pt(az, el, 0.002)
        pts.append(q)
        lip.append(head_pt(az, el, 0.0)[0])
    mouth.tube(pts, 0.016, around=10)
    mouth_lip.tube(lip, 0.024, around=10)
mouth.build("Mouth", mouth_m, head)
mouth_lip.build("MouthLip", copper_plain, head)

# Ear bolts.
for side in (-1, 1):
    p, n = head_pt(side * math.pi / 2, 0.21, 0.0)
    F = frame(n)
    hc.cyl(p + n * 0.01, 0.1, 0.06, F, seg=24)
    hb.torus(p + n * 0.04, 0.095, 0.013, F, seg=24, mseg=6)
    hb.cyl(p + n * 0.055, 0.072, 0.05, F, seg=20)
    hc.cyl(p + n * 0.085, 0.05, 0.03, F, seg=24)
    hb.cyl(p + n * 0.1, 0.034, 0.03, F, seg=6)
    for k in range(6):
        a = 2 * math.pi * k / 6
        rivet(hb, p + n * 0.04 + F @ Vector((0.088 * math.cos(a), 0.088 * math.sin(a), 0)), n, 0.008)

# Glass dome with clockwork inside.
DOME_Z, DOME_R = 0.41, 0.285
hb.torus((0, 0, DOME_Z + 0.008), DOME_R + 0.008, 0.022, seg=48, mseg=7)
hc.cyl((0, 0, DOME_Z - 0.005), DOME_R, 0.03, seg=48)
for k in range(16):
    a = 2 * math.pi * (k + 0.5) / 16
    rivet(hb, (math.cos(a) * (DOME_R + 0.008), math.sin(a) * (DOME_R + 0.008), DOME_Z + 0.03), (0, 0, 1), 0.008,
          seg=6, rings=3)
dome = Kit()
dome.lathe([(DOME_R * math.cos(t), DOME_Z + DOME_R * 0.9 * math.sin(t))
            for t in (math.pi / 2 * i / 12 for i in range(13))][:-1] + [(0.0, DOME_Z + DOME_R * 0.9)], seg=48)
dome.build("GlassDome", glass, head)
gb = Kit()
gc = Kit()
gb.gear((-0.07, 0.03, DOME_Z + 0.135), (math.pi / 2, 0, 0.0), 0.12, 12, 0.02)
gc.gear((0.1, -0.01, DOME_Z + 0.1), (math.pi / 2, 0, 0.12), 0.08, 10, 0.02)
gb.gear((0.075, -0.045, DOME_Z + 0.19), (math.pi / 2, 0, 0.3), 0.055, 9, 0.016)
gc.gear((-0.12, -0.08, DOME_Z + 0.06), (math.pi / 2 - 0.1, 0, 0.2), 0.05, 8, 0.016, spokes=0)
gb.gear((0.0, 0.1, DOME_Z + 0.04), (0, 0, 0.1), 0.15, 12, 0.022)
gb.gear((0.15, 0.08, DOME_Z + 0.1), (math.pi / 2, 0, 1.2), 0.065, 9, 0.016)
gc.cyl((-0.07, 0.03, DOME_Z + 0.07), 0.012, 0.13, seg=8)
gc.cyl((0.1, 0.03, DOME_Z + 0.05), 0.01, 0.1, seg=8)
gb.cyl((0.0, 0.0, DOME_Z + 0.02), 0.06, 0.04, seg=24)
gb.build("DomeGearsBrass", brass, head)
gc.build("DomeGearsDark", brass_dark, head)

# Chimney on the back of his head, on his left.
CH = Vector((0.24, 0.255, 0.0))
ch = Kit()
chb = Kit()
ch.cyl(CH + Vector((0, 0, 0.5)), 0.048, 0.5, seg=24)
chb.cyl(CH + Vector((0, 0, 0.26)), 0.07, 0.05, seg=24)
for z in (0.42, 0.6):
    chb.torus(CH + Vector((0, 0, z)), 0.05, 0.012, seg=24, mseg=6)
chb.lathe([(0.04, 0.72), (0.062, 0.73), (0.075, 0.78), (0.072, 0.8), (0.05, 0.8), (0.045, 0.76)],
          CH, seg=24, caps=False)
dk.cyl(CH + Vector((0, 0, 0.79)), 0.046, 0.01, seg=20)
# A bracket from the helmet to the pipe.
chb.box(CH + Vector((-0.04, -0.03, 0.33)), (0.09, 0.05, 0.035), Euler((0, 0, 0.8)).to_matrix(), bevel=0.008)
ch.build("Chimney", copper, head)
chb.build("ChimneyBrass", brass, head)
# Steam puffs drifting up and back.
st = Kit()
for (dx, dy, dz, r) in ((0.0, 0.01, 0.85, 0.045), (0.025, 0.03, 0.91, 0.06), (-0.02, 0.07, 0.97, 0.075),
                        (0.04, 0.12, 1.03, 0.07), (0.0, 0.17, 1.1, 0.095), (-0.05, 0.13, 1.06, 0.06),
                        (0.05, 0.22, 1.16, 0.07)):
    st.sphere(CH + Vector((dx, dy, dz)), r, None, (1, 1, 0.8), seg=10, rings=6)
steam_obj = st.build("Steam", steam, head)
b.displace(steam_obj, strength=0.02, size=0.04)

hb.build("HelmetBrass", brass, head)
hc.build("HelmetCopper", copper_plain, head)


# ---- Arms: brass ball joints, steel rods, copper bracers, brass claws ----
def arm(side, name):
    piv = b.pivot(f"Arm{name}", body_pt(side * math.pi / 2, 0.42, -0.02)[0], parent=body)
    a_b, a_c, a_s = Kit(), Kit(), Kit()
    a_b.sphere((0, 0, 0), 0.088, seg=16, rings=8)
    a_b.torus((0, 0, 0), 0.084, 0.024, (0, math.pi / 2, 0), seg=24, mseg=8)
    a_s.cyl((0, 0, -0.12), 0.026, 0.18, seg=12)
    a_c.lathe([(0.0, -0.07), (0.058, -0.07), (0.066, -0.09), (0.066, -0.17), (0.058, -0.19), (0.0, -0.19)], seg=20)
    for z in (-0.075, -0.175):
        a_b.torus((0, 0, z), 0.067, 0.011, seg=20, mseg=6)
    elbow = b.pivot(f"Elbow{name}", (0, 0, -0.24), parent=piv)
    a_b.build(f"ShoulderBrass{name}", brass, piv)
    a_c.build(f"UpperArm{name}", copper, piv)
    a_s.build(f"UpperRod{name}", steel, piv)
    e_b, e_c, e_s = Kit(), Kit(), Kit()
    e_b.sphere((0, 0, 0), 0.064, seg=16, rings=8)
    for sx in (-1, 1):
        e_b.cyl((sx * 0.05, 0, 0), 0.03, 0.02, (0, math.pi / 2, 0), seg=6)
    e_s.cyl((0, 0, -0.06), 0.024, 0.08, seg=12)
    bracer = [(0.0, -0.06), (0.058, -0.06), (0.068, -0.08), (0.088, -0.2), (0.09, -0.225), (0.0, -0.225)]
    e_c.lathe(bracer, seg=24)
    for z, rr in ((-0.075, 0.07), (-0.21, 0.092)):
        e_b.torus((0, 0, z), rr, 0.012, seg=24, mseg=6)
    for k in range(6):
        a = 2 * math.pi * k / 6
        rr = 0.081
        rivet(e_b, (rr * math.cos(a), rr * math.sin(a), -0.15), (math.cos(a), math.sin(a), -0.1), 0.008)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.25), parent=elbow)
    e_b.build(f"ElbowBrass{name}", brass, elbow)
    e_c.build(f"Bracer{name}", copper, elbow)
    e_s.build(f"ForeRod{name}", steel, elbow)
    return piv, elbow, hand


arm_r, elbow_r, hand_r = arm(-1, "R")
arm_l, elbow_l, hand_l = arm(1, "L")

# Pose: sword arm raised out to the side, other arm hanging a little away from the body.
aim(arm_r, (-0.86, -0.2, -0.32))
aim(elbow_r, (-0.25, -0.35, 0.9))
aim(hand_r, (-0.15, -0.95, 0.15))
aim(arm_l, (0.45, 0.05, -0.9))
aim(elbow_l, (0.35, -0.3, -0.88))
aim(hand_l, (0.3, -0.35, -0.88))


def claw_open(hand, name):
    k = Kit()
    k.cyl((0, 0, -0.005), 0.06, 0.03, seg=16)
    k.box((0, 0, -0.055), (0.12, 0.09, 0.075), bevel=0.018, segs=2)
    for i, (x, y, spread) in enumerate(((-0.036, -0.03, -0.25), (0.036, -0.03, 0.25), (0.0, 0.036, 0.0))):
        thumb = i == 2
        base = Vector((x, y, -0.095))
        d1 = Vector((spread, -0.35 if not thumb else 0.6, -1)).normalized()
        j1 = base + d1 * 0.075
        d2 = Vector((spread * 0.5, 0.6 if not thumb else -0.9, -0.8)).normalized()
        tip = j1 + d2 * 0.07
        k.sphere(base, 0.024, seg=10, rings=5)
        k.box((base + j1) / 2, (0.036, 0.032, 0.085), frame(d1), bevel=0.01)
        k.sphere(j1, 0.021, seg=10, rings=5)
        k.cyl((j1 + tip) / 2, 0.019, 0.075, frame(d2), seg=8, r2=0.005)
    k.build(f"Claw{name}", brass, hand)


claw_open(hand_l, "L")

# Sword hand: a fist of brass claw fingers wrapped around the grip.
bpy.context.view_layer.update()
BLADE_DIR = Vector((-0.12, -0.08, 1.0)).normalized()
GRIP_LOCAL = Vector((0, -0.01, -0.095))
hand_rot = hand_r.matrix_world.to_3x3().normalized()
blade_local = hand_rot.inverted() @ BLADE_DIR
sword_rot = frame(blade_local, hand_rot.inverted() @ Vector((0, -1, 0)))
sword = b.pivot("Sword", GRIP_LOCAL, parent=hand_r)
sword.rotation_euler = sword_rot.to_euler()
fist = Kit()
fist.cyl((0, 0, -0.005), 0.06, 0.03, seg=16)
fist.box((0, 0, -0.045), (0.12, 0.09, 0.06), bevel=0.018, segs=2)
S = mtx(GRIP_LOCAL, sword_rot)
S3 = sword_rot
for zz in (-0.032, 0.0, 0.032):
    fist.torus(S @ Vector((0, 0, zz)), 0.042, 0.017, S3, seg=12, mseg=6, arc=4.2, start=0.0)
    fist.sphere(S @ Vector((0.042 * math.cos(2.1), 0.042 * math.sin(2.1), zz)), 0.019, seg=8, rings=4)
fist.build("FistR", brass, hand_r)

sw_b, sw_s, sw_l = Kit(), Kit(), Kit()
sw_l.cyl((0, 0, 0), 0.023, 0.13, seg=12)
for z in (-0.04, 0.0, 0.04):
    sw_l.torus((0, 0, z), 0.024, 0.006, seg=12, mseg=4)
sw_b.sphere((0, 0, -0.085), 0.032, seg=14, rings=7)
sw_b.cyl((0, 0, -0.068), 0.026, 0.015, seg=12)
sw_b.box((0, 0, 0.078), (0.24, 0.05, 0.04), bevel=0.012, segs=2)
for sx in (-1, 1):
    sw_b.sphere((sx * 0.125, 0, 0.092), 0.028, seg=12, rings=6)
sw_b.box((0, 0, 0.1), (0.07, 0.05, 0.03), bevel=0.01)
BLADE = smooth_profile([(0.06, 0.1), (0.074, 0.13), (0.078, 0.36), (0.074, 0.52), (0.055, 0.62), (0.018, 0.69),
                        (0.002, 0.7)], 3)
sw_s.lathe(BLADE, scale=(1, 0.17, 1), seg=20)
sw_d = Kit()
sw_d.box((0, 0, 0.33), (0.014, 0.034, 0.36), bevel=0.005)
sw_d.build("BladeFuller", metal("Fuller", "#8f9297", roughness=(0.25, 0.4)), sword)
sw_b.build("SwordBrass", brass, sword)
sw_s.build("Blade", blade_m, sword)
sw_l.build("Grip", leather, sword)


# ---- Legs: hip ball, spring and piston; big copper boots with treads ----
SPLAY = 0.15


def leg(side, name):
    piv = b.pivot(f"Leg{name}", (side * 0.2, 0, HIP), parent=root, rotation=(0, side * -SPLAY, 0))
    lb, ls, lsp = Kit(), Kit(), Kit()
    lb.sphere((0, 0, 0), 0.075, seg=20, rings=10)
    lb.cyl((0, 0, -0.065), 0.075, 0.035, seg=24)
    lb.cyl((0, 0, -0.2), 0.022, 0.24, seg=12)
    ls.cyl((0, 0, -0.24), 0.036, 0.1, seg=16)
    lb.cyl((0, 0, -0.28), 0.08, 0.03, seg=24)
    pts = []
    turns, z0, z1, rad = 5.5, -0.085, -0.265, 0.062
    for i in range(int(turns * 14) + 1):
        t = i / 14
        a = 2 * math.pi * t
        pts.append((rad * math.cos(a), rad * math.sin(a), z0 + (z1 - z0) * t / turns))
    lsp.tube(pts, 0.012, around=6)
    lb.build(f"LegBrass{name}", brass, piv)
    ls.build(f"LegSleeve{name}", steel, piv)
    lsp.build(f"Spring{name}", spring_m, piv)
    foot = b.pivot(f"Foot{name}", (0, 0, -0.3), parent=piv, rotation=(0, side * SPLAY, 0))
    # Boot (foot-local z = world z - 0.3 when standing).
    fp, fc, fb, fi = Kit(), Kit(), Kit(), Kit()
    fp.lathe(smooth_profile([(0.0, -0.17), (0.12, -0.17), (0.13, -0.12), (0.125, -0.04), (0.12, 0.0),
                             (0.0, 0.0)], 3), seg=28)
    fb.torus((0, 0, -0.01), 0.122, 0.016, seg=28, mseg=8)
    fb.torus((0, 0, -0.1), 0.13, 0.016, seg=28, mseg=8)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        rivet(fb, (0.13 * math.cos(a), 0.13 * math.sin(a), -0.055), (math.cos(a), math.sin(a), 0), 0.009)
    for sx in (-1, 1):
        fb.cyl((sx * 0.13, 0, -0.06), 0.04, 0.02, (0, math.pi / 2, 0), seg=16)
        fc.cyl((sx * 0.14, 0, -0.06), 0.022, 0.02, (0, math.pi / 2, 0), seg=6)
    # The shoe: a big rounded copper toe over a dark treaded sole.
    fc.sphere((0, -0.07, -0.205), 0.17, None, (1.0, 1.55, 0.78), seg=32, rings=16)
    fb.torus((0, -0.065, -0.225), 0.168, 0.016, scale=(1, 1.52, 1), seg=40, mseg=8)
    fb.torus((0, -0.11, -0.205), 0.16, 0.016, (math.pi / 2, 0, 0), scale=(1, 0.8, 1), seg=20, mseg=6,
             arc=math.pi * 0.9, start=math.pi / 2)
    for k in range(14):
        a = 2 * math.pi * (k + 0.5) / 14
        nrm = Vector((math.cos(a), math.sin(a) / 1.52, 0)).normalized()
        rivet(fb, (0.185 * math.cos(a), -0.065 + 0.185 * 1.52 * math.sin(a), -0.225), nrm, 0.009)
    fi.lathe(smooth_profile([(0.0, -0.3), (0.16, -0.3), (0.172, -0.29), (0.178, -0.265), (0.17, -0.24),
                             (0.0, -0.24)], 2), (0, -0.065, 0), scale=(1, 1.5, 1), seg=36)
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        nrm = Vector((math.cos(a), math.sin(a) / 1.5, 0)).normalized()
        loc = (0.17 * math.cos(a), -0.065 + 0.17 * 1.5 * math.sin(a), -0.278)
        fi.box(loc, (0.05, 0.045, 0.045), frame(nrm), bevel=0.01)
    for k in range(-3, 4):
        fi.box((0, -0.065 + k * 0.065, -0.3), (0.26 - abs(k) * 0.02, 0.03, 0.02), bevel=0.006)
    fp.build(f"BootCuff{name}", patina, foot)
    fc.build(f"BootCopper{name}", copper, foot)
    fb.build(f"BootBrass{name}", brass, foot)
    fi.build(f"BootSole{name}", iron, foot)
    return piv, foot


leg(1, "L")
leg(-1, "R")

# Build the remaining body kits.
cop.build("BodyCopper", copper, body)
brs.build("BodyBrass", brass, body)
riv.build("BodyRivets", brass, body)
dk.build("DarkDetails", ink, body)
dl.build("Dials", dial, body)
gl.build("GaugeGlass", glass, body)
lth.build("Pouch", leather, body)


# ---- Workshop studio ----
def workshop():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Workshop")
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    bg = nodes["Background"]
    coord = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Generated"], sep.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position = 0.35
    els[0].color = b.rgba("#2a170c")
    els[1].position = 0.95
    els[1].color = b.rgba("#4a3020")
    e = els.new(0.5)
    e.color = b.rgba("#ffbe6e")
    e = els.new(0.62)
    e.color = b.rgba("#b8702e")
    links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.9
    scene.world = world

    # Backdrop: a big glowing dome of warm workshop haze around the stage.
    sky = b.mat("Backdrop", "#000000", flat=True)
    sn, sl = sky.node_tree.nodes, sky.node_tree.links
    em = sn.get("Emission")
    tc = sn.new("ShaderNodeTexCoord")
    nrm = sn.new("ShaderNodeVectorMath")
    nrm.operation = "NORMALIZE"
    sl.new(tc.outputs["Object"], nrm.inputs[0])
    dot = sn.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = Vector((0.25, 1.0, 0.12)).normalized()
    sl.new(nrm.outputs[0], dot.inputs[0])
    sr = sn.new("ShaderNodeValToRGB")
    se = sr.color_ramp.elements
    se[0].position = 0.0
    se[0].color = b.rgba("#2b170c")
    se[1].position = 1.0
    se[1].color = b.rgba("#ffd08a")
    x = se.new(0.7)
    x.color = b.rgba("#a8602a")
    x = se.new(0.88)
    x.color = b.rgba("#e89a4c")
    sl.new(dot.outputs["Value"], sr.inputs["Fac"])
    noise = sn.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.6
    sl.new(tc.outputs["Object"], noise.inputs["Vector"])
    mix = sn.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.35
    sl.new(sr.outputs["Color"], mix.inputs["A"])
    sl.new(noise.outputs["Color"], mix.inputs["B"])
    sl.new(mix.outputs["Result"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=14)
    for f in bm.faces:
        f.normal_flip()
    me = bpy.data.meshes.new("Backdrop")
    bm.to_mesh(me)
    bm.free()
    dome_o = bpy.data.objects.new("Backdrop", me)
    dome_o.data.materials.append(sky)
    dome_o.visible_shadow = False
    scene.collection.objects.link(dome_o)

    # Floor: warm wooden planks.
    fm = b.mat("Floor", "#6a3f22", roughness=0.62)
    fn, fl = fm.node_tree.nodes, fm.node_tree.links
    tc = fn.new("ShaderNodeTexCoord")
    brick = fn.new("ShaderNodeTexBrick")
    brick.inputs["Color1"].default_value = b.rgba("#5c3920")
    brick.inputs["Color2"].default_value = b.rgba("#4a2c18")
    brick.inputs["Mortar"].default_value = b.rgba("#2e1a0e")
    brick.inputs["Scale"].default_value = 1.2
    brick.inputs["Mortar Size"].default_value = 0.006
    brick.inputs["Brick Width"].default_value = 2.4
    brick.inputs["Row Height"].default_value = 0.3
    fl.new(tc.outputs["Object"], brick.inputs["Vector"])
    fl.new(brick.outputs["Color"], fn.get("Principled BSDF").inputs["Base Color"])
    floor = bpy.data.objects.new("Floor", bpy.data.meshes.new("Floor"))
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=64, radius=13.5)
    bm.to_mesh(floor.data)
    bm.free()
    floor.data.materials.append(fm)
    scene.collection.objects.link(floor)

    # Workshop props far behind him: hanging lanterns with soft glows and a big wall gear.
    glow = b.mat("LanternGlow", "#ff9a40", roughness=1.0, emission="#ff9a40", emission_strength=1.5)
    gn, gli = glow.node_tree.nodes, glow.node_tree.links
    lw = gn.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.2
    mr = gn.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = 0.3
    mr.inputs["To Max"].default_value = 0.0
    gli.new(lw.outputs["Facing"], mr.inputs[0])
    gli.new(mr.outputs[0], gn.get("Principled BSDF").inputs["Alpha"])
    glow.surface_render_method = "BLENDED"
    lamp = b.mat("LanternLight", "#ffd9a0", emission="#ffd090", emission_strength=12.0)
    wall_gear = b.mat("WallGear", "#b9814c", flat=True)
    props = Kit()
    glows = Kit()
    lamps = Kit()
    for x, y, z in ((5.6, 7.0, 2.5), (9.0, 5.5, 2.2), (-4.6, 6.0, 3.0)):
        lamps.sphere((x, y, z), 0.1, seg=12, rings=8)
        for k in range(4):
            a = math.pi / 2 * k + math.pi / 4
            props.cyl((x + 0.12 * math.cos(a), y + 0.12 * math.sin(a), z), 0.012, 0.32, seg=6)
        props.cyl((x, y, z + 1.5), 0.012, 2.6, seg=6)
        props.cyl((x, y, z + 0.17), 0.1, 0.06, seg=12)
        props.cyl((x, y, z - 0.17), 0.12, 0.05, seg=12)
    props.gear((8.6, 8.2, 2.3), (math.pi / 2, 0, -0.75), 1.8, 26, 0.2)
    props.gear((7.4, 9.2, 4.5), (math.pi / 2, 0, -0.75), 0.9, 16, 0.2)
    glows.bm.free()
    for name, kit, m in (("Props", props, wall_gear), ("Lamps", lamps, lamp)):
        mesh = bpy.data.meshes.new(name)
        kit.bm.to_mesh(mesh)
        kit.bm.free()
        o = bpy.data.objects.new(name, mesh)
        o.data.materials.append(m)
        o.visible_shadow = False
        scene.collection.objects.link(o)

    def light(name, energy, loc, target, size, color, kind="AREA"):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = b.rgba(color)[:3]
        if kind == "AREA":
            data.size = size
        else:
            data.shadow_soft_size = size
        o = bpy.data.objects.new(name, data)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(o)
        return o

    light("Key", 900, (-2.6, -3.0, 3.8), (0, 0, 1.0), 2.2, "#ffd49a")
    light("Fill", 220, (3.2, -2.8, 1.6), (0, 0, 0.9), 4.0, "#ffdcb8")
    light("RimCool", 650, (2.4, 3.2, 3.0), (0, 0, 1.1), 2.0, "#8fd2ff")
    light("RimWarm", 450, (-2.8, 2.8, 2.4), (0, 0, 1.0), 2.5, "#ffa860")
    light("Top", 250, (0, -0.5, 4.5), (0, 0, 1.0), 3.0, "#fff0d8")

    scene.render.engine = "BLENDER_EEVEE"
    ee = scene.eevee
    for attr, value in (("taa_render_samples", 64), ("use_shadows", True), ("use_raytracing", True),
                        ("use_gtao", True), ("gtao_distance", 0.25)):
        if hasattr(ee, attr):
            setattr(ee, attr, value)
    try:
        ee.shadow_pool_size = "1024"
        ee.ray_tracing_options.resolution_scale = "1"
    except Exception:
        pass
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Punchy", "Punchy"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = 0.0
    scene.render.film_transparent = False


workshop()
b.render_all(ID, height=2.0)
b.export(ID)
