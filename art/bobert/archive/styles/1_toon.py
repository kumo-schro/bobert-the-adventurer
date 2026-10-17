"""Style 1: Toon Garden. Chunky, soft-beveled toy shapes (blocky but rounded, never voxel cubes),
bold candy colors, a soft rim light and a painterly cloth texture. The look of the
art/psychedelic-garden branch, applied to Bobert.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/1_toon.py
"""

import math
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bobert_lib as b  # noqa: E402

ID = "toon"
b.reset()

cloth = b.texture(ID, "cloth")
skin = b.mat("Skin", "#ffc896", roughness=0.55, subsurface=0.15)
hair = b.mat("Hair", "#7a4220", roughness=0.45, coat=0.3)
shirt = b.mat("Shirt", "#ff4f6d", roughness=0.7, image=cloth, image_scale=2.5, image_strength=0.5)
shirt_dark = b.mat("ShirtTrim", "#d93358", roughness=0.7)
cream = b.mat("Cream", "#fff1d6", roughness=0.6)
pants = b.mat("Pants", "#3d5afe", roughness=0.7, image=cloth, image_scale=2.5, image_strength=0.5)
boots = b.mat("Boots", "#5a3320", roughness=0.5, coat=0.2)
sole = b.mat("Sole", "#2e1a12", roughness=0.8)
leather = b.mat("Leather", "#9a6238", roughness=0.5)
gold = b.mat("Gold", "#ffcf3f", roughness=0.25, metallic=0.8)
wood = b.mat("Wood", "#a0612e", roughness=0.6)
steel = b.mat("Steel", "#dfe8f2", roughness=0.2, metallic=0.9)
white = b.mat("EyeWhite", "#ffffff", roughness=0.2)
iris = b.mat("Iris", "#5a3a1f", roughness=0.2)
pupil = b.mat("Pupil", "#1a0f0a", roughness=0.1)
shine = b.mat("Shine", "#ffffff", emission="#ffffff", emission_strength=2.0)
cheek = b.mat("Cheek", "#ff8fa3", roughness=0.6)
mouth = b.mat("Mouth", "#a8323f", roughness=0.5)

root = b.pivot("Bobert")

# ---- Legs ----
for side, name in ((1, "L"), (-1, "R")):
    leg = b.pivot(f"Leg{name}", (side * 0.13, 0, 0.78), parent=root, rotation=(0, side * -0.04, 0))
    b.capsule(f"Thigh{name}", 0.125, 0.18, (0, 0, -0.17), mat=pants, parent=leg, radius_bottom=0.11)
    b.capsule(f"Shin{name}", 0.11, 0.14, (0, 0, -0.4), mat=pants, parent=leg, radius_bottom=0.115)
    # Boot: chunky lathe with a rolled cuff, a rounded toe and a thick sole.
    b.from_points(f"Boot{name}", [(0.12, -0.78), (0.135, -0.7), (0.13, -0.58), (0.135, -0.5)],
                  mat=boots, parent=leg, scale=(1, 1.05, 1))
    b.cylinder(f"Cuff{name}", 0.152, 0.1, (0, 0, -0.5), mat=boots, parent=leg, radius_top=0.162, bevel=0.015)
    b.ball(f"Stud{name}", 0.022, (side * 0.11, -0.08, -0.62), mat=gold, parent=leg)
    b.ball(f"Toe{name}", 0.12, (0, -0.1, -0.71), scale=(1.0, 1.3, 0.62), mat=boots, parent=leg)
    b.box(f"Sole{name}", (0.24, 0.34, 0.045), (0, -0.045, -0.765), mat=sole, parent=leg, bevel=0.02, taper=(1.04, 1.04))

# ---- Body ----
body = b.pivot("Body", (0, 0, 0), parent=root)
b.from_points("Tunic", [(0.3, 0.6), (0.29, 0.66), (0.26, 0.8), (0.25, 0.95), (0.27, 1.08), (0.24, 1.15),
                        (0.14, 1.2), (0.1, 1.21)], mat=shirt, parent=body, scale=(1, 0.78, 1))
