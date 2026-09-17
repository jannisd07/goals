#!/usr/bin/env python3
"""
The flags the flagpole can fly.

Thirty of them, drawn at 16 x 10 pixels. That is small, and it decides the whole
approach: at this size a flag is read by its **layout and its colours**, never by
its detail. A coat of arms becomes a three-pixel mark, a crescent a curve of five
pixels. What has to survive is the thing you recognise across a room — the stripe
direction, the cross, the disc, the canton.

Most flags are stripes, a cross or a disc, so those are helpers rather than
hand-drawn pixels: less to get wrong, and every tricolour is then exactly as wide
as every other. Only the ones that are genuinely a picture — the Union Jack, the
US canton, Brazil, Korea — are written out row by row.

One character per pixel, keyed in `PALETTE`. Used by `special.py` to render one
flagpole sprite per flag.
"""

W, H = 16, 10

# Flag colours, flat on purpose: shading a 16 px flag turns two neighbouring
# reds into mud. The only depth comes from the wave in the cloth.
PALETTE = {
    "w": "#F4F4F2",  # white
    "k": "#1C1C1C",  # black
    "r": "#D42B32",  # red
    "R": "#A31620",  # dark red
    "b": "#2B4EA2",  # blue
    "B": "#16306B",  # navy
    "c": "#6CA9DE",  # light blue
    "y": "#F2C230",  # gold
    "o": "#E8792B",  # orange
    "g": "#188A4A",  # green
    "G": "#0E5C33",  # dark green
    "n": "#7B6A52",  # brown, for emblems
}

Rows = list


def _blank(fill: str) -> Rows:
    return [fill * W for _ in range(H)]


def _put(rows: Rows, x: int, y: int, char: str) -> None:
    if 0 <= x < W and 0 <= y < H:
        rows[y] = rows[y][:x] + char + rows[y][x + 1 :]


