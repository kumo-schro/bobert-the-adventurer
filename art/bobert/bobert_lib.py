"""Shared helpers for building Bobert in Blender (headless) for the art style explorations.

Blender axes: Z up, Bobert faces -Y (his right hand is on the -X side). Units are game units:
Bobert is about 1.9 tall, feet at z = 0.

Build him out of parts parented to pivots (empties), so arms, legs and head can be posed:
    root = b.pivot("Bobert")
    arm_r = b.pivot("ArmR", (-0.42, 0, 1.38), parent=root)
    b.capsule("SleeveR", 0.1, 0.3, (0, 0, -0.18), mat=shirt, parent=arm_r)   # location is relative to the pivot
    arm_r.rotation_euler = (0, 0.15, 0)

Then:
    b.studio(background=(...), ground=(...))
    b.render_all("toon")      # renders/toon_hero.png and renders/toon_turnaround.png
    b.export("toon")          # models/toon.glb

Run a style with: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/<file>.py
"""

import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
RENDERS = os.path.join(HERE, "renders")
MODELS = os.path.join(HERE, "models")
TEXTURES = os.path.join(HERE, "textures")

COLLECTION = "Bobert"

# Bobert's colors (the same in every style; styles may shade them).
SKIN = "#ffcc99"
HAIR = "#6b3e1f"
SHIRT = "#ff4f6d"
PANTS = "#3d5afe"
BOOTS = "#4a2c1a"
LEATHER = "#8a5a35"
CHEEKS = "#ff8fa3"


def rgba(color, alpha=1.0):
    """'#ff4f6d' or (r, g, b) in 0..1 -> linear RGBA for Blender."""
    if isinstance(color, str):
        h = color.lstrip("#")
        srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    else:
        srgb = list(color[:3])

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (*[lin(c) for c in srgb], alpha)


def rng(seed):
    return random.Random(seed)


def texture(style_id, name):
    """Path of a Codex texture for a style (textures/<style_id>/<name>.png), or None if missing."""
    path = os.path.join(TEXTURES, style_id, name + ".png")
    return path if os.path.exists(path) else None


# ---- Scene ----

def reset():
    """Empty scene with a 'Bobert' collection that new parts go into."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(coll)
    layer = bpy.context.view_layer.layer_collection.children[COLLECTION]
    bpy.context.view_layer.active_layer_collection = layer
    return coll


def _link(obj, parent=None, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    bpy.data.collections[COLLECTION].objects.link(obj)
    if parent is not None:
        obj.parent = parent
    obj.location = location
    obj.rotation_euler = Euler(rotation)
    obj.scale = scale
    return obj


def pivot(name, location=(0, 0, 0), parent=None, rotation=(0, 0, 0)):
    """An empty to hang parts on (a joint). Children's locations are relative to it."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_size = 0.1
    return _link(empty, parent, location, rotation)


# ---- Materials ----

