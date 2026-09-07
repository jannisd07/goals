"""Vier Inselideen (A–D) ohne Bebauung: ein Vergleichs-Sheet auf App-Hintergrund
plus je ein transparenter Einzelrender.

Aufruf:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python island/blender/build_islands.py -- --samples 64
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from islandlib import builders as B  # noqa: E402
from islandlib import export as X  # noqa: E402
from islandlib import scene as SC  # noqa: E402
from islandlib import style as S  # noqa: E402

POSITIONS = {"A": (-10.0, 0.0), "B": (0.0, 10.0), "C": (0.0, -10.0), "D": (10.0, 0.0)}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=os.path.join(HERE, "out", "islands"))
    p.add_argument("--samples", type=int, default=S.RENDER_SAMPLES)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--sheet-only", action="store_true")
    p.add_argument("--sheet-ppm", type=int, default=44)
    return p.parse_args(argv)


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    scene = SC.reset_scene()
    SC.setup_render(scene, args.samples)
    SC.setup_world(scene)
    rig = SC.collection("Rig")
    land = SC.collection("Islands")
    SC.add_sun(rig)
    cam = SC.add_camera(scene, rig)

    islands = {}
    for key in "ABCD":
        spec = B.SHAPES[key]
        cells = B.island_mask(key, seed=args.seed)
        obj = B.build_island(land, cells, name=f"Island_{key}", depth=spec["depth"],
                             strata=spec["strata"], seed=args.seed)
        obj.location = (POSITIONS[key][0], POSITIONS[key][1], 0.0)
        islands[key] = (obj, cells, spec)
        print(f"[islands] {key} {spec['label']}: {len(cells)} Zellen")

    # --- Sheet: alle vier auf App-Hintergrund, mit Buchstaben ---
    preview = SC.collection("Preview")
    backdrop = SC.add_backdrop(preview)
    labels = []
    for key, (obj, cells, spec) in islands.items():
        px, py = POSITIONS[key]
        labels.append(SC.add_label(preview, key, (px - 3.6, py + 3.6, 0.6), size=1.6))
    pts = []
    for key, (obj, cells, spec) in islands.items():
        pts += X.island_points(cells, spec["depth"], (POSITIONS[key][0], POSITIONS[key][1], 0.0))
        pts.append((POSITIONS[key][0] - 3.6, POSITIONS[key][1] + 3.6, 2.2))
    w, h, fx, fy = X.fit_frame(pts, margin=1.2)
    SC.frame_camera(scene, cam, w, h, anchor_fraction=fy, anchor_fraction_x=fx, px_per_m=args.sheet_ppm)
    scene.render.film_transparent = False
    X.set_render_visibility([o for o, _, _ in islands.values()] + labels + [backdrop])
    X.render_png(scene, os.path.join(args.out, "islands_sheet.png"))

    manifest = {"style_version": S.STYLE_VERSION, "px_per_m": S.PX_PER_M, "islands": {}}
    if not args.sheet_only:
        scene.render.film_transparent = True
        for key, (obj, cells, spec) in islands.items():
            obj.location = (0.0, 0.0, 0.0)
            w, h, fx, fy = X.fit_frame(X.island_points(cells, spec["depth"]), margin=0.5)
            SC.frame_camera(scene, cam, w, h, anchor_fraction=fy, anchor_fraction_x=fx)
            X.set_render_visibility([obj])
            fname = f"island_{key}.png"
            X.render_png(scene, os.path.join(args.out, fname))
            manifest["islands"][key] = {
                "file": fname,
                "label": spec["label"],
                "title": spec["title"],
                "cells": sorted(cells),
                "cell_count": len(cells),
                "depth": spec["depth"],
                "width": scene.render.resolution_x,
                "height": scene.render.resolution_y,
                "anchor": X.anchor_px(scene, cam),
            }
            obj.location = (POSITIONS[key][0], POSITIONS[key][1], 0.0)
        with open(os.path.join(args.out, "islands_manifest.json"), "w") as fh:
            json.dump(manifest, fh, indent=2)

    X.set_render_visibility([o for o, _, _ in islands.values()])
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.out, "islands.blend"))
    print("[islands] fertig:", args.out)


if __name__ == "__main__":
    main()
