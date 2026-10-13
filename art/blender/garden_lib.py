"""Shared helpers for building Psychedelic Garden models in Blender (headless).

Every model is made of soft, beveled chunky shapes. Materials are named after the game's
painted textures ('bark', 'foliage', 'petal', ...) so the game can apply its own toon material
and texture to each part. Units are game units (1 = one old voxel), Y up in the game.

Run a model script with:
  Blender -b -P art/blender/<model>.py
"""

import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "public", "models")
PREVIEWS = os.path.join(ROOT, "art", "previews")


def reset():
    """Empty scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color=(1, 1, 1, 1)):
    """A material slot named after a texture/role. The game replaces it with its own material."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = color
    if not mat.use_nodes:
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.8
    return mat


def block(name, size, location=(0, 0, 0), rotation=(0, 0, 0), bevel=0.15, segments=2, mat=None, taper=None):
    """A soft beveled block. size = (x, y, z) in Blender axes (z up).
    taper = (sx, sy) scales the top face, for tapered trunks and roofs."""
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
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=b, segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = Euler(rotation)
    if mat:
        obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def blob(name, radius, location=(0, 0, 0), rotation=(0, 0, 0), squash=(1, 1, 1), subdiv=2, mat=None, chunk=0.35):
    """A puffy, chunky rounded shape: a beveled cube pushed toward a sphere ("blocky but round")."""
    obj = block(name, (2 * radius * squash[0], 2 * radius * squash[1], 2 * radius * squash[2]), location, rotation,
                bevel=radius * chunk, segments=subdiv, mat=mat)
    return obj


def join(objs, name):
    """Merge objects into one mesh (keeps their material slots)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False


def shade_auto(obj, angle=40):
    """Smooth shading but keep hard edges sharper than `angle` degrees."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def export(objs, filename):
    """Export the given objects as public/models/<filename>.glb (Y up, no animation)."""
    os.makedirs(MODELS, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    path = os.path.join(MODELS, filename + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="EXPORT",
        export_animations=False,
    )
    tris = sum(triangles(o) for o in objs)
    print(f"EXPORTED {filename}.glb  {tris} triangles  ({os.path.getsize(path) // 1024} KB)")
    return path


def preview(filename, objs, colors=None, distance=None):
    """Render a quick colored preview PNG to art/previews/ (Workbench, flat colors)."""
    os.makedirs(PREVIEWS, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    scene.display.shading.show_object_outline = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w") if not scene.world else scene.world
    scene.world = world
    # Fit a camera to the objects.
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    size = (hi - lo).length
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    d = distance or size * 1.5
    cam.location = center + Vector((d * 0.7, -d * 0.7, d * 0.45))
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(PREVIEWS, filename + ".png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def rng(seed):
    return random.Random(seed)