def mat(name, color="#ffffff", roughness=0.6, metallic=0.0, image=None, image_scale=1.0, image_strength=1.0,
        emission=None, emission_strength=1.0, sheen=0.0, coat=0.0, subsurface=0.0, bump=0.0, flat=False):
    """A Principled material.

    image: a texture path; it's box-projected (no UVs needed) and multiplied with `color`,
        so light, neutral textures can be tinted. image_strength 0..1 blends it in.
    bump: use the image's brightness as a bump map too (0 = off).
    flat: emission-only (no lighting at all), for outlines and painted-on details.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    out = nodes.get("Material Output")
    bsdf = nodes.get("Principled BSDF")
    base = rgba(color)
    m.diffuse_color = base
    if flat:
        nodes.remove(bsdf)
        em = nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = base
        links.new(em.outputs[0], out.inputs["Surface"])
        return m
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
    if subsurface:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (0.1, 0.05, 0.03)
        bsdf.inputs["Subsurface Scale"].default_value = 0.05
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = rgba(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if image:
        coord = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (image_scale, image_scale, image_scale)
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image, check_existing=True)
        tex.projection = "BOX"
        tex.projection_blend = 0.35
        links.new(coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs[0], tex.inputs["Vector"])
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = image_strength
        mix.inputs["A"].default_value = base
        links.new(tex.outputs["Color"], mix.inputs["B"])
        links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        if bump:
            bmp = nodes.new("ShaderNodeBump")
            bmp.inputs["Strength"].default_value = bump
            bmp.inputs["Distance"].default_value = 0.02
            links.new(tex.outputs["Color"], bmp.inputs["Height"])
            links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return m


# ---- Shapes ----
# Every shape takes: location (relative to `parent`), rotation (radians), mat, parent.

def _mesh_object(name, bm, location, rotation, mat_, parent, smooth):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    _link(obj, parent, location, rotation)
    if mat_:
        obj.data.materials.append(mat_)
    for poly in obj.data.polygons:
        poly.use_smooth = smooth
    return obj


def box(name, size, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None, bevel=0.03, segments=3,
        taper=None, smooth=True):
    """A box, size = (x, y, z), with beveled edges. taper = (sx, sy) scales the top face."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
        if taper and v.co.z > 0:
            v.co.x *= taper[0]
            v.co.y *= taper[1]
    b = min(bevel, 0.45 * min(size))
    if b > 0 and segments > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=b, segments=segments, profile=0.5, affect="EDGES",
                        clamp_overlap=True)
    obj = _mesh_object(name, bm, location, rotation, mat, parent, smooth)
    if smooth:
        weighted_normals(obj)
    return obj


def ball(name, radius, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1), mat=None, parent=None,
         segments=32, rings=16, smooth=True):
    """A sphere (or an ellipsoid with `scale`)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return _mesh_object(name, bm, location, rotation, mat, parent, smooth)


def capsule(name, radius, length, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None,
            segments=24, rings=12, radius_bottom=None, scale=(1, 1, 1), smooth=True):
    """A pill along Z: `length` is the straight middle part. radius_bottom tapers it (thicker top)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    rb = radius if radius_bottom is None else radius_bottom
    for v in bm.verts:
        if v.co.z >= 0:
            v.co.z += length / 2
        else:
            k = rb / radius
            v.co.x *= k
            v.co.y *= k
            v.co.z = v.co.z * k - length / 2
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return _mesh_object(name, bm, location, rotation, mat, parent, smooth)


def cylinder(name, radius, depth, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None, segments=32,
             radius_top=None, bevel=0.0, smooth=True):
    """A cylinder (or a cone / truncated cone with radius_top) along Z, centered."""
    bm = bmesh.new()
    rt = radius if radius_top is None else radius_top
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=rt, depth=depth)
    if bevel > 0:
        rims = [e for e in bm.edges if not e.is_manifold or len(e.link_faces) == 2 and
                abs(e.link_faces[0].normal.z) != abs(e.link_faces[1].normal.z)]
        bmesh.ops.bevel(bm, geom=rims, offset=bevel, segments=3, profile=0.5, affect="EDGES", clamp_overlap=True)
    obj = _mesh_object(name, bm, location, rotation, mat, parent, smooth)
    if smooth:
        weighted_normals(obj)
    return obj