def hstripes(*colors: str) -> Rows:
    """Horizontal bands, split as evenly as ten rows allow."""
    rows = []
    for index in range(H):
        rows.append(colors[min(len(colors) - 1, index * len(colors) // H)] * W)
    return rows


def bands(pairs) -> Rows:
    """Horizontal bands with weights, for flags whose middle is wider (Spain)."""
    total = sum(weight for _, weight in pairs)
    rows, filled = [], 0
    for index, (colour, weight) in enumerate(pairs):
        height = H - filled if index == len(pairs) - 1 else round(H * weight / total)
        rows.extend([colour * W] * height)
        filled += height
    return rows[:H]


def vstripes(*colors: str) -> Rows:
    """Vertical bands."""
    line = "".join(colors[min(len(colors) - 1, x * len(colors) // W)] for x in range(W))
    return [line for _ in range(H)]


def nordic(field: str, cross: str, inner: str | None = None) -> Rows:
    """The Scandinavian cross: off-centre towards the hoist, as on the real thing."""
    rows = _blank(field)
    bar_y, bar_x = 4, 5
    for x in range(W):
        _put(rows, x, bar_y, cross)
        _put(rows, x, bar_y + 1, cross)
    for y in range(H):
        _put(rows, bar_x, y, cross)
        _put(rows, bar_x + 1, y, cross)
    if inner:
        for x in range(W):
            _put(rows, x, bar_y, inner) if False else None
    return rows


def nordic_double(field: str, outer: str, inner: str) -> Rows:
    """Norway and Iceland: a thin cross inside a thicker one."""
    rows = nordic(field, outer)
    bar_y, bar_x = 4, 5
    for x in range(W):
        _put(rows, x, bar_y, inner)
    for y in range(H):
        _put(rows, bar_x, y, inner)
    return rows


def disc(field: str, colour: str, cx: int = W // 2, radius: float = 2.6) -> Rows:
    """A round emblem in the middle, the smallest shape that still reads as round."""
    rows = _blank(field)
    cy = H // 2
    for y in range(H):
        for x in range(W):
            # x is halved because a pixel is wider than it is tall at this size.
            if ((x - cx + 0.5) * 0.62) ** 2 + (y - cy + 0.5) ** 2 <= radius**2:
                _put(rows, x, y, colour)
    return rows


def with_disc(rows: Rows, colour: str, cx: int, cy: int, radius: float = 2.2) -> Rows:
    for y in range(H):
        for x in range(W):
            if ((x - cx + 0.5) * 0.62) ** 2 + (y - cy + 0.5) ** 2 <= radius**2:
                _put(rows, x, y, colour)
    return rows


def mark(rows: Rows, colour: str, points) -> Rows:
    """A few pixels of emblem — a coat of arms at this size is a smudge, honestly."""
    for x, y in points:
        _put(rows, x, y, colour)
    return rows


def _rows(*lines: str) -> Rows:
    assert len(lines) == H, f"a flag needs {H} rows, got {len(lines)}"
    for line in lines:
        assert len(line) == W, f"a row needs {W} pixels, got {len(line)}: {line}"
    return list(lines)


# The Union Jack. The first attempt scattered the diagonals as loose pixels and
# read as noise; this one draws each saltire arm as an unbroken two-pixel band
# that runs into the cross, with the red counterchange just inside it.
_UK = _rows(
    "wwrBBBwrrwBBBrww",
    "BBwwrBwrrwBrwwBB",
    "BBBBwwwrrwwwBBBB",
    "wwwwwwwrrwwwwwww",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "wwwwwwwrrwwwwwww",
    "BBBBwwwrrwwwBBBB",
    "BBwwrBwrrwBrwwBB",
    "wwrBBBwrrwBBBrww",
)

_US = _rows(
    "BBBBBBBrrrrrrrrr",
    "BwBwBwBwwwwwwwww",
    "BBBBBBBrrrrrrrrr",
    "BwBwBwBwwwwwwwww",
    "BBBBBBBrrrrrrrrr",
    "wwwwwwwwwwwwwwww",
    "rrrrrrrrrrrrrrrr",
    "wwwwwwwwwwwwwwww",
    "rrrrrrrrrrrrrrrr",
    "wwwwwwwwwwwwwwww",
)

# Brazil: a proper rhombus that comes to a point at all four corners, and a disc
# that is actually round. The old one was a blurred oval with a stray pixel in it.
_BR = _rows(
    "gggggggggggggggg",
    "ggggggyyyygggggg",
    "ggggyyyyyyyygggg",
    "gggyyyybbyyyyggg",
    "ggyyyybbbbyyyygg",
    "ggyyyybbbbyyyygg",
    "gggyyyybbyyyyggg",
    "ggggyyyyyyyygggg",
    "ggggggyyyygggggg",
    "gggggggggggggggg",
)

_KR = _rows(
    "wwwwwwwwwwwwwwww",
    "wkkwwwwwwwwwwkkw",
    "wkkwwwrrrrwwwkkw",
    "wwwwwrrrrrrwwwww",
    "wwwwwrrrrbbwwwww",
    "wwwwwbbbbbbwwwww",
    "wwwwwwbbbbwwwwww",
    "wkkwwwwwwwwwwkkw",
    "wkkwwwwwwwwwwkkw",
    "wwwwwwwwwwwwwwww",
)

_CH = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrwwrrrrrrr",
    "rrrrrrrwwrrrrrrr",
    "rrrrrwwwwwwrrrrr",
    "rrrrrwwwwwwrrrrr",
    "rrrrrrrwwrrrrrrr",
    "rrrrrrrwwrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
)

_TR = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrwwwwrrrrrrrrr",
    "rrwwrrrrwrrrrrrr",
    "rrwwrrrrrrwrrrrr",
    "rrwwrrrrrrwrrrrr",
    "rrwwrrrrwrrrrrrr",
    "rrrwwwwrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
)

# Greece: ten one-pixel stripes, and a square canton with a cross that reaches
# its edges. The stripes have to keep running underneath the canton, otherwise
# the flag loses the thing that identifies it.
_GR = _rows(
    "bbwwbbbbbbbbbbbb",
    "bbwwbbwwwwwwwwww",
    "wwwwwwbbbbbbbbbb",
    "wwwwwwwwwwwwwwww",
    "bbwwbbbbbbbbbbbb",
    "bbwwbbwwwwwwwwww",
    "bbbbbbbbbbbbbbbb",
    "wwwwwwwwwwwwwwww",
    "bbbbbbbbbbbbbbbb",
    "wwwwwwwwwwwwwwww",
)

# Australia: a readable Union canton in the top left corner, the Commonwealth
# Star under it, and the Southern Cross spread over the fly. The canton is the
# half that identifies it, so it gets the pixels.
_AU = _rows(
    "BwBBBBwBBBBBBBBB",
    "BBwrrwBBBBBwBBBB",
    "wwwrrwwwBBBBBBBB",
    "BBwrrwBBBBBBBwBB",
    "BwBBBBwBBBBBBBBB",
    "BBBBBBBBBBwBBBwB",
    "BBBwBBBBBBBBBBBB",
    "BBwwwBBBBBBBwBBB",
    "BBBwBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBB",
)

_CA = _rows(
    "rrrrrwwwwwwrrrrr",
    "rrrrrwwwwwwrrrrr",
    "rrrrrwwrrwwrrrrr",
    "rrrrrwrrrrwrrrrr",
    "rrrrrwrrrrwrrrrr",
    "rrrrrwwrrwwrrrrr",
    "rrrrrwwrrwwrrrrr",
    "rrrrrwwwrwwrrrrr",
    "rrrrrwwwwwwrrrrr",
    "rrrrrwwwwwwrrrrr",
)

# China: one large star that is actually large — a five-pixel diamond — with the
# four small ones in an arc beside it. Before, all five were the same size and
# the flag read as red with crumbs on it.
_CN = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrryrrryrrrrrrrr",
    "rryyyrrrrrrrrrrr",
    "ryyyyyrryrrrrrrr",
    "rryyyrrrrrrrrrrr",
    "rrryrrrryrrrrrrr",
    "rrrrrrryrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
)



# Portugal: the green is two fifths, and the armillary sphere sits on the seam
# as a real ring rather than the gold smudge it was before.
_PT = _rows(
    "ggggggrrrrrrrrrr",
    "ggggggrrrrrrrrrr",
    "ggggyyyrrrrrrrrr",
    "gggywwwyrrrrrrrr",
    "gggywrwyrrrrrrrr",
    "gggywwwyrrrrrrrr",
    "ggggyyyrrrrrrrrr",
    "ggggggrrrrrrrrrr",
    "ggggggrrrrrrrrrr",
    "ggggggrrrrrrrrrr",
)

# Syria flies the green-white-black flag with three red stars since December 2024;
# that is the one the Syrian community here uses.
_SY = _rows(
    "gggggggggggggggg",
    "gggggggggggggggg",
    "gggggggggggggggg",
    "wwwwwwwwwwwwwwww",
    "wwwwrwwwrwwwrwww",
    "wwwrrrwrrrwrrrww",
    "wwwwrwwwrwwwrwww",
    "kkkkkkkkkkkkkkkk",
    "kkkkkkkkkkkkkkkk",
    "kkkkkkkkkkkkkkkk",
)

# Afghanistan: the black-red-green tricolour, which is what the Afghan community
# in Germany overwhelmingly flies. The emblem is a mosque — a dome, a body and two
# pillars. Drawn as a solid block it turned into a white cross and read as Swiss.
_AF = _rows(
    "kkkkkrrrrrrggggg",
    "kkkkkrrrrrrggggg",
    "kkkkkrrrrrrggggg",
    "kkkkkrrwwrrggggg",
    "kkkkkrwwwwrggggg",
    "kkkkkrwwwwrggggg",
    "kkkkkrwrrwrggggg",
    "kkkkkrrrrrrggggg",
    "kkkkkrrrrrrggggg",
    "kkkkkrrrrrrggggg",
)

_HR = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrwrwrrrrrrr",
    "wwwwwwrwrwwwwwww",
    "wwwwwwwrwrwwwwww",
    "wwwwwwrwrwwwwwww",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
)

_XK = _rows(
    "BBBBBBBBBBBBBBBB",
    "BBBBBwBwBwBBBBBB",
    "BBBwBBBBBBBwBBBB",
    "BBBBBByyyyBBBBBB",
    "BBBBByyyyyyBBBBB",
    "BBBBByyyyyyBBBBB",
    "BBBBBByyyyBBBBBB",
    "BBBBBBByyBBBBBBB",
    "BBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBB",
)

_RS = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrryyrrrrrrrrrr",
    "bbbbrrbbbbbbbbbb",
    "bbbbrrbbbbbbbbbb",
    "bbbbrrbbbbbbbbbb",
    "wwwwyywwwwwwwwww",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwww",
)

_IQ = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "wwwwwwwwwwwwwwww",
    "wwwwwggggggwwwww",
    "wwwwwwggggwwwwww",
    "wwwwwwwwwwwwwwww",
    "kkkkkkkkkkkkkkkk",
    "kkkkkkkkkkkkkkkk",
    "kkkkkkkkkkkkkkkk",
)

_BA = _rows(
    "BBBBByyyyyyyyyyy",
    "BBBBwByyyyyyyyyy",
    "BBBBBwByyyyyyyyy",
    "BBBBBBwByyyyyyyy",
    "BBBBBBBwByyyyyyy",
    "BBBBBBBBwByyyyyy",
    "BBBBBBBBBwByyyyy",
    "BBBBBBBBBBwByyyy",
    "BBBBBBBBBBBwByyy",
    "BBBBBBBBBBBBwByy",
)

_MK = _rows(
    "yrrrrrryyrrrrrry",
    "ryrrrrryyrrrrryr",
    "rryrrrryyrrrryrr",
    "rrryryyyyyyryrrr",
    "yyyyyyyyyyyyyyyy",
    "yyyyyyyyyyyyyyyy",
    "rrryryyyyyyryrrr",
    "rryrrrryyrrrryrr",
    "ryrrrrryyrrrrryr",
    "yrrrrrryyrrrrrry",
)

# A real five-pointed star: two arms up, two out, one down each side. The first
# try was symmetric top to bottom and read as an arrow head.
_VN = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrryyrrrrrrr",
    "rrrrrrryyrrrrrrr",
    "rrrryyyyyyyyrrrr",
    "rrrrryyyyyyrrrrr",
    "rrrrrryyyyrrrrrr",
    "rrrrrryrryrrrrrr",
    "rrrrryrrrryrrrrr",
    "rrrrrrrrrrrrrrrr",
)

