#!/usr/bin/env python3
"""
Beispielanordnung der Strandobjekte auf der echten Insel.

Die Objekte liegen im selben Massstab wie die Pflanzen (16 px pro Meter am
Boden, 10 px pro Meter Hoehe) und werden in Originalgroesse auf den Hintergrund
gesetzt — erst danach wird das ganze Bild fuer die Vorschau hochskaliert.

Zwei Regeln, die die erste Fassung verletzt hat:
  * Massstab: ein ausgewachsener Laubbaum ist 26x34 px. Sandburg, Muscheln oder
    Liegestuehle duerfen nicht groesser sein als ein Baum (siehe beach.SCALE).
  * Verteilung: die Insel hat mehrere Buchten. Jede Gruppe bekommt ihre eigene,
    statt alles an einen Strand zu stellen.

Aufruf aus dem Repo-Wurzelverzeichnis:
    python3 island/pixel/scene.py 5
Schreibt island/pixel/previews/scene-<stufe>{,-crop,-details}.png.
"""
import functools, json, math, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "previews")
sys.path.insert(0, HERE)
import ocean

STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 5

spec = ocean.STAGES[STAGE]
zoom = spec["d"]
ocean.SEA_SEED = 700 + STAGE * 13
ocean.SWELL_PHASE = ocean.rnd(ocean.SEA_SEED, 99) * 6.283
ocean.W = W = ocean.DEVICE_W // zoom
ocean.H = H = round(ocean.DEVICE_H / zoom)
ocean.HORIZON = round(H * 0.205)
sc = spec["rx"] / 92.0
isl = ocean.Island(W / 2, round(H * 0.53), spec["rx"],
                   ocean.BEACH_AT_92 * sc, ocean.SHALLOW_AT_92 * sc, spec["seed"])
ocean.ISLAND_FOR_WATER = isl

img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
px = img.load()
ocean.draw_sky(px); ocean.draw_clouds(px); ocean.draw_sea(px)
ocean.draw_island(px, isl)
rocks = ocean.draw_details(px, isl)
ocean.draw_waves(px, isl)

# ---------------------------------------------------------------- Strand
draws = []   # (y, image, x, y) -> am Ende gemeinsam nach Tiefe sortiert
taken = []
beach_dir = os.path.join(HERE, "beach")
bm = json.load(open(os.path.join(beach_dir, "manifest.json")))
final = {}
for e in bm:
    if e["level"] == e["stages"]:
        final[e["key"]] = e

def sand_at(deg):
    """Breite des Sandbands in Polar-Einheiten, 0 wenn Fels."""
    a = math.radians(deg)
    rocky, width = isl.coast(a)
    if rocky > 0.25:
        return 0.0
    return isl.beach * width

@functools.lru_cache(maxsize=None)
def ground(x, y):
    """'sand', 'grass' oder 'water' unter diesem Bildpunkt.

    Gepuffert: die Platzsuche fragt dieselben Punkte fuer jede Wachstumsstufe
    erneut ab, und `beach_width` ist teuer.
    """
    r, a = isl.polar(x, y)
    edge = isl.radius(a)
    if r >= edge:
        return "water"
    rocky, _ = isl.coast(a)
    bw = isl.beach_width(x, y, a)
    rock_band = (2.5 + 5.5 * rocky) if rocky > 0.25 else 0.0
    return "sand" if r >= edge - max(bw, rock_band) and rocky <= 0.25 else "grass"


def foot_pixels(sprite, anchor):
    """Die Pixel, mit denen ein Sprite den Boden beruehrt.

    Nicht die Bounding-Box: ein Sonnenschirm ist oben breit und unten schmal.
    Genommen wird das untere Drittel der undurchsichtigen Pixel, relativ zum
    Anker. Nur diese muessen auf Land stehen — was ein Objekt weiter oben vor
    dem Wasser verdeckt, ist in der 2:1-Ansicht richtig so.
    """
    alpha = sprite.split()[3].load()
    rows = {}
    for py in range(sprite.height):
        row = [pxx for pxx in range(sprite.width) if alpha[pxx, py] > 40]
        if row:
            rows[py] = row
    if not rows:
        return [(0, 0)]
    bottom = max(rows)
    cut = bottom - max(2, round(len(rows) * 0.3))
    return [(pxx - anchor[0], py - anchor[1])
            for py, row in rows.items() if py >= cut for pxx in row]