def torus(name, major, minor, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None, segments=32,
          minor_segments=12, scale=(1, 1, 1), arc=None):
    """A ring around Z (centered on `location`).
    arc (radians): an open, capped curve instead: the part of the ring around its -Y side.
    For a smile on a face that looks toward -Y, use rotation (pi/2, 0, 0): the curve then sags
    down, `major` below `location`. Use (-pi/2, 0, 0) for a frown or a raised brow."""
    bm = bmesh.new()
    verts = []
    closed = arc is None
    count = segments if closed else segments + 1
    for i in range(count):
        a = 2 * math.pi * i / segments if closed else -math.pi / 2 - arc / 2 + arc * i / segments
        ring = []
        for j in range(minor_segments):
            t = 2 * math.pi * j / minor_segments
            r = major + minor * math.cos(t)
            ring.append(bm.verts.new((r * math.cos(a) * scale[0], r * math.sin(a) * scale[1], minor * math.sin(t) * scale[2])))
        verts.append(ring)
    for i in range(segments):
        for j in range(minor_segments):
            a, b2 = verts[i], verts[(i + 1) % count]
            bm.faces.new((a[j], b2[j], b2[(j + 1) % minor_segments], a[(j + 1) % minor_segments]))
    if not closed:  # cap the two ends
        bm.faces.new(list(reversed(verts[0])))
        bm.faces.new(verts[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mesh_object(name, bm, location, rotation, mat, parent, True)


def from_points(name, profile, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, parent=None, segments=32, scale=(1, 1, 1)):
    """A lathe: spin a profile [(radius, z), ...] (bottom to top) around Z. Good for boots, hats, pommels."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((r * math.cos(a) * scale[0], r * math.sin(a) * scale[1], z * scale[2])))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(segments):
            a, c = rings[k], rings[k + 1]
            bm.faces.new((a[i], a[(i + 1) % segments], c[(i + 1) % segments], c[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mesh_object(name, bm, location, rotation, mat, parent, True)


def on_surface(center, radii, azimuth, elevation, push=0.0):
    """A spot on an ellipsoid (like the head), for placing eyes, ears, cheeks and hair.
    azimuth: 0 = straight ahead (-Y), + toward +X (Bobert's left). elevation: + up. Radians.
    Returns (location, rotation): the rotation turns a part's -Y axis to face outward."""
    cx, cy, cz = center
    rx, ry, rz = radii
    d = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    p = Vector((cx + rx * d.x, cy + ry * d.y, cz + rz * d.z))
    normal = Vector((d.x / rx, d.y / ry, d.z / rz)).normalized()
    p += normal * push
    return tuple(p), tuple(normal.to_track_quat("-Y", "Z").to_euler())


# ---- Modifiers and finishing touches ----

def weighted_normals(obj):
    mod = obj.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    mod.keep_sharp = True


def subdivide(obj, levels=2):
    mod = obj.modifiers.new("Subdivision", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return obj


def displace(obj, strength=0.02, size=0.15, levels=0, seed=0):
    """Lumpy surface (for clay): subdivide, then push the surface in and out with noise."""
    if levels:
        subdivide(obj, levels)
    tex = bpy.data.textures.new(f"{obj.name}_lumps", "CLOUDS")
    tex.noise_scale = size
    tex.noise_depth = 1
    mod = obj.modifiers.new("Lumps", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.mid_level = 0.5
    mod.texture_coords = "GLOBAL"
    return obj


def outline(objs, thickness=0.012, color="#2a1a2e"):
    """Ink outlines (inverted hull): a slightly bigger back-facing copy of each mesh, in flat color."""
    ink = bpy.data.materials.get("Outline") or mat("Outline", color, flat=True)
    ink.use_backface_culling = True
    for obj in objs:
        if obj.type != "MESH":
            continue
        obj.data.materials.append(ink)
        mod = obj.modifiers.new("Outline", "SOLIDIFY")
        mod.thickness = thickness
        mod.offset = 1
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = len(obj.data.materials) - 1


def meshes():
    """Every mesh in Bobert's collection."""
    return [o for o in bpy.data.collections[COLLECTION].all_objects if o.type == "MESH"]


def triangles():
    deps = bpy.context.evaluated_depsgraph_get()
    total = 0
    for o in meshes():
        m = o.evaluated_get(deps).to_mesh()
        total += sum(len(p.vertices) - 2 for p in m.polygons)
        o.evaluated_get(deps).to_mesh_clear()
    return total


# ---- Studio, rendering, export ----

def studio(background="#f3ead8", ground="#e6d8bd", ground_image=None, ground_image_scale=1.0, key=3.0, fill=0.8,
           rim=2.0, sun=2.5, view="AgX", look=None, exposure=0.0, shadow_softness=0.4, ground_radius=9.0):
    """A simple photo studio: a floor, a soft sun, a key light, a fill light, a rim light."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = rgba(background)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world

    floor_mat = mat("Floor", ground, roughness=0.9, image=ground_image, image_scale=ground_image_scale)
    floor = bpy.data.objects.new("Floor", bpy.data.meshes.new("Floor"))
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=64, radius=ground_radius)
    bm.to_mesh(floor.data)
    bm.free()
    floor.data.materials.append(floor_mat)
    scene.collection.objects.link(floor)

    def light(name, kind, energy, location, rotation, size=1.0, color="#ffffff"):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = rgba(color)[:3]
        if kind == "AREA":
            data.size = size
        if kind == "SUN":
            data.angle = shadow_softness
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        obj.rotation_euler = Euler(rotation)
        scene.collection.objects.link(obj)
        return obj

    light("Sun", "SUN", sun, (0, 0, 10), (math.radians(40), 0, math.radians(-35)), color="#fff4e0")
    light("Key", "AREA", key * 100, (-3, -4, 4), (math.radians(55), 0, math.radians(-35)), size=3, color="#fff1e0")
    light("Fill", "AREA", fill * 100, (4, -3, 2), (math.radians(70), 0, math.radians(50)), size=4, color="#e0ecff")
    light("Rim", "AREA", rim * 100, (1, 4, 3.5), (math.radians(-55), 0, math.radians(165)), size=2.5, color="#ffffff")

    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    eevee = scene.eevee
    for attr, value in (("taa_render_samples", 64), ("use_shadows", True), ("use_raytracing", True),
                        ("use_gtao", True), ("gtao_distance", 0.3)):
        if hasattr(eevee, attr):
            setattr(eevee, attr, value)
    scene.view_settings.view_transform = view
    if look:
        scene.view_settings.look = look
    scene.view_settings.exposure = exposure
    scene.render.film_transparent = False


def _camera(name, location, target, lens=50, ortho_scale=None):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    if ortho_scale:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return cam


def render_all(style_id, hero_size=1200, turn_size=(2400, 1000), height=1.95):
    """renders/<id>_hero.png (3/4 front, a little from above) and renders/<id>_turnaround.png
    (front, 3/4, side and back, side by side)."""
    os.makedirs(RENDERS, exist_ok=True)
    scene = bpy.context.scene
    print(f"TRIANGLES {style_id}: {triangles()}")

    # Hero shot
    scene.render.resolution_x = scene.render.resolution_y = hero_size
    mid = height * 0.5
    cam = _camera("HeroCam", (-1.85, -3.45, mid + 0.95), (0, 0, mid - 0.05), lens=50)
    scene.camera = cam
    scene.render.filepath = os.path.join(RENDERS, f"{style_id}_hero.png")
    bpy.ops.render.render(write_still=True)

    # Turnaround: four instances of the collection, the original hidden.
    coll = bpy.data.collections[COLLECTION]
    bpy.context.view_layer.layer_collection.children[COLLECTION].exclude = True
    spacing = 1.75
    for i, turn in enumerate((0, 45, 90, 180)):
        inst = bpy.data.objects.new(f"View{turn}", None)
        inst.instance_type = "COLLECTION"
        inst.instance_collection = coll
        inst.location = ((i - 1.5) * spacing, 0, 0)
        inst.rotation_euler = (0, 0, math.radians(-turn))
        scene.collection.objects.link(inst)
    scene.render.resolution_x, scene.render.resolution_y = turn_size
    width = spacing * 4 + 0.2
    cam = _camera("TurnCam", (0, -12, mid + 1.2), (0, 0, mid), ortho_scale=width)
    scene.camera = cam
    scene.render.filepath = os.path.join(RENDERS, f"{style_id}_turnaround.png")
    bpy.ops.render.render(write_still=True)
    for o in [o for o in scene.collection.objects if o.name.startswith("View")]:
        bpy.data.objects.remove(o)
    bpy.context.view_layer.layer_collection.children[COLLECTION].exclude = False


def export(style_id):
    """models/<id>.glb: Bobert's parts with their pivots (colors only; the painted textures are
    box-projected in Blender and don't come along)."""
    os.makedirs(MODELS, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.collections[COLLECTION].all_objects:
        o.select_set(True)
    path = os.path.join(MODELS, style_id + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_animations=False)
    print(f"EXPORTED {path} ({os.path.getsize(path) // 1024} KB)")
