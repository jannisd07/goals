#!/usr/bin/env python3
"""
Show what the app will draw: whole islands, built by the app's own code.

Nothing here decides where anything stands. The TypeScript in src/lib is
compiled and asked for the scene, so a preview that looks wrong means the app
looks wrong too — the same trick that caught a rounding bug in the water layer.

Usage, from the repo root:
    python3 island/pixel/preview_islands.py [cases]
Writes island/pixel/previews/islands-<n>.png and a sheet of all of them.
"""

import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, "previews")

SCENE_JS = r"""
const scene = require("DIST/src/lib/islandScene.js");
const art = require("DIST/src/components/island/islandSprites.js");
const grow = require("DIST/src/lib/growRewards.js");

// A small deterministic random, so a case can be looked at again.
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * An island somewhere between empty and finished: `fill` is how far along.
 * Built the way a player builds one — one reward at a time, never taking an
 * object the island has no room for — so the previews cannot show a state the
 * app would never reach.
 */
function island(seed, fill) {
  const random = rng(seed);
  const out = {};
  const target = Math.round(scene.TOTAL_GROWTH_LEVELS * fill);
  for (let guard = 0; guard < 400 && scene.totalGrowthLevels(out) < target; guard += 1) {
    const stage = scene.islandStageFor(out);
    const open = [];
    for (const category of ["plant", "building", "water", "beach"]) {
      const limit = scene.categoryLimit(stage, category);
      for (const option of grow.growOptions(category, 3, out, limit)) {
        if (!option.maxed && !option.locked) open.push(option);
      }
    }
    if (open.length === 0) break;
    const pick = open[Math.floor(random() * open.length)];
    out[pick.object.key] = { level: pick.toLevel };
  }
  return out;
}

const milestones = require("DIST/src/lib/milestones.js");
const cases = JSON.parse(process.argv[2]);
const out = [];
for (const [seed, fill, withLandmarks] of cases) {
  const objects = island(seed, fill);
  if (withLandmarks) {
    // The hour milestones stand next to the session objects; at fill 1 every
    // one of them has been earned.
    for (const earned of milestones.earnedMilestones(100000 * fill)) {
      objects[earned.objectKey] = { level: earned.tier };
    }
  }
  const stage = scene.islandStageFor(objects);
  const pieces = scene.islandPieces(stage, objects, {}, seed).map((piece) => {
    const sprite = art.islandSprite(piece.sprite);
    return sprite
      ? {
          x: piece.x, y: piece.y, ax: sprite.ax, ay: sprite.ay,
          rows: sprite.rows, colors: sprite.colors, shadow: sprite.shadow,
        }
      : null;
  });
  out.push({
    seed, stage,
    levels: scene.totalGrowthLevels(objects),
    objects: Object.keys(objects).length,
    missing: pieces.filter((piece) => piece === null).length,
    pieces: pieces.filter(Boolean),
  });
}
process.stdout.write(JSON.stringify(out));
"""


LIMITS_JS = r"""
const P = require("DIST/src/lib/islandPlacement.js");
const L = require("DIST/src/lib/islandLand.js");
const G = require("DIST/src/lib/growRewards.js");
const M = require("DIST/src/lib/milestones.js");

// The hour landmarks are not part of any category and arrive whatever else is
// on the island, so they take their room first and the categories get the rest.
const LANDMARKS = M.earnedMilestones(1e6).map((earned) => earned.objectKey);

const byCategory = {};
for (const category of ["plant", "building", "beach"]) {
  byCategory[category] = G.GROW_OBJECTS[category]
    .map((object) => object.key)
    .filter((key) => L.LAND_OBJECTS[key]);
}
// the worst case is the biggest objects of a category
const biggest = (keys, count) =>
  [...keys].sort((a, b) => L.LAND_OBJECTS[b].cells - L.LAND_OBJECTS[a].cells).slice(0, count);

function shuffle(list, seed) {
  const out = [...list];
  let state = seed >>> 0;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [out[index], out[other]] = [out[other], out[index]];
  }
  return out;
}

const TRIES = [1, 7, 42, 99, 2024, 31337, 555, 8080];
const holds = (stage, keys) =>
  TRIES.every((seed) => {
    const all = [...LANDMARKS, ...shuffle(keys, seed)];
    return P.capacityFor(stage, all, seed) === all.length;
  });

const table = {};
for (const stage of [1, 2, 3, 4, 5]) {
  const limits = {
    plant: byCategory.plant.length,
    building: byCategory.building.length,
    beach: byCategory.beach.length,
  };
  while (limits.beach > 0 && !holds(stage, biggest(byCategory.beach, limits.beach))) {
    limits.beach -= 1;
  }
  for (let guard = 0; guard < 40; guard += 1) {
    const grass = [
      ...biggest(byCategory.plant, limits.plant),
      ...biggest(byCategory.building, limits.building),
    ];
    if (holds(stage, grass)) break;
    if (limits.building >= limits.plant) limits.building -= 1;
    else limits.plant -= 1;
  }
  table[stage] = limits;
}
process.stdout.write(JSON.stringify(table));
"""