b.torus("Hem", 0.295, 0.025, (0, 0, 0.615), mat=shirt_dark, parent=body, scale=(1, 0.78, 1))
b.torus("Collar", 0.125, 0.04, (0, 0, 1.19), mat=shirt_dark, parent=body, scale=(1, 0.85, 1))
# Laced V-neck: a cream undershirt peeking out, with a crossed leather lace.
b.box("Undershirt", (0.1, 0.03, 0.12), (0, -0.192, 1.13), (math.radians(-8), 0, 0), mat=cream, parent=body,
      bevel=0.015)
for side in (1, -1):
    b.box(f"NeckEdge{side}", (0.025, 0.035, 0.16), (side * 0.055, -0.195, 1.12), (math.radians(-8), side * -0.35, 0),
          mat=shirt_dark, parent=body, bevel=0.01)
    b.capsule(f"Lace{side}", 0.008, 0.11, (0, -0.215, 1.1), (math.radians(-8), side * 0.9, 0), mat=leather, parent=body,
              segments=8, rings=4)
b.ball("LaceKnot", 0.016, (0, -0.22, 1.1), mat=leather, parent=body)
# Belt, buckle and pouch
b.torus("Belt", 0.26, 0.045, (0, 0, 0.83), mat=leather, parent=body, scale=(1, 0.79, 1))
b.torus("Buckle", 0.05, 0.016, (0, -0.238, 0.83), (math.pi / 2, 0, 0), mat=gold, parent=body, segments=24,
        minor_segments=8)
b.capsule("BucklePin", 0.008, 0.06, (0.0, -0.245, 0.83), (0, math.pi / 2, 0), mat=gold, parent=body, segments=8, rings=4)
b.box("Pouch", (0.13, 0.09, 0.14), (0.2, -0.13, 0.75), (0, 0, 0.6), mat=leather, parent=body, bevel=0.03)
b.box("PouchFlap", (0.135, 0.095, 0.05), (0.2, -0.135, 0.81), (0, 0, 0.6), mat=boots, parent=body, bevel=0.02)
b.ball("PouchStud", 0.018, (0.165, -0.19, 0.79), mat=gold, parent=body)


# ---- Arms ----
def arm(side, name, swing):
    a = b.pivot(f"Arm{name}", (side * 0.29, 0, 1.1), parent=root, rotation=(swing, side * -0.22, 0))
    b.ball(f"Shoulder{name}", 0.11, (0, 0, 0), mat=shirt, parent=a)
    b.capsule(f"Sleeve{name}", 0.1, 0.12, (0, 0, -0.12), mat=shirt, parent=a, radius_bottom=0.105)
    b.cylinder(f"SleeveCuff{name}", 0.108, 0.07, (0, 0, -0.23), mat=shirt_dark, parent=a, radius_top=0.1, bevel=0.012)
    b.capsule(f"Forearm{name}", 0.07, 0.1, (0, 0, -0.33), mat=skin, parent=a)
    hand = b.pivot(f"Hand{name}", (0, 0, -0.45), parent=a)
    # A chunky cartoon hand: palm, four rounded fingers curled forward, and a thumb.
    b.ball(f"Palm{name}", 0.075, (0, 0, 0), scale=(0.85, 1, 1.0), mat=skin, parent=hand)
    for i, x in enumerate((-0.042, -0.014, 0.014, 0.042)):
        b.capsule(f"Finger{name}{i}", 0.024, 0.035, (x * 0.9, -0.045, -0.06 + abs(x) * 0.3),
                  (math.radians(-25), 0, 0), mat=skin, parent=hand)
    b.capsule(f"Thumb{name}", 0.025, 0.04, (side * -0.06, -0.04, -0.005), (math.radians(-40), side * 0.6, 0),
              mat=skin, parent=hand)
    return a, hand