_IR = _rows(
    "gggggggggggggggg",
    "gggggggggggggggg",
    "gggggggggggggggg",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwrrwwwwwww",
    "wwwwwwrrrrwwwwww",
    "wwwwwwwwwwwwwwww",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
)

# Morocco's pentagram is drawn as lines, not filled — that is what tells it apart
# from every other star on a red field.
_MA = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrggrrrrrrr",
    "rrrrrrrggrrrrrrr",
    "rrrrggggggggrrrr",
    "rrrrrggrrggrrrrr",
    "rrrrrrggggrrrrrr",
    "rrrrrrgrrgrrrrrr",
    "rrrrrgrrrrgrrrrr",
    "rrrrrrrrrrrrrrrr",
)

# Albania. Two tries before this one: a shape tapering straight down read as a
# bat, and a straight wing bar over a split tail read as a spider. What makes a
# double-headed eagle at this size is the silhouette in three parts — two heads
# with beaks turned outward, wings that fan out and then taper downwards, and a
# single tail wider than the body above it.
_AL = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrkkrrrrkkrrrr",
    "rrrkkkrrrrkkkrrr",
    "rrrrrkkrrkkrrrrr",
    "rrkkkkkkkkkkkkrr",
    "rrrkkkkkkkkkkrrr",
    "rrrrkkkkkkkkrrrr",
    "rrrrrrkkkkrrrrrr",
    "rrrrrkkkkkkrrrrr",
    "rrrrrrrrrrrrrrrr",
)