def footing(x, y, foot):
    """Steht der Fuss des Sprites vollstaendig auf Sand?

    Strandobjekte gehoeren auf den Strand — nicht halb ins Gras und schon gar
    nicht ueber die Wasserkante. Das ist eine harte Bedingung; deshalb sind die
    Sprites ueber `beach.SCALE` so bemessen, dass sie auf das schmale Sandband
    der Insel passen.
    """
    sand = sum(ground(x + du, y + dv) == "sand" for du, dv in foot)
    return sand == len(foot), sand / max(1, len(foot))


def spot(deg, frac):
    a = math.radians(deg)
    edge = isl.radius(a)
    bw = max(2.0, sand_at(deg))
    r = edge - bw * frac
    return round(isl.cx + r * math.cos(a)), round(isl.cy + r * math.sin(a) / 2)

# Pro Strand eine glaubwuerdige Gruppe. deg: 0 rechts, 90 vorn, 180 links, 270 hinten.
# Die Insel hat fuenf sandige Abschnitte, aber nur drei sind breit genug: die
# Bucht rechts (341-22 Grad), die Bucht vorne links (125-157) und die Bucht
# hinten (268-299). Bei den beiden schmalen Streifen — vorne rechts und links
# hinten — ist das Sandband nur 7 bis 10 px breit; dort passt kein einziges
# Objekt ganz auf den Sand. Jede Bucht bekommt eine Gruppe, die zusammengehoert.
# 0 Grad ist rechts, 90 vorn, 180 links, 270 hinten.
PLAN = [
    ("beach_bar",      (344, 2),   0.80),   # Bucht rechts, oben am Gras
    ("shells",         (6, 24),    0.30),   # gleiche Bucht, unten am Wasser
    ("volleyball_net", (144, 157), 0.60),   # Bucht vorne links, breitester Sand
    ("surfboards",     (134, 143), 0.45),   # gleiche Bucht, naeher am Wasser
    ("campfire",       (125, 133), 0.55),   # gleiche Bucht, am Ende der Landzunge
    ("hammock",        (270, 285), 0.70),   # Bucht hinten, oben am Gras
    ("deck_chairs",    (286, 299), 0.55),   # gleiche Bucht, daneben
    ("sandcastle",     (0, 360),   0.35),   # zuletzt, in die groesste verbliebene Luecke
]


BAYS = [("Bucht rechts", 341, 24), ("Bucht vorne links", 125, 157), ("Bucht hinten", 268, 299)]
by_key = {}
for entry in bm:
    by_key.setdefault(entry["key"], []).append(entry)