arm_l, hand_l = arm(1, "L", -0.08)
arm_r, hand_r = arm(-1, "R", 0.12)

# ---- Sword (right hand, pointing down and a little forward) ----
sword = b.pivot("Sword", (0, -0.035, -0.02), parent=hand_r, rotation=(math.radians(158), 0, math.radians(-6)))
b.cylinder("Grip", 0.032, 0.17, (0, 0, 0), mat=wood, parent=sword, segments=16)
for i, z in enumerate((-0.05, 0.0, 0.05)):
    b.torus(f"Wrap{i}", 0.033, 0.009, (0, 0, z), mat=leather, parent=sword, segments=16, minor_segments=6)
b.ball("Pommel", 0.045, (0, 0, -0.11), mat=gold, parent=sword)
b.box("Guard", (0.3, 0.06, 0.055), (0, 0, 0.1), mat=gold, parent=sword, bevel=0.02)
b.ball("GuardGemL", 0.022, (0.15, 0, 0.1), mat=gold, parent=sword)
b.ball("GuardGemR", 0.022, (-0.15, 0, 0.1), mat=gold, parent=sword)
b.box("Blade", (0.1, 0.025, 0.58), (0, 0, 0.42), mat=steel, parent=sword, bevel=0.01, taper=(0.55, 0.8))
b.box("Fuller", (0.022, 0.03, 0.42), (0, 0, 0.38), mat=b.mat("Fuller", "#b8c6d6", roughness=0.25, metallic=0.9),
      parent=sword, bevel=0.005)

# ---- Head ----
head = b.pivot("Head", (0, 0, 1.18), parent=root, rotation=(0.04, 0, 0.06))
C = (0, 0, 0.31)
R = (0.36, 0.34, 0.33)
b.capsule("Neck", 0.075, 0.04, (0, 0, 0.03), mat=skin, parent=head)
b.ball("Skull", 1.0, C, scale=R, mat=skin, parent=head, segments=64, rings=32)
for side in (1, -1):
    loc, rot = b.on_surface(C, R, side * math.radians(88), math.radians(-2), push=-0.01)
    b.ball(f"Ear{side}", 0.07, loc, rot, scale=(0.6, 0.9, 1.0), mat=skin, parent=head)

# Eyes: big and friendly, with brows over them.
for side in (1, -1):
    loc, rot = b.on_surface(C, R, side * math.radians(22), math.radians(2), push=-0.025)
    b.ball(f"EyeWhite{side}", 0.072, loc, rot, scale=(0.85, 0.45, 1.15), mat=white, parent=head)
    loc, rot = b.on_surface(C, R, side * math.radians(21), math.radians(1), push=0.002)
    b.ball(f"Iris{side}", 0.048, loc, rot, scale=(0.9, 0.35, 1.1), mat=iris, parent=head)
    loc, rot = b.on_surface(C, R, side * math.radians(21), math.radians(1), push=0.012)
    b.ball(f"Pupil{side}", 0.028, loc, rot, scale=(0.9, 0.35, 1.1), mat=pupil, parent=head)
    loc, rot = b.on_surface(C, R, side * math.radians(18), math.radians(6), push=0.022)
    b.ball(f"Shine{side}", 0.012, loc, rot, mat=shine, parent=head)
    loc, rot = b.on_surface(C, R, side * math.radians(23), math.radians(19), push=0.008)
    brow = b.capsule(f"Brow{side}", 0.017, 0.07, loc, rot, mat=hair, parent=head)
    brow.rotation_euler.rotate_axis("Y", math.radians(90 + side * -12))
    loc, rot = b.on_surface(C, R, side * math.radians(38), math.radians(-14), push=-0.012)
    b.ball(f"Cheek{side}", 0.05, loc, rot, scale=(1.1, 0.3, 0.75), mat=cheek, parent=head)
