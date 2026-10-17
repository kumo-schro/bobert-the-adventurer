"""Style 4: Forest Spirit. Bobert as a little mushroom-capped forest spirit in a soft, glowing,
painted-fantasy style: a small round body of pale birch bark with patches of moss, a big creamy
mushroom cap with glowing teal spots and fine gills, a round face with two big glowing green eyes
(no mouth), a cloak of overlapping leaves with a wooden clasp, a twisted vine belt, root feet,
twiggy hands, a branch sword with a big leaf blade and a woven twig lantern with a firefly inside.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/4_spirit.py
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector, noise

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "spirit"
b.reset()
R = b.rng(7)

BARK = b.texture(ID, "bark")
MOSS = b.texture(ID, "moss")
LEAF = b.texture(ID, "leaf")
CAPT = b.texture(ID, "cap")


# =====================================================================================
# Helpers (this style only)
# =====================================================================================

def catmull(ctrl, per=4):
    """Smooth curve through control points (Vectors), `per` samples per segment."""
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


def smooth_profile(ctrl, per=5):
    return [tuple(v) for v in catmull([Vector(c) for c in ctrl], per)]


def resample(pts, step):
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
    """Many small pieces merged into one mesh (twigs, vines, leaves), with UVs and a color attribute."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.col = self.bm.loops.layers.float_color.new("tint")

    def _face(self, verts, uvs, color):
        f = self.bm.faces.new(verts)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
            loop[self.col] = color
        return f

    def tube(self, ctrl, r0, r1, around=8, step=0.02, tip=0.8, color=(1, 1, 1, 1), knobs=0.0, seed=0,
             wobble=0.0, smooth=True):
        """A tube along control points, tapering r0 -> r1, rounded ends. knobs: knobbly radius noise."""
        pts = resample(catmull([Vector(c) for c in ctrl], 6) if smooth else [Vector(c) for c in ctrl], step)
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
            if knobs:
                rr *= 1.0 + knobs * noise.noise(Vector((lengths[i] * 18.0, seed * 3.1, 0.5)))
            ring = []
            for j in range(around):
                a = 2 * math.pi * j / around
                w = 1.0
                if wobble:
                    w += wobble * noise.noise(Vector((lengths[i] * 25, j * 0.9, seed)))
                ring.append(self.bm.verts.new(p + (nrm * math.cos(a) + bi * math.sin(a)) * rr * w))
            rings.append(ring)
        for i in range(n - 1):
            for j in range(around):
                j2 = (j + 1) % around
                self._face((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]),
                           ((lengths[i], j / around), (lengths[i], (j + 1) / around),
                            (lengths[i + 1], (j + 1) / around), (lengths[i + 1], j / around)), color)
        end = self.bm.verts.new(pts[-1] + tang[-1] * r1 * tip)
        start = self.bm.verts.new(pts[0] - tang[0] * r0 * 0.6)
        for j in range(around):
            j2 = (j + 1) % around
            self._face((rings[-1][j], rings[-1][j2], end), ((total, 0), (total, 0), (total, 0)), color)
            self._face((rings[0][j2], rings[0][j], start), ((0, 0), (0, 0), (0, 0)), color)
        return pts

    def leaf(self, base, ldir, wdir, ndir, length, width, cup=0.25, curl=0.0, side_curl=0.0, twist=0.0,
             teeth=0, nl=12, nw=3, color=(1, 1, 1, 1), stem=0.06, tip_shape=0.75, droop=0.0):
        """A leaf: a pointed blade along ldir, width along wdir, its top side facing ndir.
        cup: the halves fold up along the midrib. curl: the tip curls toward ndir (+) or away (-).
        UV: u = 0..1 base to tip, v = -1..1 across (the leaf material draws veins from these)."""
        base, ldir, wdir, ndir = Vector(base), Vector(ldir).normalized(), Vector(wdir).normalized(), Vector(ndir).normalized()
        grid = []
        for i in range(nl + 1):
            t = i / nl
            tt = max(0.0, (t - stem) / (1 - stem))
            w = 0.5 * width * math.sin(math.pi * tt ** tip_shape) ** 0.85 if t > stem else 0.012 * width
            if teeth and 0.05 < tt < 0.95:
                w *= 1.0 - 0.09 * ((tt * teeth) % 1.0)
            row = []
            ang = twist * t
            wd = wdir * math.cos(ang) + ndir * math.sin(ang)
            nd = ndir * math.cos(ang) - wdir * math.sin(ang)
            for j in range(-nw, nw + 1):
                s = j / nw
                x = s * w
                lift = cup * abs(x) + side_curl * x * x / max(width, 1e-3) * 4
                bend = curl * length * t * t - droop * length * math.sin(math.pi * t) * 0.25
                p = base + ldir * (t * length) + wd * x + nd * (lift + bend)
                row.append(self.bm.verts.new(p))
            grid.append((row, t))
        for i in range(nl):
            (r0, t0), (r1, t1) = grid[i], grid[i + 1]
            for j in range(2 * nw):
                s0, s1 = -1 + j / nw, -1 + (j + 1) / nw
                self._face((r0[j], r0[j + 1], r1[j + 1], r1[j]), ((t0, s0), (t0, s1), (t1, s1), (t1, s0)), color)

    def lumps(self, center, radius, scale=(1, 1, 1), rot=None, subdiv=2, amp=0.35, freq=3.0, seed=0,
              color=(1, 1, 1, 1), flat_bottom=False, uv=0):
        """A lumpy blob (moss clumps, knots): an icosphere (or a uv sphere with `uv` segments)
        pushed in and out by noise."""
        if uv:
            geom = bmesh.ops.create_uvsphere(self.bm, u_segments=uv, v_segments=max(4, uv // 2), radius=1.0)
        else:
            geom = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0)
        m = rot.to_matrix() if rot is not None else Matrix.Identity(3)
        off = Vector((seed * 1.7, seed * 2.3, seed * 0.9))
        for v in geom["verts"]:
            d = v.co.normalized()
            k = 1.0 + amp * noise.fractal(d * freq + off, 0.6, 2.0, 3)
            if flat_bottom and d.z < 0:
                k *= 1.0 + d.z * 0.7
            loc = Vector((d.x * scale[0], d.y * scale[1], d.z * scale[2])) * radius * k
            v.co = Vector(center) + m @ loc
        faces = {f for v in geom["verts"] for f in v.link_faces}
        for f in faces:
            for loop in f.loops:
                loop[self.col] = color
                co = loop.vert.co
                loop[self.uv].uv = (co.x * 4, co.y * 4)

    def build(self, name, material, parent=None, location=(0, 0, 0), rotation=(0, 0, 0)):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        obj = b._mesh_object(name, self.bm, location, rotation, material, parent, True)
        return obj


def lathe(name, profile, mats, split=None, location=(0, 0, 0), rotation=(0, 0, 0), parent=None, segments=48,
          scale=(1, 1, 1)):
    """Like b.from_points but open (no end caps) and with a second material from profile index `split` up."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segments) * scale[0],
                                    r * math.sin(2 * math.pi * i / segments) * scale[1], z * scale[2]))
                      for i in range(segments)])
    for k in range(len(rings) - 1):
        for i in range(segments):
            a, c = rings[k], rings[k + 1]
            f = bm.faces.new((a[i], a[(i + 1) % segments], c[(i + 1) % segments], c[i]))
            f.material_index = 1 if (split is not None and k >= split) else 0
    bm.faces.new(list(reversed(rings[0])))
    if profile[-1][0] > 1e-3:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = b._mesh_object(name, bm, location, rotation, mats[0], parent, True)
    for m in mats[1:]:
        obj.data.materials.append(m)
    return obj


def frame_from(normal, up_hint=(0, 0, 1)):
    """Rotation (Euler) that turns local +Z to `normal`."""
    return Vector(normal).normalized().to_track_quat("Z", "Y").to_euler()


def to_parent(pivot_loc, pivot_rot, p):
    return Vector(pivot_loc) + Euler(pivot_rot).to_matrix() @ Vector(p)


# =====================================================================================
# Materials
# =====================================================================================

def _img(nodes, links, path, scale, coord):
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(coord, mapping.inputs["Vector"])
    if path:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(path, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.4
        links.new(mapping.outputs[0], tex.inputs["Vector"])
        return tex.outputs["Color"]
    nz = nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6.0
    nz.inputs["Detail"].default_value = 6.0
    links.new(mapping.outputs[0], nz.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.72, 0.72, 0.72, 1)
    ramp.color_ramp.elements[1].position = 0.75
    links.new(nz.outputs["Fac"], ramp.inputs[0])
    return ramp.outputs["Color"]


def _mix(nodes, links, a, bcol, fac, blend="MIX"):
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = blend
    for sock, val in ((mix.inputs["Factor"], fac), (mix.inputs["A"], a), (mix.inputs["B"], bcol)):
        if isinstance(val, (int, float)):
            sock.default_value = val
        elif isinstance(val, tuple):
            sock.default_value = val
        else:
            links.new(val, sock)
    return mix.outputs["Result"]


def _math(nodes, links, op, a, c=None, clamp=False):
    m = nodes.new("ShaderNodeMath")
    m.operation = op
    m.use_clamp = clamp
    for sock, val in zip(m.inputs, (a, c)):
        if val is None:
            continue
        if isinstance(val, (int, float)):
            sock.default_value = val
        else:
            links.new(val, sock)
    return m.outputs[0]


def surface(name, color, img=None, scale=1.0, img_strength=1.0, roughness=0.7, bump=0.25, sss=0.0,
            sss_radius=(0.3, 0.2, 0.1), sheen=0.0, coat=0.0, emission=None, emission_strength=0.0,
            moss=0.0, moss_scale=3.0, moss_up=0.6, moss_color="#9cc24a", moss_img_scale=4.0, moss_noise=2.2,
            tint_attr=False, sheen_tint="#ffffff"):
    """A painted material: a box-projected texture tinted with `color`, with optional moss patches
    (a noise mask that prefers upward-facing surfaces) and a soft fuzz on the moss."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    m.diffuse_color = b.rgba(color)
    coord = nodes.new("ShaderNodeTexCoord")
    tex = _img(nodes, links, img, scale, coord.outputs["Object"])
    base = _mix(nodes, links, b.rgba(color), tex, img_strength, "MULTIPLY")
    if tint_attr:
        attr = nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "tint"
        base = _mix(nodes, links, base, attr.outputs["Color"], 1.0, "MULTIPLY")
    height = nodes.new("ShaderNodeRGBToBW")
    links.new(tex, height.inputs[0])
    h = height.outputs[0]
    rough = roughness
    if moss:
        geo = nodes.new("ShaderNodeNewGeometry")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        links.new(geo.outputs["Normal"], sep.inputs[0])
        nz = nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = moss_noise
        nz.inputs["Detail"].default_value = 8.0
        nz.inputs["Roughness"].default_value = 0.65
        links.new(coord.outputs["Object"], nz.inputs["Vector"])
        f = _math(nodes, links, "MULTIPLY_ADD", sep.outputs["Z"], moss_up)
        f.node.inputs[2].default_value = 0.0
        links.new(nz.outputs["Fac"], f.node.inputs[2])
        rng_ = nodes.new("ShaderNodeMapRange")
        rng_.inputs["From Min"].default_value = 1.0 - moss
        rng_.inputs["From Max"].default_value = 1.0 - moss + 0.07
        links.new(f, rng_.inputs["Value"])
        mask = rng_.outputs["Result"]
        mtex = _img(nodes, links, MOSS, moss_img_scale, coord.outputs["Object"])
        mcol = _mix(nodes, links, b.rgba(moss_color), mtex, 1.0, "MULTIPLY")
        base = _mix(nodes, links, base, mcol, mask)
        mh = nodes.new("ShaderNodeRGBToBW")
        links.new(mtex, mh.inputs[0])
        hm = _math(nodes, links, "MULTIPLY_ADD", mask, 0.8)
        links.new(mh.outputs[0], hm.node.inputs[2])
        h = _mix(nodes, links, h, hm, mask)
        bsdf.inputs["Sheen Weight"].default_value = 0.0
        sw = _math(nodes, links, "MULTIPLY", mask, 0.8)
        links.new(sw, bsdf.inputs["Sheen Weight"])
        bsdf.inputs["Sheen Tint"].default_value = b.rgba("#d8f08a")
        rr = _math(nodes, links, "MULTIPLY_ADD", mask, 0.95 - roughness)
        rr.node.inputs[2].default_value = roughness
        rough = rr
    links.new(base, bsdf.inputs["Base Color"])
    if isinstance(rough, float):
        bsdf.inputs["Roughness"].default_value = rough
    else:
        links.new(rough, bsdf.inputs["Roughness"])
    if bump:
        bmp = nodes.new("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = bump
        bmp.inputs["Distance"].default_value = 0.01
        links.new(h if not isinstance(h, float) else height.outputs[0], bmp.inputs["Height"])
        links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    if sss:
        bsdf.inputs["Subsurface Weight"].default_value = sss
        bsdf.inputs["Subsurface Radius"].default_value = sss_radius
        bsdf.inputs["Subsurface Scale"].default_value = 0.08
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Tint"].default_value = b.rgba(sheen_tint)
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = b.rgba(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return m


def leaf_material(name, color, vein_color, back=0.25, scale=2.0):
    """Leaves: painted texture plus veins drawn from the leaf's UVs (a midrib and side veins
    sweeping toward the tip), lighter toward the tip, a little translucent against the light."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    m.diffuse_color = b.rgba(color)
    coord = nodes.new("ShaderNodeTexCoord")
    tex = _img(nodes, links, LEAF, scale, coord.outputs["Object"])
    attr = nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "tint"
    base = _mix(nodes, links, b.rgba(color), tex, 0.55, "MULTIPLY")
    base = _mix(nodes, links, base, attr.outputs["Color"], 1.0, "MULTIPLY")
    uv = nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(uv.outputs["UV"], sep.inputs[0])
    u, v = sep.outputs["X"], sep.outputs["Y"]
    av = _math(nodes, links, "ABSOLUTE", v)
    # Midrib: a bright line at v = 0.
    mid = _math(nodes, links, "LESS_THAN", av, 0.07)
    # Side veins: lines along u - 0.45 * |v| (sweeping toward the tip), 8 of them.
    sw = _math(nodes, links, "MULTIPLY_ADD", av, -0.45)
    links.new(u, sw.node.inputs[2])
    sw8 = _math(nodes, links, "MULTIPLY", sw, 8.0)
    fr = _math(nodes, links, "FRACT", sw8)
    side = _math(nodes, links, "LESS_THAN", fr, 0.09)
    side = _math(nodes, links, "MULTIPLY", side, _math(nodes, links, "LESS_THAN", av, 0.85))
    vein = _math(nodes, links, "MAXIMUM", mid, _math(nodes, links, "MULTIPLY", side, 0.75))
    # Lighter toward the tip and edges (a painted gradient).
    grad = _math(nodes, links, "MULTIPLY", u, 0.22)
    base = _mix(nodes, links, base, b.rgba(vein_color), grad)
    base = _mix(nodes, links, base, b.rgba(vein_color), _math(nodes, links, "MULTIPLY", vein, 0.45))
    links.new(base, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Sheen Weight"].default_value = 0.25
    bsdf.inputs["Sheen Tint"].default_value = b.rgba("#e8ffb0")
    bmp = nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.35
    bmp.inputs["Distance"].default_value = 0.004
    links.new(_math(nodes, links, "MULTIPLY", vein, -1.0), bmp.inputs["Height"])
    links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    # Light shining through: mix in a translucent shader tinted with the leaf color.
    if back:
        out = nodes.get("Material Output")
        tr = nodes.new("ShaderNodeBsdfTranslucent")
        glow = _mix(nodes, links, base, (1.0, 0.95, 0.4, 1.0), 0.25)
        links.new(glow, tr.inputs["Color"])
        mixs = nodes.new("ShaderNodeMixShader")
        mixs.inputs[0].default_value = back
        links.new(bsdf.outputs[0], mixs.inputs[1])
        links.new(tr.outputs[0], mixs.inputs[2])
        links.new(mixs.outputs[0], out.inputs["Surface"])
    return m


def glow(name, color, strength, core=None, coat=1.0, roughness=0.15):
    """Emissive glowing material (eyes, cap spots, firefly)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = b.rgba(core or color)
    bsdf.inputs["Emission Color"].default_value = b.rgba(color)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.03
    m.diffuse_color = b.rgba(color)
    return m


bark = surface("Bark", "#f4ead6", BARK, scale=2.2, bump=0.35, roughness=0.75, moss=0.44, moss_noise=2.4,
               moss_up=0.3, moss_img_scale=3.0, sss=0.08, sss_radius=(0.4, 0.3, 0.2))
head_bark = surface("FaceBark", "#f3e6c8", BARK, scale=2.6, img_strength=0.55, bump=0.2, roughness=0.7,
                    moss=0.3, moss_noise=3.0, moss_up=-0.25, moss_img_scale=3.0, sss=0.12,
                    sss_radius=(0.4, 0.3, 0.2))
wood = surface("Wood", "#7a5233", BARK, scale=3.5, bump=0.5, roughness=0.8, img_strength=0.6)
wood_dark = surface("WoodDark", "#5b3a22", BARK, scale=4.0, bump=0.55, roughness=0.8, img_strength=0.6)
root_wood = surface("Roots", "#6e4a2c", BARK, scale=3.0, bump=0.5, roughness=0.85, img_strength=0.6,
                    moss=0.0)
moss_m = surface("Moss", "#cfe68a", MOSS, scale=3.0, bump=0.8, roughness=0.95, sheen=0.6, tint_attr=True,
                 sheen_tint="#d6f07a")
cap_top = surface("CapTop", "#fff8d2", CAPT, scale=1.4, img_strength=0.7, bump=0.15, roughness=0.55,
                  sss=0.3, sss_radius=(0.45, 0.45, 0.35), moss=0.3, moss_up=0.45, moss_noise=2.8,
                  moss_img_scale=2.6, moss_color="#90b840")
gills = surface("Gills", "#f2d6b3", CAPT, scale=3.0, img_strength=0.5, bump=0.1, roughness=0.6, sss=0.5,
                sss_radius=(0.9, 0.5, 0.25), emission="#ffcf8a", emission_strength=0.18)
gill_base = surface("GillShade", "#b88d68", CAPT, scale=3.0, img_strength=0.5, bump=0.1, roughness=0.7, sss=0.3,
                    sss_radius=(0.9, 0.5, 0.25))
vine = surface("Vine", "#5f7a2a", BARK, scale=4.0, img_strength=0.45, bump=0.4, roughness=0.6)
vine_brown = surface("VineBrown", "#7b5a34", BARK, scale=4.0, img_strength=0.5, bump=0.5, roughness=0.7)
clasp_m = surface("Clasp", "#9a6a3e", BARK, scale=5.0, img_strength=0.5, bump=0.6, roughness=0.55, coat=0.3)
leaf_m = leaf_material("Leaves", "#3f7f27", "#a8cf55")
blade_leaf_m = leaf_material("BladeLeaf", "#6aa63d", "#d4ea7c", back=0.3)
spot_m = glow("CapSpot", "#00ffa0", 2.0, core="#0a6a52", coat=0.0, roughness=0.5)
spot_core_m = glow("CapSpotCore", "#8affd0", 3.0, core="#c0fff0", coat=0.0, roughness=0.4)
spot_rim_m = glow("CapSpotRim", "#00d090", 1.1, core="#2a8a6a", coat=0.0, roughness=0.6)
eye_m = glow("Eye", "#14c860", 1.6, core="#06603a")
eye_core_m = glow("EyeCore", "#5dff9c", 3.0, core="#7dffb0", coat=0.0, roughness=0.5)
eye_hi_m = b.mat("EyeHighlight", "#ffffff", flat=True)
eye_rim_m = surface("EyeRim", "#3a3a1c", None, roughness=0.6, bump=0.0)
firefly_m = glow("Firefly", "#fff2a0", 30.0, core="#fff6c0")
wing_m = glow("FireflyWing", "#fff8d8", 3.0, core="#ffffff")


def lantern_glow_material():
    """A ball of warm glowing haze inside the lantern."""
    m = bpy.data.materials.new("LanternGlow")
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.remove(nodes.get("Principled BSDF"))
    vol = nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = b.rgba("#ffd66a")
    vol.inputs["Density"].default_value = 6.0
    vol.inputs["Emission Color"].default_value = b.rgba("#ffcc55")
    vol.inputs["Emission Strength"].default_value = 22.0
    links.new(vol.outputs[0], nodes.get("Material Output").inputs["Volume"])
    m.diffuse_color = b.rgba("#ffd66a")
    return m


lantern_glow = lantern_glow_material()
# A soft yellow "glass" ball for the glb (where volumes don't export) and to give the glow a body.
lantern_orb_m = glow("LanternOrb", "#ffc94a", 3.5, core="#ffe7a0")


def moss_color():
    k = R.uniform(0.82, 1.15)
    return (0.85 * k, k, 0.75 * k, 1.0)


# =====================================================================================
# Character
# =====================================================================================

root = b.pivot("Bobert")

# ---- Legs: stubby bark stumps on spreading root feet ----
HIP_Z = 0.34
for side, name in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{name}", (side * 0.105, 0.0, HIP_Z), parent=root, rotation=(0, side * -0.06, 0))
    b.from_points(f"Shin{name}", smooth_profile(
        [(0.001, 0.02), (0.075, 0.0), (0.088, -0.08), (0.094, -0.18), (0.1, -0.24), (0.08, -0.29), (0.001, -0.3)],
        per=4), mat=bark, parent=leg, segments=20)
    roots = Bundle()
    # A gnarled wooden "ankle" and root toes reaching out to the ground.
    roots.lumps((0, -0.01, -0.285), 0.095, scale=(1.0, 1.1, 0.55), subdiv=2, amp=0.25, freq=2.5, seed=side + 5)
    toes = [(-0.55, 0.17), (-0.2, 0.19), (0.2, 0.18), (0.6, 0.15), (2.6, 0.11)]
    for k, (az, ln) in enumerate(toes):
        az = az * side * -1 if k < 4 else az * side
        d = Vector((math.sin(az), -math.cos(az), 0))
        start = Vector((0, -0.01, -0.27)) + d * 0.03
        mid = Vector((0, -0.01, -0.315)) + d * (ln * 0.55)
        end = Vector((0, -0.01, -HIP_Z + 0.012)) + d * ln + Vector((0, 0, 0))
        tipp = end + d * 0.03 + Vector((0, 0, -0.004))
        roots.tube([start, mid, end, tipp], 0.034, 0.011, around=8, step=0.018, tip=0.9, knobs=0.18, seed=k + side)
    roots.build(f"RootFoot{name}", root_wood, leg)
    tuft = Bundle()
    for k in range(5):
        a = 2 * math.pi * k / 5 + R.uniform(-0.3, 0.3)
        p = Vector((0.088 * math.cos(a), 0.088 * math.sin(a) - 0.005, -0.235 + R.uniform(-0.015, 0.015)))
        tuft.lumps(p, R.uniform(0.032, 0.042), scale=(1.1, 1.1, 0.75), subdiv=2, amp=0.4, freq=3.5,
                   seed=k * 3 + side, color=moss_color())
    tuft.build(f"AnkleMoss{name}", moss_m, leg)

# ---- Body: a round birch-bark body ----
body = b.pivot("Body", (0, 0, HIP_Z), parent=root)
BODY_SY = 0.9
body_profile = smooth_profile([(0.001, -0.07), (0.11, -0.06), (0.185, 0.0), (0.215, 0.1), (0.215, 0.2),
                               (0.2, 0.32), (0.17, 0.44), (0.13, 0.54), (0.095, 0.61), (0.07, 0.66),
                               (0.001, 0.68)], per=4)
torso = b.from_points("Torso", body_profile, mat=bark, parent=body, segments=32, scale=(1, BODY_SY, 1))
b.displace(torso, strength=0.008, size=0.12)


def body_r(z):
    for (r0, z0), (r1, z1) in zip(body_profile, body_profile[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-6)
    return 0.0


# Moss patches growing on the bark (flattened clumps that hug the body).
bm_moss = Bundle()
for az, z, s in ((0.7, 0.04, 0.075), (-0.95, 0.38, 0.06), (2.5, 0.15, 0.07), (-2.3, 0.05, 0.07),
                 (3.1, 0.42, 0.06)):
    r = body_r(z)
    n = Vector((math.sin(az), -math.cos(az) * BODY_SY, 0.15)).normalized()
    p = Vector((math.sin(az) * r, -math.cos(az) * r * BODY_SY, z)) - n * s * 0.25
    bm_moss.lumps(p, s, scale=(1.4, 1.4, 0.3), rot=frame_from(n), subdiv=3, amp=0.3, freq=5.0,
                  seed=int(az * 10 + z * 100), color=moss_color())
bm_moss.build("BodyMoss", moss_m, body)

# ---- Twisted vine belt ----
BELT_Z = 0.235
belt = Bundle()
br = body_r(BELT_Z) + 0.006
for strand in range(2):
    pts = []
    for k in range(97):
        a = 2 * math.pi * k / 96
        tw = 2 * math.pi * 11 * k / 96 + strand * math.pi
        rr = br + 0.012 + 0.011 * math.cos(tw)
        pts.append(Vector((rr * math.sin(a), -rr * math.cos(a) * BODY_SY, BELT_Z + 0.012 * math.sin(tw))))
    belt.tube(pts, 0.0105, 0.0105, around=6, step=0.016, smooth=False, knobs=0.1, seed=strand)
belt.build("VineBelt", vine_brown, body)
# A loose vine curl with two little leaves at his front-left.
curl = Bundle()
az0 = 0.55
p0 = Vector((math.sin(az0) * (br + 0.02), -math.cos(az0) * (br + 0.02) * BODY_SY, BELT_Z))
curl.tube([p0, p0 + Vector((0.02, -0.03, -0.04)), p0 + Vector((0.0, -0.05, -0.08)),
           p0 + Vector((-0.025, -0.045, -0.07)), p0 + Vector((-0.02, -0.035, -0.05))],
          0.008, 0.004, around=6, step=0.008)
curl.build("BeltCurl", vine, body)
bl = Bundle()
for k, (dz, dx) in enumerate(((0.0, 1), (-0.02, -1))):
    base = p0 + Vector((0.0, -0.01, dz))
    bl.leaf(base, (dx * 0.6, -0.4, -0.7), (0.7, 0, dx * 0.5), (0, -1, 0.3), 0.07, 0.035, cup=0.3, nl=6, nw=2,
            color=(0.85, 1.0, 0.75, 1))
bl.build("BeltLeaves", leaf_m, body)

# ---- Leaf cloak: a ruff of overlapping leaves round the neck and a cape of big leaves behind ----
cloak = b.pivot("Cloak", (0, 0, 0.62), parent=body)  # at the neck, so the cape can sway
leaves = Bundle()


def cloak_leaf(az, ring_r, z, flare, length, width, curl=-0.15, twist=0.0, tint=None, droop=0.0):
    """One leaf hanging from the neck ring at azimuth az (0 = front), flaring out by `flare`
    (radians from straight down)."""
    out = Vector((math.sin(az), -math.cos(az), 0))
    tang = Vector((math.cos(az), math.sin(az), 0))
    ldir = (Vector((0, 0, -1)) * math.cos(flare) + out * math.sin(flare)).normalized()
    ndir = tang.cross(ldir).normalized()
    if ndir.dot(out) < 0:
        ndir = -ndir
    base = Vector((out.x * ring_r, out.y * ring_r * 0.92, z))
    g = R.uniform(0.85, 1.12)
    col = tint or (R.uniform(0.85, 1.05) * g, g, R.uniform(0.75, 1.0) * g, 1.0)
    leaves.leaf(base, ldir, tang, ndir, length, width, cup=0.22, curl=curl, twist=twist, teeth=9,
                nl=12, nw=3, color=col, droop=droop)


# Cape: big leaves on his back and sides, in three overlapping rows (lowest row first).
for row, (z, rr, flare, ln, wd, count, span) in enumerate((
        (-0.15, 0.25, 0.3, 0.42, 0.25, 8, 2.0),
        (-0.05, 0.22, 0.42, 0.42, 0.25, 9, 2.35),
        (0.03, 0.17, 0.62, 0.36, 0.23, 10, 2.55))):
    for i in range(count):
        t = i / (count - 1)
        az = math.pi + (t - 0.5) * 2 * span + R.uniform(-0.06, 0.06)
        f = flare + 0.25 * abs(t - 0.5) * 2 + R.uniform(-0.05, 0.05)
        cloak_leaf(az, rr, z, f, ln * R.uniform(0.92, 1.08), wd * R.uniform(0.9, 1.1), curl=-0.12,
                   twist=R.uniform(-0.25, 0.25))
# Ruff: two rings of leaves all around the neck, pointing out and down.
for row, (z, rr, flare, ln, wd, count) in enumerate(((-0.04, 0.12, 1.0, 0.25, 0.15, 11),
                                                     (-0.005, 0.095, 1.12, 0.21, 0.13, 10))):
    for i in range(count):
        az = 2 * math.pi * (i + 0.5 * row) / count + R.uniform(-0.08, 0.08)
        cloak_leaf(az, rr, z, flare + R.uniform(-0.08, 0.08), ln * R.uniform(0.9, 1.1), wd, curl=-0.2,
                   twist=R.uniform(-0.3, 0.3))
leaves.build("LeafCloak", leaf_m, cloak)
# The wooden clasp at the front of the collar.
clasp = b.pivot("Clasp", (0, -0.175, -0.035), parent=cloak, rotation=(math.radians(-55), 0, 0))
b.cylinder("ClaspDisc", 0.042, 0.018, (0, 0, 0), (math.pi / 2, 0, 0), mat=clasp_m, parent=clasp, segments=28,
           bevel=0.006)
b.torus("ClaspRing", 0.03, 0.005, (0, -0.011, 0), (math.pi / 2, 0, 0), mat=wood_dark, parent=clasp,
        segments=24, minor_segments=6)
b.ball("ClaspKnob", 0.013, (0, -0.012, 0), scale=(1, 0.6, 1), mat=wood_dark, parent=clasp, segments=12, rings=8)

# ---- Arms: short bark arms with twiggy wooden hands ----
SHOULDER_Z = 0.5


def twig_hand(hand, side, grip=None, open_=0.0):
    """A small wooden palm with four knobbly twig fingers and a thumb. grip: (center, axis) of a
    handle (in hand space) for the fingers to curl around."""
    tw = Bundle()
    tw.lumps((0, 0, -0.01), 0.045, scale=(0.85, 0.75, 1.0), subdiv=2, amp=0.18, freq=2.0, seed=side + 11)
    if grip:
        c, ax = Vector(grip[0]), Vector(grip[1]).normalized()
        ref = Vector((side * -1.0, 0, 0))
        u = (ref - ax * ref.dot(ax)).normalized()  # from handle toward the palm (toward the arm)
        u = -u
        w = ax.cross(u)
        rad = 0.036
        for k in range(4):
            h = (k - 1.5) * 0.024
            pts = []
            for s in range(7):
                a = math.radians(-20 + 250 * s / 6)
                pts.append(c + ax * h + (u * math.cos(a) + w * math.sin(a) * side) * rad * (1 - 0.05 * s))
            pts[0] = pts[0].lerp(Vector((0, 0, -0.03)), 0.35)
            tw.tube(pts, 0.0135, 0.009, around=7, step=0.01, knobs=0.15, seed=k + side)
        # Thumb over the top of the fingers.
        tc = c + ax * 0.045
        tw.tube([Vector((0, -0.025, -0.005)), tc + u * 0.03 + w * side * 0.025, tc + w * side * 0.035 - u * 0.005],
                0.014, 0.01, around=7, step=0.01, knobs=0.15, seed=9)
    else:
        for k in range(4):
            x = (k - 1.5) * 0.02
            pts = [Vector((x, -0.01, -0.035)), Vector((x * 1.4, -0.03, -0.075)),
                   Vector((x * 1.6, -0.04 - 0.02 * open_, -0.105)), Vector((x * 1.5, -0.025, -0.13))]
            tw.tube(pts, 0.012, 0.008, around=7, step=0.01, knobs=0.15, seed=k + side * 3)
        tw.tube([Vector((side * -0.03, -0.02, -0.01)), Vector((side * -0.05, -0.05, -0.05)),
                 Vector((side * -0.045, -0.06, -0.08))], 0.013, 0.009, around=7, step=0.01, knobs=0.15, seed=4)
    return tw.build(f"TwigHand{'L' if side > 0 else 'R'}", wood, hand)


def arm(side, name, rotation):
    a = b.pivot(f"Arm{name}", (side * 0.165, 0.0, HIP_Z + SHOULDER_Z), parent=root, rotation=rotation)
    b.ball(f"Shoulder{name}", 0.058, (0, 0, -0.005), mat=bark, parent=a, segments=20, rings=10)
    upper = b.capsule(f"UpperArm{name}", 0.05, 0.17, (0, 0, -0.1), mat=bark, parent=a, radius_bottom=0.042,
                      segments=18, rings=8)
    b.displace(upper, 0.004, 0.08)
    # A woody wrist where the bark turns into twig.
    wr = Bundle()
    wr.lumps((0, 0, -0.205), 0.045, scale=(1, 1, 0.7), subdiv=2, amp=0.25, freq=3.0, seed=side + 21)
    wr.build(f"Wrist{name}", wood, a)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.235), parent=a)
    return a, hand


# Right arm (his right, -X): raised out to the side holding the leaf sword up.
arm_r, hand_r = arm(-1, "R", (math.radians(-50), math.radians(62), math.radians(-12)))
# Left arm: relaxed, a little away from the body, holding the lantern.
arm_l, hand_l = arm(1, "L", (math.radians(-12), math.radians(-24), 0))

# ---- Sword: a twisted branch with a big leaf as the blade ----
SW_LOC = (0.0, -0.005, -0.06)
# The blade points up and a little out and back, whatever the arm's angle (world direction).
world_dir = Vector((-0.3, -0.28, 1.0)).normalized()
hand_world = (arm_r.rotation_euler.to_matrix())
local_dir = hand_world.inverted() @ world_dir
sw_q = local_dir.to_track_quat("Z", "Y")
# Spin so the leaf blade's flat side faces the camera-ish (-Y in world).
best = None
for k in range(72):
    q = sw_q @ Quaternion((0, 0, 1), 2 * math.pi * k / 72)
    face = hand_world @ (q @ Vector((0, -1, 0)))
    score = face.dot(Vector((-0.47, -0.88, 0.0)))
    if best is None or score > best[0]:
        best = (score, q)
SW_ROT = tuple(best[1].to_euler())
sword = b.pivot("Sword", SW_LOC, parent=hand_r, rotation=SW_ROT)
branch = Bundle()
hp = [Vector((0.004, 0.0, -0.14)), Vector((-0.004, 0.003, -0.06)), Vector((0.003, -0.002, 0.03)),
      Vector((-0.002, 0.003, 0.12)), Vector((0.0, 0.0, 0.2))]
branch.tube(hp, 0.024, 0.017, around=10, step=0.012, knobs=0.22, seed=3, wobble=0.12)
# Pommel knot and two side twigs near the top of the grip.
branch.lumps((0.0, 0.0, -0.15), 0.032, scale=(1, 1, 0.8), subdiv=2, amp=0.3, freq=2.5, seed=31)
branch.tube([Vector((0.0, 0.0, 0.1)), Vector((0.035, 0.0, 0.14)), Vector((0.055, -0.005, 0.15)),
             Vector((0.07, 0.0, 0.17))], 0.009, 0.004, around=6, step=0.01, knobs=0.2, seed=5)
branch.tube([Vector((0.0, 0.0, -0.09)), Vector((-0.03, 0.0, -0.11)), Vector((-0.045, 0.005, -0.1)),
             Vector((-0.05, 0.0, -0.08))], 0.008, 0.004, around=6, step=0.01, knobs=0.2, seed=6)
branch.build("Branch", wood, sword)
vn = Bundle()
spiral = []
for k in range(61):
    t = k / 60
    a = t * 2 * math.pi * 3.2
    z = -0.12 + 0.3 * t
    spiral.append(Vector((0.027 * math.cos(a), 0.027 * math.sin(a), z)))
vn.tube(spiral, 0.0055, 0.004, around=6, step=0.008, smooth=False)
vn.build("SwordVine", vine, sword)
sl = Bundle()
sl.leaf((0.068, 0.0, 0.168), (0.6, 0.0, 0.8), (0.0, 1.0, 0.0), (-0.8, 0, 0.6), 0.075, 0.04, cup=0.3, nl=6, nw=2,
        color=(0.9, 1.0, 0.8, 1))
sl.leaf((-0.05, 0.0, -0.08), (-0.5, 0.0, 0.85), (0.0, 1.0, 0.0), (0.85, 0, 0.5), 0.06, 0.032, cup=0.3, nl=6,
        nw=2, color=(0.9, 1.0, 0.8, 1))
sl.build("SwordSprouts", leaf_m, sword)
# The blade: a big, long leaf with a thick midrib, its stem tucked into the branch tip.
blade = Bundle()
blade.leaf((0, 0, 0.17), (0, 0, 1), (1, 0, 0), (0, -1, 0), 0.62, 0.25, cup=0.12, curl=0.05, teeth=14,
           nl=26, nw=5, stem=0.05, tip_shape=0.7, color=(1, 1, 1, 1))
blade.build("LeafBlade", blade_leaf_m, sword)
rib = Bundle()
rib.tube([Vector((0, 0, 0.16)), Vector((0, -0.004, 0.35)), Vector((0, -0.006, 0.55)), Vector((0, -0.004, 0.76))],
         0.0075, 0.0015, around=6, step=0.02)
rib.build("BladeRib", vine, sword)

# The right hand curls its twig fingers round the branch.
SW_M = Euler(SW_ROT).to_matrix()
grip_c = Vector(SW_LOC) + SW_M @ Vector((0, 0, -0.03))
grip_ax = SW_M @ Vector((0, 0, 1))
twig_hand(hand_r, -1, grip=(grip_c, grip_ax))

# ---- Lantern: a little ball of woven twigs with a firefly glowing inside ----
twig_hand(hand_l, 1, grip=((0.0, -0.005, -0.05), (0, 1, 0.0)))
lant = b.pivot("Lantern", (0.0, -0.005, -0.05), parent=hand_l, rotation=(0, 0, 0))
LR = 0.12
LC = Vector((0, 0, -0.2))
cage = Bundle()
for k in range(6):  # meridian twigs
    a = math.pi * k / 6
    pts = []
    for s in range(25):
        t = 2 * math.pi * s / 24
        wob = 1 + 0.04 * math.sin(3 * t + k)
        pts.append(LC + Vector((math.cos(a) * math.sin(t), math.sin(a) * math.sin(t), math.cos(t))) * LR * wob)
    cage.tube(pts, 0.0065, 0.0065, around=6, step=0.02, smooth=False, knobs=0.15, seed=k)
for el in (-0.35, 0.3):  # woven bands round the middle
    pts = []
    for s in range(41):
        t = 2 * math.pi * s / 40
        r_ = LR * math.cos(el) * (1.04 + 0.03 * math.sin(12 * t))
        pts.append(LC + Vector((r_ * math.cos(t), r_ * math.sin(t), LR * math.sin(el) * 1.03)))
    cage.tube(pts, 0.0075, 0.0075, around=6, step=0.018, smooth=False, knobs=0.12, seed=int(el * 10))
# Top and bottom knots, and the loop handle the hand holds.
cage.lumps(LC + Vector((0, 0, LR + 0.005)), 0.025, scale=(1, 1, 0.7), subdiv=2, amp=0.2, seed=41)
cage.lumps(LC + Vector((0, 0, -LR - 0.004)), 0.022, scale=(1, 1, 0.7), subdiv=2, amp=0.2, seed=42)
pts = []
for s in range(17):
    t = math.pi * s / 16
    pts.append(LC + Vector((0, 0.045 * math.cos(t), LR + 0.01 + 0.06 * math.sin(t))))
cage.tube(pts, 0.007, 0.007, around=6, step=0.01, smooth=False, knobs=0.15, seed=44)
cage.build("LanternCage", wood, lant)
lt_leaves = Bundle()
for k in range(3):
    a = 2 * math.pi * k / 3 + 0.4
    d = Vector((math.cos(a), math.sin(a), 0))
    base = LC + Vector((0, 0, LR + 0.01))
    lt_leaves.leaf(base, (d * 0.8 + Vector((0, 0, -0.4))), Vector((-d.y, d.x, 0)), (d * 0.4 + Vector((0, 0, 1))),
                   0.075, 0.042, cup=0.3, nl=6, nw=2, color=(0.9, 1.05, 0.8, 1))
lt_leaves.build("LanternLeaves", leaf_m, lant)
b.ball("LanternGlow", LR * 0.82, LC, mat=lantern_glow, parent=lant, segments=20, rings=10)
# Firefly: a glowing little bug with two clear wings.
fly = b.pivot("Firefly", LC + Vector((0.0, -0.01, 0.0)), parent=lant, rotation=(0.3, 0.2, 0.4))
b.ball("FireflyBody", 0.016, (0, 0, 0), scale=(0.8, 0.8, 1.4), mat=firefly_m, parent=fly, segments=12, rings=8)
for s in (-1, 1):
    b.ball(f"FireflyWing{s}", 0.022, (s * 0.018, 0.0, 0.01), (0, s * 0.6, 0), scale=(1.0, 0.15, 0.55), mat=wing_m,
           parent=fly, segments=12, rings=6)
lamp = bpy.data.lights.new("LanternLight", "POINT")
lamp.energy = 40.0
lamp.color = (1.0, 0.8, 0.4)
lamp.shadow_soft_size = 0.03
lamp_obj = bpy.data.objects.new("LanternLight", lamp)
b._link(lamp_obj, lant, tuple(LC))

# ---- Head: a round bark face with two big glowing eyes ----
head = b.pivot("Head", (0, 0, HIP_Z + 0.84), parent=root, rotation=(0.04, 0, 0.05))
HC = (0, 0, 0.0)
HRAD = (0.27, 0.25, 0.26)
skull = b.ball("Face", 1.0, HC, scale=HRAD, mat=head_bark, parent=head, segments=40, rings=24)
b.displace(skull, 0.005, 0.1)
for side in (1, -1):
    # Eye: a dark green rim, a glowing glassy eye, a brighter core and a painted highlight.
    loc, rot = b.on_surface(HC, HRAD, side * math.radians(29), math.radians(-4), push=-0.014)
    b.ball(f"EyeRim{side}", 0.069, loc, rot, scale=(0.9, 0.35, 1.18), mat=eye_rim_m, parent=head, segments=24,
           rings=12)
    loc, rot = b.on_surface(HC, HRAD, side * math.radians(29), math.radians(-4), push=-0.007)
    b.ball(f"Eye{side}", 0.065, loc, rot, scale=(0.88, 0.42, 1.15), mat=eye_m, parent=head, segments=24, rings=12)
    loc, rot = b.on_surface(HC, HRAD, side * math.radians(29), math.radians(-13), push=0.004)
    b.ball(f"EyeCore{side}", 0.034, loc, rot, scale=(1.1, 0.25, 0.75), mat=eye_core_m, parent=head, segments=16,
           rings=8)
    loc, rot = b.on_surface(HC, HRAD, side * math.radians(29) - math.radians(7), math.radians(5), push=0.014)
    b.ball(f"EyeShine{side}", 0.014, loc, rot, scale=(1.0, 0.4, 1.2), mat=eye_hi_m, parent=head, segments=10,
           rings=6)
# Moss growing up the sides of his face and under the cap.
fm = Bundle()
for k, (az, el, s) in enumerate(((-1.45, 0.25, 0.08), (-1.5, -0.35, 0.065), (1.45, 0.35, 0.075),
                                 (2.4, 0.1, 0.08), (-2.4, -0.1, 0.08), (3.1, 0.45, 0.07))):
    loc, rot = b.on_surface(HC, HRAD, az, el, push=-s * 0.25)
    n = Vector(loc) - Vector(HC)
    fm.lumps(loc, s, scale=(1.25, 1.25, 0.38), rot=frame_from(n), subdiv=3, amp=0.35, freq=5.0, seed=k + 60,
             color=moss_color())
fm.build("FaceMoss", moss_m, head)

# ---- The mushroom cap ----
cap = b.pivot("Cap", (0, 0.03, 0.17), parent=head, rotation=(math.radians(-18), math.radians(5), 0))
# One closed lathe: the underside (gill surface) from the stem out to the rim, round the rolled
# lip, then over the dome to the top.
under = [(0.06, 0.1), (0.16, 0.06), (0.3, 0.015), (0.42, -0.035), (0.52, -0.085), (0.565, -0.11)]
lip = [(0.59, -0.108), (0.607, -0.075)]
dome = [(0.61, -0.025), (0.595, 0.055), (0.545, 0.16), (0.46, 0.26), (0.34, 0.335), (0.2, 0.38), (0.08, 0.398),
        (0.001, 0.4)]
cap_profile = smooth_profile(under + lip + dome, per=3)
split = next(i for i, (r, z) in enumerate(cap_profile) if r >= 0.565) - 1
cap_obj = lathe("CapDome", cap_profile, [gill_base, cap_top], split=split, parent=cap, segments=64)
b.displace(cap_obj, 0.012, 0.25)
dome_dense = smooth_profile(dome, per=8)


def cap_point(phi, k, push=0.0):
    """A point on the top of the cap: phi around (0 = front, + toward his left), k 0..1 rim to top."""
    idx = k * (len(dome_dense) - 1)
    i = min(int(idx), len(dome_dense) - 2)
    f = idx - i
    (r0, z0), (r1, z1) = dome_dense[i], dome_dense[i + 1]
    r, z = r0 + (r1 - r0) * f, z0 + (z1 - z0) * f
    dr, dz = r1 - r0, z1 - z0
    d = Vector((math.sin(phi), -math.cos(phi), 0))
    n = (d * dz - Vector((0, 0, 1)) * dr).normalized()
    if n.z < -0.2 and k > 0.5:
        n = -n
    p = d * r + Vector((0, 0, z)) + n * push
    return p, n


# Gills: thin radial fins hanging under the cap.
gb = bmesh.new()
under_dense = smooth_profile(under + [lip[0]], per=6)
NG = 72
for g in range(NG):
    a = 2 * math.pi * g / NG + 0.02 * math.sin(g * 1.7)
    d = Vector((math.cos(a), math.sin(a), 0))
    start_r = 0.18 if g % 2 else 0.12
    top, bot = [], []
    pts = [(r, z) for r, z in under_dense if start_r <= r <= 0.575]
    for idx, (r, z) in enumerate(pts):
        t = idx / max(len(pts) - 1, 1)
        depth = 0.045 * math.sin(math.pi * min(1.0, t * 1.15) ** 0.7) + 0.002
        top.append(gb.verts.new(d * r + Vector((0, 0, z + 0.008))))
        bot.append(gb.verts.new(d * (r - 0.004) + Vector((0, 0, z - depth))))
    for i in range(len(top) - 1):
        gb.faces.new((top[i], top[i + 1], bot[i + 1], bot[i]))
b._mesh_object("Gills", gb, (0, 0, 0), (0, 0, 0), gills, cap, True)

# Glowing spots on the cap: soft teal domes with a dimmer halo ring.
spots = [(-0.55, 0.42, 0.075), (0.05, 0.3, 0.07), (0.62, 0.38, 0.06), (1.25, 0.28, 0.065), (-1.2, 0.32, 0.06),
         (-0.3, 0.68, 0.055), (0.45, 0.72, 0.05), (1.0, 0.62, 0.045), (-0.95, 0.66, 0.05), (2.2, 0.4, 0.07),
         (-2.1, 0.45, 0.065), (2.9, 0.35, 0.06), (1.75, 0.5, 0.05), (-1.65, 0.55, 0.045), (0.2, 0.88, 0.04),
         (2.6, 0.75, 0.05), (-2.7, 0.72, 0.045), (-0.1, 0.12, 0.04), (0.95, 0.15, 0.04), (-0.85, 0.12, 0.035)]
sp = Bundle()
rim = Bundle()
core = Bundle()
for k, (phi, kk, s) in enumerate(spots):
    p, n = cap_point(phi, kk, push=0.0)
    sp.lumps(p + n * 0.001, s, scale=(1.0, 0.85, 0.22), rot=frame_from(n), uv=16, amp=0.03, seed=k)
    core.lumps(p + n * (0.001 + s * 0.2), s * 0.42, scale=(1.0, 0.85, 0.2), rot=frame_from(n), uv=10, amp=0.0)
    rim.lumps(p - n * 0.004, s * 1.28, scale=(1.0, 0.85, 0.2), rot=frame_from(n), subdiv=2, amp=0.06, seed=k + 50)
sp.build("CapSpots", spot_m, cap)
core.build("CapSpotCores", spot_core_m, cap)
rim.build("CapSpotHalos", spot_rim_m, cap)

# Moss clumps on top of the cap (and spilling over its edge a little).
cm = Bundle()
for k in range(18):
    phi = R.uniform(-math.pi, math.pi)
    kk = R.uniform(0.35, 1.0) ** 0.8
    if any(abs(math.atan2(math.sin(phi - sp_[0]), math.cos(phi - sp_[0]))) < 0.25 and abs(kk - sp_[1]) < 0.1
           for sp_ in spots):
        continue
    p, n = cap_point(phi, kk)
    s = R.uniform(0.04, 0.075) * (1.15 if kk > 0.7 else 1.0)
    cm.lumps(p - n * s * 0.12, s, scale=(1.35, 1.1, 0.32), rot=frame_from(n), subdiv=3, amp=0.35, freq=5.0,
             seed=k + 100, color=moss_color())
for k, phi in enumerate((-0.2, 0.7, 2.0, -1.4, 2.8)):  # little drips of moss down the rim
    p, n = cap_point(phi, 0.18)
    cm.lumps(p - n * 0.01, 0.04, scale=(0.9, 1.6, 0.4), rot=frame_from(n), subdiv=2, amp=0.4, seed=k + 200,
             color=moss_color())
cm.build("CapMoss", moss_m, cap)
# A tiny sprout of two leaves on top of the cap.
spr = Bundle()
p, n = cap_point(0.4, 0.92)
spr.tube([p - n * 0.01, p + n * 0.04 + Vector((0.01, 0, 0)), p + n * 0.07 + Vector((0.025, -0.01, 0))],
         0.007, 0.004, around=6, step=0.01)
top = p + n * 0.065 + Vector((0.022, -0.008, 0))
spr.build("CapSproutStem", vine, cap)
spl = Bundle()
spl.leaf(top, (0.8, -0.2, 0.5), (0, 1, 0), (-0.5, 0, 0.9), 0.08, 0.045, cup=0.3, nl=6, nw=2, color=(0.9, 1.05, 0.8, 1))
spl.leaf(top, (-0.7, 0.3, 0.6), (0, 1, 0), (0.6, 0, 0.8), 0.065, 0.04, cup=0.3, nl=6, nw=2, color=(0.9, 1.05, 0.8, 1))
spl.build("CapSprout", leaf_m, cap)

# A soft warm light tucked under the cap brim so his face isn't lost in its shadow.
face_light = bpy.data.lights.new("FaceGlow", "POINT")
face_light.energy = 9.0
face_light.color = (1.0, 0.86, 0.66)
face_light.shadow_soft_size = 0.25
face_light.use_shadow = False
fl = bpy.data.objects.new("FaceGlow", face_light)
b._link(fl, head, (0.0, -0.45, 0.0))


# =====================================================================================
# The forest glade: misty green-gold light, sunbeams through a canopy, floating spores
# =====================================================================================

def glade():
    scene = bpy.context.scene
    b.studio(background="#cfe0a8", ground="#a3ad66", ground_image=MOSS, ground_image_scale=0.3, view="AgX",
             key=2.0, fill=0.9, rim=3.2, sun=0.0, shadow_softness=0.3, ground_radius=40.0)
    # Painted sky: a vertical gradient from green-gold mist near the ground to warm light above.
    world = scene.world
    nodes, links = world.node_tree.nodes, world.node_tree.links
    bg = nodes["Background"]
    tc = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = b.rgba("#b4c27a")
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = b.rgba("#fff1b8")
    links.new(sep.outputs["Z"], ramp.inputs[0])
    links.new(ramp.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    # The camera sees the bright painted sky, but it lights the scene only softly.
    lp = nodes.new("ShaderNodeLightPath")
    dim = nodes.new("ShaderNodeBackground")
    links.new(ramp.outputs[0], dim.inputs["Color"])
    dim.inputs["Strength"].default_value = 0.25
    ms = nodes.new("ShaderNodeMixShader")
    links.new(lp.outputs["Is Camera Ray"], ms.inputs[0])
    links.new(dim.outputs[0], ms.inputs[1])
    links.new(bg.outputs[0], ms.inputs[2])
    links.new(ms.outputs[0], nodes["World Output"].inputs["Surface"])

    # Lights: replace the studio's key/fill/rim colors with warm-sun / cool-green ones.
    objs = scene.collection.objects
    objs["Key"].data.color = b.rgba("#ffe9c2")[:3]
    objs["Fill"].data.color = b.rgba("#cfeee0")[:3]
    objs["Rim"].data.color = b.rgba("#fff0b8")[:3]
    objs["Rim"].location = (2.2, 3.2, 3.6)
    objs["Rim"].rotation_euler = (Vector((0, 0, 1.2)) - Vector((2.2, 3.2, 3.6))).to_track_quat("-Z", "Y").to_euler()
    sun = objs["Sun"]
    sun.data.energy = 9.0
    sun.data.color = b.rgba("#ffe7a8")[:3]
    sun.data.angle = 0.02
    sun.rotation_euler = Vector((-0.6, -0.4, -0.9)).to_track_quat("-Z", "Y").to_euler()
    # A low soft light from the front for his face and body.
    face = bpy.data.lights.new("FaceFill", "AREA")
    face.energy = 120.0
    face.size = 1.5
    face.color = b.rgba("#fff3dc")[:3]
    fo = bpy.data.objects.new("FaceFill", face)
    fo.location = (-0.9, -2.6, 0.9)
    fo.rotation_euler = (Vector((0, 0, 1.2)) - Vector(fo.location)).to_track_quat("-Z", "Y").to_euler()
    objs.link(fo)

    # Canopy: big dark leaf masses high above, with gaps for the sunbeams.
    canopy_m = b.mat("Canopy", "#1d2b14", roughness=1.0)
    rr = b.rng(3)
    cb = bmesh.new()
    # A roof of leaves with a few holes; the sun comes from up-right-behind, so the clearing
    # that lights Bobert sits up along the sun's direction.
    sun_back = Vector((0.6, 0.4, 0.9)).normalized()
    clear = Vector((0, 0, 1.0)) + sun_back * ((9.0 - 1.0) / sun_back.z)
    cell = 0.9
    for i in range(-30, 30):
        for j in range(-20, 40):
            x, y = i * cell, j * cell
            if (x - clear.x) ** 2 + (y - clear.y) ** 2 < 1.6 ** 2:
                continue
            if rr.random() < 0.05:
                continue
            for v in bmesh.ops.create_grid(cb, x_segments=1, y_segments=1, size=cell / 2)["verts"]:
                v.co += Vector((x, y, 9.0))
    canopy = bpy.data.objects.new("Canopy", bpy.data.meshes.new("Canopy"))
    cb.to_mesh(canopy.data)
    cb.free()
    canopy.data.materials.append(canopy_m)
    canopy.visible_camera = False
    objs.link(canopy)

    # Misty air: a big volume box with a light haze that catches the sunbeams.
    fog_m = bpy.data.materials.new("Mist")
    fog_m.use_nodes = True
    fn, fl_ = fog_m.node_tree.nodes, fog_m.node_tree.links
    fn.remove(fn.get("Principled BSDF"))
    vol = fn.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = b.rgba("#eef5d0")
    vol.inputs["Density"].default_value = 0.026
    vol.inputs["Anisotropy"].default_value = 0.45
    fl_.new(vol.outputs[0], fn.get("Material Output").inputs["Volume"])
    fog = bpy.data.objects.new("Mist", bpy.data.meshes.new("Mist"))
    fb = bmesh.new()
    bmesh.ops.create_cube(fb, size=1.0)
    for v in fb.verts:
        v.co = Vector((v.co.x * 34, v.co.y * 34 + 6, v.co.z * 10 + 4.99))
    fb.to_mesh(fog.data)
    fb.free()
    fog.data.materials.append(fog_m)
    objs.link(fog)

    # Background tree trunks fading into the mist, and a few mossy stones.
    trunk_m = surface("Trunk", "#6f7a5c", BARK, scale=0.5, img_strength=0.5, moss=0.45, moss_up=0.2,
                      moss_noise=0.8, moss_img_scale=1.0, moss_color="#6f9a3a")
    for i, (x, y, r) in enumerate(((-6.5, 7.0, 0.8), (-3.4, 10.5, 0.9), (2.8, 9.0, 0.7), (6.5, 6.0, 1.0),
                                   (9.0, 12.0, 1.1), (-9.5, 4.0, 1.0), (0.5, 15.0, 1.2), (-1.5, 6.5, 0.35),
                                   (4.6, 4.2, 0.4))):
        b.cylinder(f"Tree{i}", r, 20.0, (x, y, 9.5), mat=trunk_m, segments=20, radius_top=r * 0.7)
        bpy.data.collections["Bobert"].objects.unlink(bpy.data.objects[f"Tree{i}"])
        objs.link(bpy.data.objects[f"Tree{i}"])
    stone_m = surface("Stone", "#8a8a78", None, scale=1.0, moss=0.55, moss_up=1.2, moss_noise=1.2,
                      moss_img_scale=1.5)
    sb = Bundle()
    for i, (x, y, s) in enumerate(((-2.6, 2.6, 0.55), (2.9, 3.4, 0.7), (-4.0, 5.5, 0.8), (1.6, -1.8, 0.25),
                                   (-1.7, -1.1, 0.18), (3.8, 0.5, 0.4))):
        sb.lumps((x, y, s * 0.15), s, scale=(1.3, 1.0, 0.6), subdiv=3, amp=0.25, freq=1.5, seed=i + 300)
    stones = sb.build("Stones", stone_m)
    bpy.data.collections["Bobert"].objects.unlink(stones)
    objs.link(stones)

    # Sunbeams: soft see-through shafts of warm light slanting down from the canopy behind him.
    beam_m = bpy.data.materials.new("Sunbeam")
    beam_m.use_nodes = True
    bn, bl_ = beam_m.node_tree.nodes, beam_m.node_tree.links
    bn.remove(bn.get("Principled BSDF"))
    lw = bn.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    edge = _math(bn, bl_, "SUBTRACT", 1.0, lw.outputs["Facing"])
    edge = _math(bn, bl_, "POWER", edge, 2.0)
    tco = bn.new("ShaderNodeTexCoord")
    sp_ = bn.new("ShaderNodeSeparateXYZ")
    bl_.new(tco.outputs["Generated"], sp_.inputs[0])
    fade = bn.new("ShaderNodeFloatCurve")
    cv = fade.mapping.curves[0]
    cv.points[0].location = (0.0, 0.0)
    cv.points[1].location = (1.0, 0.35)
    cv.points.new(0.25, 1.0)
    cv.points.new(0.6, 0.8)
    bl_.new(sp_.outputs["Z"], fade.inputs["Value"])
    strength = _math(bn, bl_, "MULTIPLY", edge, fade.outputs[0])
    strength = _math(bn, bl_, "MULTIPLY", strength, 0.22)
    em = bn.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = b.rgba("#fff0bc")
    em.inputs["Strength"].default_value = 1.0
    tr = bn.new("ShaderNodeBsdfTransparent")
    ad = bn.new("ShaderNodeMixShader")
    bl_.new(strength, ad.inputs[0])
    bl_.new(tr.outputs[0], ad.inputs[1])
    add = bn.new("ShaderNodeAddShader")
    bl_.new(tr.outputs[0], add.inputs[0])
    bl_.new(em.outputs[0], add.inputs[1])
    bl_.new(add.outputs[0], ad.inputs[2])
    bl_.new(ad.outputs[0], bn.get("Material Output").inputs["Surface"])
    beam_m.surface_render_method = "BLENDED"
    sun_dir = Vector((-0.6, -0.4, -0.9)).normalized()
    for i, (gx, gy, r) in enumerate(((0.4, 1.6, 0.55), (-1.6, 3.2, 0.4), (2.2, 2.6, 0.35), (-3.6, 2.4, 0.5),
                                     (3.6, 4.4, 0.6), (-0.6, 5.5, 0.45), (1.2, 7.5, 0.7))):
        length = 14.0
        bot = Vector((gx, gy, 0.0))
        mid = bot - sun_dir * length / 2
        beam = b.cylinder(f"Sunbeam{i}", r, length, tuple(mid), tuple(frame_from(-sun_dir)), mat=beam_m,
                          segments=24, radius_top=r * 1.25)
        beam.visible_shadow = False
        bpy.data.collections["Bobert"].objects.unlink(beam)
        objs.link(beam)

    # Floating glowing spores and little glowing flower buds.
    spore_m = glow("Spore", "#fff4b0", 12.0, core="#fffbe0")
    bud_m = glow("Bud", "#f4ffe6", 3.0, core="#ffffff")
    stem_m = b.mat("Stem", "#6f9a3a", roughness=0.7)
    pb = Bundle()
    for i in range(46):
        a = rr.uniform(0, 2 * math.pi)
        d = rr.uniform(0.9, 4.5)
        p = (math.cos(a) * d, math.sin(a) * d + 0.8, rr.uniform(0.25, 2.6))
        if p[1] < 0.3 and abs(p[0]) < 2.2:  # keep them out from between the camera and Bobert
            continue
        pb.lumps(p, rr.uniform(0.008, 0.02), subdiv=1, amp=0.0)
    spores = pb.build("Spores", spore_m)
    bpy.data.collections["Bobert"].objects.unlink(spores)
    objs.link(spores)
    fb_ = Bundle()
    st_ = Bundle()
    for i in range(30):
        a = rr.uniform(0, 2 * math.pi)
        d = rr.uniform(0.75, 3.2)
        x, y = math.cos(a) * d, math.sin(a) * d + 0.5
        h = rr.uniform(0.08, 0.2)
        st_.tube([Vector((x, y, 0)), Vector((x + 0.01, y, h * 0.6)), Vector((x + 0.02, y, h))], 0.005, 0.004,
                 around=5, step=0.03)
        fb_.lumps((x + 0.02, y, h + 0.012), 0.018, scale=(1, 1, 1.3), subdiv=1, amp=0.0)
    for nm, bun, m_ in (("Buds", fb_, bud_m), ("BudStems", st_, stem_m)):
        o = bun.build(nm, m_)
        bpy.data.collections["Bobert"].objects.unlink(o)
        objs.link(o)

    eevee = scene.eevee
    eevee.use_volumetric_shadows = True
    eevee.volumetric_tile_size = "4"
    eevee.volumetric_samples = 96
    eevee.volumetric_end = 40.0
    eevee.volumetric_shadow_samples = 32
    eevee.use_shadows = True
    eevee.shadow_pool_size = "1024"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.25

    # Soft bloom so glowing things halo, like light in a painting.
    try:
        ng = bpy.data.node_groups.new("SpiritComp", "CompositorNodeTree")
        scene.compositing_node_group = ng
        rl = ng.nodes.new("CompositorNodeRLayers")
        gl = ng.nodes.new("CompositorNodeGlare")
        gl.inputs["Type"].default_value = "Bloom"
        gl.inputs["Quality"].default_value = "High"
        gl.inputs["Threshold"].default_value = 0.75
        gl.inputs["Strength"].default_value = 1.6
        print("COMPOSITOR", scene.render.use_compositing, scene.compositing_node_group)
        gl.inputs["Size"].default_value = 0.75
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        out = ng.nodes.new("NodeGroupOutput")
        ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
        hs = ng.nodes.new("CompositorNodeHueSat")
        hs.inputs["Saturation"].default_value = 1.15
        ng.links.new(gl.outputs["Image"], hs.inputs["Image"])
        ng.links.new(hs.outputs["Image"], out.inputs[0])
    except Exception as e:  # noqa: BLE001
        print("COMPOSITOR SKIPPED", e)


glade()

if os.environ.get("SPIRIT_TRIS"):
    deps = bpy.context.evaluated_depsgraph_get()
    counts = []
    for o in b.meshes():
        m_ = o.evaluated_get(deps).to_mesh()
        counts.append((sum(len(p_.vertices) - 2 for p_ in m_.polygons), o.name))
        o.evaluated_get(deps).to_mesh_clear()
    for c, n_ in sorted(counts, reverse=True)[:25]:
        print("TRIS", c, n_)

# Hero camera: lift the frame a little for the tall cap (the lib frames from `height`).
_orig_camera = b._camera


def _camera(name, location, target, lens=50, ortho_scale=None):
    cam = _orig_camera(name, location, target, lens=lens, ortho_scale=ortho_scale)
    if name == "HeroCam":
        cam.data.lens = 58
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = (Vector(location) - Vector((0, -0.1, 1.0))).length
        cam.data.dof.aperture_fstop = 2.2
    return cam


b._camera = _camera
b.render_all(ID, height=1.9)


def export_ready():
    """The glb takes Principled colors only: route each leaf material's BSDF straight to the output."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        out = m.node_tree.nodes.get("Material Output")
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if out and bsdf and out.inputs["Surface"].links and out.inputs["Surface"].links[0].from_node != bsdf:
            m.node_tree.links.new(bsdf.outputs[0], out.inputs["Surface"])
    # The volume glow doesn't export; the solid orb stands in for it.
    for o in list(bpy.data.collections["Bobert"].all_objects):
        if o.name == "LanternGlow":
            o.data.materials[0] = lantern_orb_m
            o.scale = (0.75, 0.75, 0.75)


export_ready()
b.export(ID)