placed = []
landed = []
for key, (lo, hi), frac in PLAN:
    # Auf einer kleinen Insel ist der Strand kurz. Statt abzubrechen wird die
    # hoechste Wachstumsstufe genommen, die dort noch ganz auf den Sand passt —
    # die Insel waechst, die Objekte wachsen mit ihr.
    found = None
    fit_anywhere = False
    for e in sorted(by_key[key], key=lambda x: -x["level"]):
        sprite = Image.open(os.path.join(beach_dir, e["file"])).convert("RGBA")
        foot = foot_pixels(sprite, e["anchorPx"])
        for lo_try, hi_try in ((lo, hi), (0, 360)):
            span_deg = hi_try - lo_try if hi_try > lo_try else hi_try + 360 - lo_try
            best = None
            for step in range(0, span_deg * 4 + 1):
                deg = lo_try + step / 4
                bw = sand_at(deg)
                if bw < 3.0:
                    continue
                # Der Abstand zur Wasserlinie wird ganz durchgesucht, nicht nur um
                # den Wunschwert herum: an einer Bucht liegt der einzige Platz, auf
                # dem der Fuss ganz auf Sand steht, oft dicht am Wasser.
                for fi in range(2, 21):
                    want = fi / 20
                    x, y = spot(deg, want)
                    dry, on_sand = footing(x, y, foot)
                    if not dry:
                        continue
                    # Nichts darf hinter einem anderen Objekt verschwinden: zwei
                    # Sprites muessen seitlich mindestens 90 % ihrer mittleren
                    # Breite auseinanderliegen.
                    fit_anywhere = True
                    clear, gap = True, 1e9
                    for ox, oy, ow in placed:
                        if abs(x - ox) < 0.9 * (e["size"][0] + ow) / 2 and abs(y - oy) < 14:
                            clear = False
                            break
                        gap = min(gap, math.hypot(x - ox, (y - oy) * 1.6))
                    if not clear:
                        continue
                    score = min(gap, 70) - abs(want - frac) * 20
                    if best is None or score > best[0]:
                        best = (score, deg, x, y, bw)
            if best is not None:
                break
        if best is not None:
            found = (e, sprite, foot, best)
            break
    if found is None:
        reason = ("kein Platz mehr neben den anderen Objekten"
                  if fit_anywhere else
                  "passt hier auch in der ersten Stufe nicht ganz auf den Sand")
        print(f"{key:15} uebersprungen — {reason}")
        continue
    e, sprite, foot, (_, deg, x, y, bw) = found
    _, sand_final = footing(x, y, foot)
    placed.append((x, y, e["size"][0]))
    landed.append((key, e["label"], e["level"], e["stages"], deg, x, y))
    # Platz freihalten: nicht nur der Standpunkt, sondern auch das Stueck Wiese
    # davor. Ein Baum, der weiter vorne steht, wird spaeter darueber gezeichnet
    # und wuerde das Objekt sonst verdecken — die Krone ist bis zu 67 px hoch.
    taken.append((x, y))
    for dx in range(-e["size"][0] // 2 - 6, e["size"][0] // 2 + 7, 6):
        for dy in range(0, 49, 8):
            taken.append((x + dx, y + dy))
    draws.append((y, sprite, x - e["anchorPx"][0], y - e["anchorPx"][1]))
    print(f"{key:15} Stufe {e['level']:2}/{e['stages']:2}  {deg:6.1f}°  ({x:3},{y:3})  "
          f"Sand {bw:4.1f}px  {e['size']}  Fuss auf Sand {sand_final:.0%}")

# ---------------------------------------------------------------- Pflanzen
plant_dir = os.path.join(HERE, "plants")
pm = {e["file"]: e for e in json.load(open(os.path.join(plant_dir, "manifest.json")))}
wanted = [("world_tree_10.png", 3), ("leafy_tree_10.png", 1), ("leafy_tree_09.png", 1),
          ("leafy_tree_08.png", 1), ("fir_tree_10.png", 1), ("fir_tree_08.png", 1),
          ("fruit_tree_10.png", 1), ("fruit_tree_08.png", 1), ("palm_tree_10.png", 1),
          ("palm_tree_08.png", 1), ("bush_10.png", 2), ("bush_08.png", 2), ("bush_05.png", 1),
          ("flower_bed_08.png", 3), ("grass_tufts_10.png", 1), ("grass_tufts_07.png", 1),
          ("grass_tufts_05.png", 1), ("leafy_tree_06.png", 1), ("fir_tree_05.png", 1),
          ("leafy_tree_04.png", 1)]
copies = max(1, round((isl.rx / 92.0) ** 2 * 0.8))
wanted = wanted * copies
span = int(isl.rx / 4) + 6
cands = []
for i in range(-span, span + 1):
    for j in range(-span, span + 1):
        cands.append((ocean.rnd(i, j, 21), round(isl.cx + (i - j) * 4), round(isl.cy - (i + j) * 2)))
cands.sort()

for name, cells in wanted:
    for _, x, y in cands:
        if not ocean.grass_free(isl, x, y, cells):
            continue
        if any(abs(x - ox) < 14 + 4 * cells and abs(y - oy) < 9 + 2 * cells for ox, oy in taken):
            continue
        if any(abs(x - rx) < 6 and abs(y - ry) < 4 for rx, ry, _ in rocks):
            continue
        taken.append((x, y))
        e = pm[name]
        draws.append((y, Image.open(os.path.join(plant_dir, name)).convert("RGBA"),
                      x - e["anchorPx"][0], y - e["anchorPx"][1]))
        break
plant_count = len(draws)

draws.sort(key=lambda d: d[0])
for _, sprite, x, y in draws:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    layer.paste(sprite, (x, y))
    img.alpha_composite(layer)

img.save(os.path.join(OUT, f"scene-{STAGE}-1x.png"))
big = img.resize((W * zoom, H * zoom), Image.NEAREST)
big.save(os.path.join(OUT, f"scene-{STAGE}.png"))


try:
    f1 = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
    f2 = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
except OSError:
    f1 = f2 = ImageFont.load_default()


# Ein Detailausschnitt je Bucht, damit die Objekte einzeln lesbar sind
def bay_of(deg):
    for index, (_, lo, hi) in enumerate(BAYS):
        span = hi - lo if hi > lo else hi + 360 - lo
        if ((deg - lo) % 360) <= span:
            return index
    return None

tiles = []
summary = []
for index, (bay_name, _, _) in enumerate(BAYS):
    members = [m for m in landed if bay_of(m[4]) == index]
    if not members:
        continue
    xs = [m[5] for m in members]
    ys = [m[6] for m in members]
    piece = img.crop((max(0, min(xs) - 30), max(0, min(ys) - 40),
                      min(W, max(xs) + 30), min(H, max(ys) + 14)))
    def name_of(m):
        return m[1] if m[2] == m[3] else f"{m[1]} (Stufe {m[2]}/{m[3]})"
    title = f"{bay_name}: " + ", ".join(name_of(m) for m in members)
    tiles.append((title, piece.resize((piece.width * 4, piece.height * 4), Image.NEAREST)))
    summary.append(f"{bay_name.split()[-1]}: " + ", ".join(name_of(m) for m in members))
pad = 18
probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
# Die Spalte ist so breit wie das Bild oder seine Unterschrift — je nachdem,
# was breiter ist. Sonst steht der letzte Titel halb ausserhalb.
columns = [max(tile.width, round(probe.textlength(title, font=f2)) + 8)
           for title, tile in tiles]
strip = Image.new("RGBA", (sum(c + pad for c in columns) + pad,
                           max(t.height for _, t in tiles) + pad * 2 + 30), (246, 243, 236, 255))
d2 = ImageDraw.Draw(strip)
x = pad
for (title, tile), column in zip(tiles, columns):
    strip.alpha_composite(tile, (x, pad))
    d2.text((x, pad + tile.height + 6), title, fill=(50, 50, 50, 255), font=f2)
    x += column + pad

# Ausschnitt um die Insel, mit Bildunterschrift
pad = round(isl.rx * 0.42)
box = (max(0, round(isl.cx - isl.rx - pad)) * zoom, max(0, round(isl.cy - isl.rx / 2 - pad * 1.5)) * zoom,
       min(W, round(isl.cx + isl.rx + pad)) * zoom, min(H, round(isl.cy + isl.rx / 2 + pad)) * zoom)
crop = big.crop(box)
sheet = Image.new("RGBA", (crop.width, crop.height + 64), (246, 243, 236, 255))
sheet.paste(crop, (0, 0))
d = ImageDraw.Draw(sheet)
m = 2 * spec["rx"] / ocean.PX_PER_M
d.text((14, crop.height + 8), f"Insel Stufe {STAGE} · {m:.0f} m · {len(landed)} Strandobjekte",
       fill=(30, 30, 30, 255), font=f1)
caption = " · ".join(summary)
while probe.textlength(caption, font=f2) > crop.width - 28 and " · " in caption:
    caption = caption.rsplit(" · ", 1)[0] + " …"
d.text((14, crop.height + 40), caption, fill=(90, 90, 90, 255), font=f2)
sheet.save(os.path.join(OUT, f"scene-{STAGE}-crop.png"))

strip.save(os.path.join(OUT, f"scene-{STAGE}-details.png"))
print("Pflanzen:", plant_count, "| Datei:", os.path.join(OUT, f"scene-{STAGE}-crop.png"))