_LB = _rows(
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwggwwwwwww",
    "wwwwwwggggwwwwww",
    "wwwwwggggggwwwww",
    "wwwwggggggggwwww",
    "wwwwwwwggwwwwwww",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
)

_ER = _rows(
    "rrgggggggggggggg",
    "rrrrrggggggggggg",
    "rrrrrrrrgggggggg",
    "rrrrrrrrrrrggggg",
    "ryyrrrrrrrrrrrgg",
    "ryyrrrrrrrrrrrcc",
    "rrrrrrrrrrrccccc",
    "rrrrrrrrcccccccc",
    "rrrrrccccccccccc",
    "rrcccccccccccccc",
)

_PK = _rows(
    "wwwwgggggggggggg",
    "wwwwgggggggggggg",
    "wwwwggggggwwwggg",
    "wwwwgggggwwggggg",
    "wwwwggggwggggwgg",
    "wwwwggggwggggggg",
    "wwwwgggggwwggggg",
    "wwwwggggggwwwggg",
    "wwwwgggggggggggg",
    "wwwwgggggggggggg",
)


def _tricolour_with_mark(a, b, c, colour, points):
    return mark(vstripes(a, b, c), colour, points)


# The thirty flags on offer, ordered by how many people of that nationality live
# in Germany, weighted towards the ages this app is for.
#
# The ranking is the Ausländerzentralregister as of 31.12.2025 (Destatis). That
# register only publishes ages as "under 20" and "20 to 45", so an exact 15-to-30
# ranking does not exist publicly; the order below is the overall one, moved
# around by how young each group is — the refugee and student cohorts (Syria,
# Afghanistan, Iraq, India, Eritrea, Pakistan) skew far younger than the settled
# labour migration of the sixties and seventies (Italy, Croatia, Greece).
#
# Germany itself is first: most people of that age living here hold it.
FLAGS = {
    "de": ("Germany", hstripes("k", "r", "y")),
    "tr": ("Turkey", _TR),
    "ua": ("Ukraine", hstripes("b", "y")),
    "sy": ("Syria", _SY),
    "ro": ("Romania", vstripes("b", "y", "r")),
    "pl": ("Poland", hstripes("w", "r")),
    "af": ("Afghanistan", _AF),
    "it": ("Italy", vstripes("g", "w", "r")),
    "bg": ("Bulgaria", bands([("w", 1), ("g", 1), ("r", 1)])),
    "hr": ("Croatia", _HR),
    "xk": ("Kosovo", _XK),
    "in": ("India", mark(hstripes("o", "o", "o", "w", "w", "w", "g", "g", "g"), "B",
                         [(7, 4), (8, 4), (7, 5), (8, 5)])),
    "gr": ("Greece", _GR),
    "rs": ("Serbia", _RS),
    "iq": ("Iraq", _IQ),
    "ru": ("Russia", hstripes("w", "b", "r")),
    "ba": ("Bosnia", _BA),
    "es": ("Spain", bands([("r", 1), ("y", 2), ("r", 1)])),
    "hu": ("Hungary", hstripes("r", "w", "g")),
    "mk": ("North Macedonia", _MK),
    "vn": ("Vietnam", _VN),
    "ir": ("Iran", _IR),
    "cn": ("China", _CN),
    "ma": ("Morocco", _MA),
    "al": ("Albania", _AL),
    "at": ("Austria", hstripes("r", "w", "r")),
    "pt": ("Portugal", _PT),
    "lb": ("Lebanon", _LB),
    "er": ("Eritrea", _ER),
    "pk": ("Pakistan", _PK),
}