def measure_limits():
    """Re-measure how much of each category fits, with the app's own placement."""
    _, run = compile_scene()
    table = json.loads(run(LIMITS_JS))
    print("  Stufe  Pflanzen  Gebäude  Strand")
    for stage, limits in sorted(table.items()):
        print(
            f"  {stage:>5}  {limits['plant']:>8}  {limits['building']:>7}  {limits['beach']:>6}"
        )
    print()
    print("So viele passen ohne Gedränge nebeneinander, mit allen Landmarken und")
    print("in voller Größe. Die Limits in ISLAND_CATEGORY_LIMITS dürfen höher sein:")
    print("seit `resolveSpots` im Notfall enger stellt, geht kein Objekt verloren —")
    print("diese Zahlen sagen nur, ab wann es eng wird.")


def compile_scene():
    """Compile the app's own code, so the preview cannot drift from the app."""
    dist = tempfile.mkdtemp(prefix="island-scene-")
    subprocess.run(
        [
            "npx", "tsc", "--outDir", dist, "--module", "commonjs", "--target", "ES2022",
            "--moduleResolution", "node", "--skipLibCheck", "--rootDir", ".",
            "src/components/island/islandSprites.ts", "src/lib/islandScene.ts",
        ],
        cwd=ROOT, check=True,
    )

    def run(source, *args):
        script = os.path.join(dist, "run.js")
        with open(script, "w", encoding="utf-8") as handle:
            handle.write(source.replace("DIST", dist))
        done = subprocess.run(
            ["node", script, *args], cwd=ROOT, check=True, capture_output=True, text=True
        )
        return done.stdout

    return dist, run


def build_scene(cases):
    """Let the app lay out every case."""
    _, run = compile_scene()
    return json.loads(run(SCENE_JS, json.dumps(cases)))


def draw(case, index):
    stage = case["stage"]
    scene = Image.open(os.path.join(HERE, "backgrounds", f"home-{stage}.png")).convert("RGBA")
    for piece in case["pieces"]:
        layer = Image.new("RGBA", scene.size, (0, 0, 0, 0))
        for row_index, row in enumerate(piece["rows"]):
            for column, char in enumerate(row):
                if char == ".":
                    continue
                if char == piece["shadow"]:
                    color = (0, 0, 0, 64)
                else:
                    hex_color = piece["colors"].get(char)
                    if hex_color is None:
                        continue
                    color = (*bytes.fromhex(hex_color[1:]), 255)
                x = round(piece["x"]) - piece["ax"] + column
                y = round(piece["y"]) - piece["ay"] + row_index
                if 0 <= x < scene.width and 0 <= y < scene.height:
                    layer.putpixel((x, y), color)
        scene = Image.alpha_composite(scene, layer)
    zoom = {1: 8, 2: 6, 3: 5, 4: 4, 5: 3}[stage]
    scene = scene.resize((scene.width * zoom, scene.height * zoom), Image.NEAREST)
    path = os.path.join(OUT, f"islands-{index}.png")
    scene.save(path)
    return scene, path


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "limits":
        measure_limits()
        return
    if len(sys.argv) > 2 and sys.argv[1] == "vary":
        # the same island, different seeds — shows how much the placement moves
        fill = float(sys.argv[2])
        cases = [(int(seed), fill) for seed in sys.argv[3:]] or [(7, fill), (23, fill), (91, fill)]
    else:
        count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
        # from nearly empty to finished, so the sheet shows the whole range
        fills = [0.04, 0.15, 0.35, 0.62, 1.0][:count]
        cases = [(101 + index * 37, fill, True) for index, fill in enumerate(fills)]
    scenes = build_scene(cases)

    images = []
    for index, case in enumerate(scenes, start=1):
        image, path = draw(case, index)
        images.append(image)
        print(
            f"  Insel {index}: Stufe {case['stage']}, {case['objects']} Objekte, "
            f"{case['levels']} Stufen, {len(case['pieces'])} Teile"
            + (f", {case['missing']} ohne Bild" if case["missing"] else "")
        )
        print("   ", path)

    height = 900
    scaled = [
        image.resize((round(image.width * height / image.height), height), Image.LANCZOS)
        for image in images
    ]
    gap = 16
    sheet = Image.new(
        "RGB", (sum(i.width for i in scaled) + gap * (len(scaled) + 1), height + 2 * gap),
        (244, 241, 234),
    )
    x = gap
    for image in scaled:
        sheet.paste(image, (x, gap))
        x += image.width + gap
    sheet_path = os.path.join(OUT, "islands-sheet.png")
    sheet.save(sheet_path)
    print("Übersicht:", sheet_path)


if __name__ == "__main__":
    main()