loc, rot = b.on_surface(C, R, 0, math.radians(-9), push=0.0)
b.ball("Nose", 0.04, loc, rot, scale=(1.0, 0.8, 0.85), mat=skin, parent=head)
# A small smile.
loc, _ = b.on_surface(C, R, 0, math.radians(-22), push=-0.008)
b.torus("Smile", 0.07, 0.014, (loc[0], loc[1], loc[2] + 0.07), (math.pi / 2, 0, 0), mat=mouth, parent=head,
        arc=math.radians(80), segments=12, minor_segments=8)

# Hair: a smooth cap over the top and back, covered in soft, chunky clumps that taper to points
# and sweep toward Bobert's left, with a big swoopy fringe over the forehead.
HC, HR = (0, 0.05, 0.372), (0.372, 0.355, 0.332)
b.ball("HairCap", 1.0, HC, scale=HR, mat=hair, parent=head, segments=64, rings=32)
r = b.rng(7)
rows = [  # (elevation, how many around, clump size)
    (1.25, 3, 0.085), (0.9, 9, 0.09), (0.55, 11, 0.085), (0.2, 9, 0.08), (-0.15, 7, 0.07),
]
for row, (el, count, size) in enumerate(rows):
    for i in range(count):
        az = 2 * math.pi * (i + 0.5 * (row % 2)) / count
        az = math.atan2(math.sin(az), math.cos(az))
        if abs(az) < 1.15 and el < 0.75:
            continue  # leave the face clear
        if abs(az) < 0.9 and el < 0.95:
            continue  # the fringe covers this bit
        loc, rot = b.on_surface(HC, HR, az, el, push=0.005)
        c = b.capsule(f"Clump{row}_{i}", size, size * 1.6, loc, rot, mat=hair, parent=head,
                      radius_bottom=size * 0.25, scale=(1.0, 0.55, 1.0), segments=16, rings=8)
        c.rotation_euler.rotate_axis("Y", math.radians(-25) + r.uniform(-0.25, 0.25))  # sweep sideways
        c.rotation_euler.rotate_axis("X", math.radians(-32))  # tips lift off the head
# Spiky tufts standing up off the crown, flicking back.
for i, (az, el, size, lean) in enumerate(((-0.5, 1.15, 0.085, 20), (0.1, 1.3, 0.095, -10), (0.7, 1.1, 0.08, -30),
                                          (2.6, 1.0, 0.085, 25), (-2.5, 1.05, 0.08, -25), (3.1, 0.75, 0.08, 0))):
    loc, rot = b.on_surface(HC, HR, az, el, push=0.0)
    t = b.capsule(f"Spike{i}", size, size * 1.9, loc, rot, mat=hair, parent=head, radius_bottom=size * 0.18,
                  scale=(1.0, 0.55, 1.0), segments=16, rings=8)
    t.rotation_euler.rotate_axis("Y", math.radians(lean))
    t.rotation_euler.rotate_axis("X", math.radians(-55))
# Fringe: big clumps swept across the forehead.
for i, (az, el, size, sweep) in enumerate(((-0.62, 0.62, 0.1, -55), (-0.25, 0.66, 0.115, -62), (0.15, 0.66, 0.11, -68),
                                           (0.55, 0.6, 0.095, -72), (0.0, 0.92, 0.11, -45))):
    loc, rot = b.on_surface(HC, HR, az, el, push=0.035)
    f = b.capsule(f"Fringe{i}", size, size * 1.7, loc, rot, mat=hair, parent=head, radius_bottom=size * 0.2,
                  scale=(1.0, 0.5, 1.0), segments=16, rings=8)
    f.rotation_euler.rotate_axis("Y", math.radians(sweep))
    f.rotation_euler.rotate_axis("X", math.radians(-12))

# ---- Studio and output ----
b.studio(background="#ffd9ec", ground="#b9f5d8", view="Standard", key=3.2, fill=1.0, rim=3.0, sun=2.2)
b.render_all(ID)
b.export(ID)