def flag_rows(code: str) -> Rows:
    entry = FLAGS.get(code)
    return entry[1] if entry else None


def write_list(path: str) -> int:
    """The codes and names the app offers, generated so the two cannot drift."""
    lines = [
        "/**",
        " * The flags the flagpole can fly, generated by island/pixel/flags.py —",
        " * do not edit by hand.",
        " *",
        " * The code is also the sprite suffix: `flagpole_1_de` is the pole flying the",
        " * German flag. Adding one here and re-running the generators is all it takes.",
        " */",
        "",
        "export interface IslandFlag {",
        "  code: string;",
        "  name: string;",
        "  /** One character per pixel, keyed in FLAG_COLORS. */",
        "  rows: readonly string[];",
        "}",
        "",
        f"export const FLAG_WIDTH = {W};",
        f"export const FLAG_HEIGHT = {H};",
        "",
        "export const FLAG_COLORS: Record<string, string> = {",
    ]
    for char, hex_value in PALETTE.items():
        lines.append(f'  {char}: "{hex_value}",')
    lines += [
        "};",
        "",
        "export const ISLAND_FLAGS: readonly IslandFlag[] = [",
    ]
    for code, (name, rows) in FLAGS.items():
        joined = ", ".join(f'"{row}"' for row in rows)
        lines.append(f'  {{ code: "{code}", name: "{name}", rows: [{joined}] }},')
    lines += [
        "];",
        "",
        "export function islandFlagName(code: string | null | undefined): string | null {",
        "  if (!code) return null;",
        "  return ISLAND_FLAGS.find((flag) => flag.code === code)?.name ?? null;",
        "}",
        "",
    ]
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    return len(FLAGS)


if __name__ == "__main__":
    print(f"{len(FLAGS)} Flaggen, je {W} x {H} px")
    for code, (name, rows) in FLAGS.items():
        bad = [row for row in rows if len(row) != W or any(ch not in PALETTE for ch in row)]
        if len(rows) != H or bad:
            print(f"  FEHLER {code} ({name}): {len(rows)} Zeilen, {len(bad)} ungültig")
        else:
            print(f"  {code}  {name}")
