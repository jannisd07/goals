# WACHSTUM.md — Wachsende Insel: Stufen, Hintergrund, Objekte, Platzierungsprüfung

Stand 2026-09-10. Spezifikation für das Inselwachstum. Ersetzt in `ISLAND.md`
§6 (16 Basisbilder) und §9 (Meer als Ebene). Alles andere dort (Art Bible,
Progression) gilt weiter, außer den Punkten: die ersetzt §14.3. Recherchequellen
am Ende.

> **Runde 2 (§14, 2026-09-10)** überschreibt den Stil (Pixel statt detailliert),
> den Katalog (§7), die Wachstums-Trigger (§4.3) und legt die Rewards-Roadmap fest.

---

## 1. Anforderungen (Jannis, 2026-09-10)

1. Die Insel wächst abhängig davon, **wie viele Objekte** darauf stehen und **wie
   viel Platz** sie belegen.
2. **3 Inselstufen** decken die Grundnutzung ab. Danach wird die Insel nur noch
   **größer**, dafür wird das Bild der größten Stufe skaliert.
3. Der **Hintergrund** hat **5–6 Stufen** (5–6 Bilder). Je größer die Insel, desto
   weiter herausgezoomt wirkt das Meer, das Wasser sieht weiter weg aus. Das
   heutige Meerbild (`assets/home/ocean-bg.png`) wirkt wegen großer Reflexionen
   sehr nah, als schwebe man direkt über dem Wasser. Beim Blick von oben unter ca.
   35° muss man höher sein. Innerhalb einer Stufe wird zusätzlich je nach
   Inselgröße **herangezoomt**, damit der Wechsel zwischen den Bildern weich ist.
4. Objektkategorien: **Pflanzen, Strandobjekte, Wasserobjekte, Gebäude,
   Sonderobjekte**. Mischung aus **Größenstufen** (eigene Bilder) und **stumpfem
   Skalieren** eines Bildes.
5. Das System prüft **immer**, ob Anordnung und Positionen passen. Dafür ein
   **Raster** (etwa 20×20 oder was sich bewährt), auf dem Objekte Platz belegen.
   Wegen 2.5D dürfen Objekte **hintereinander** stehen:
   - Stamm A steht optisch hinter Stamm B, die Bilder überlappen → **erlaubt**
   - Stamm A steckt **im** Stamm B → **nicht erlaubt**
6. **Plausibilitätscheck** als festes Gate: Nur was alle Regeln besteht, wird
   gespeichert.
7. **Zonen**: Strandobjekte nur auf Strand usw. Die Positionen auf der Insel
   müssen dafür genau festgelegt sein.

---

## 2. Grundprinzip aus der Recherche

Jedes Objekt hat **zwei getrennte Geometrien**:

| Geometrie | Wofür | Darf überlappen? |
|---|---|---|
| **Footprint** (Belegung auf dem Raster, z. B. nur der Stamm) | Kollision, Zonen, Abstände | **Nein** |
| **Sprite** (das sichtbare Bild inkl. Krone, Dach) | Zeichnen, Verdeckungscheck | **Ja** |

Das ist genau der Unterschied zwischen „hintereinander" (Sprites überlappen,
Footprints nicht) und „ineinander" (Footprints überlappen). Viele 2.5D- und
Iso-Spiele machen es so: Pivot und Collider am Fuß, das Bild darf frei über
andere ragen, und sortiert wird nach der Fußlinie (Quellen 5, 6, 9).

Daraus folgen drei getrennte Bausteine:

1. **Belegungsraster** plus **Zonenmaske** pro Inselstufe → Platzierungsregeln
2. **Tiefensortierung** der Sprites → richtiges Überdecken
3. **Plausibilitätscheck** als reine, deterministische Funktion, identisch in der
   App (Vorschau) und auf dem Server (verbindlich)

---

## 3. Koordinaten und Raster

### 3.1 Konvention (verbindlich, ersetzt die Achsenangabe in ISLAND.md §3.1)

In ISLAND.md §3.1 steht „+Y = rechts oben" zusammen mit „Tiefe = x + y". Das
widerspricht sich: Bei `sy = (x − y)·…` wäre die Tiefe x − y. Ab jetzt gilt die
übliche Iso-Konvention (Quellen 2, 3):

```text
gx → nach rechts unten, gy → nach links unten (Raster-Ursprung = hintere Ecke)
screenX = (gx − gy) · TILE_W / 2
screenY = (gx + gy) · TILE_H / 2
Tiefe   = gx + gy         (größer = weiter vorn, später zeichnen)
gx = screenX / TILE_W + screenY / TILE_H
gy = screenY / TILE_H − screenX / TILE_W
```

**True Isometric** (unser Winkel, 35,264° Blickhöhe) heißt `TILE_H = TILE_W ·
0.57735`, nicht das in Spielen übliche 2:1. Bei Zoom 1.0 ist eine 1-m-Raute
`TILE_W = 90.5 pt`, `TILE_H = 52.25 pt` (entspricht den bisherigen 45.25 /
26.1 pt pro halbe Raute).

### 3.2 Rastergröße

- **Weltmaß:** 1 Zelle = 1 m (wie Art Bible).
- **Belegungsraster = Unterzellen von 0,5 m** (2×2 pro Meter). Grund: Ein Stamm
  soll neben einem anderen stehen dürfen, ohne dass beide gleich einen ganzen
  Meter blockieren. Stamm-in-Stamm wird so präzise erkannt.
- Stufe III (größte Grundstufe) ≈ **20×20 m → 40×40 Unterzellen**. Das ist das
  „20×20" aus der Anforderung, in feiner Auflösung.
- Speicher: `Uint16Array(w·h)` mit Objekt-Index pro Unterzelle, 0 = frei. Auch bei
  4× Skalierung (160×160) sind das nur 25 600 Einträge.

---

## 4. Inselstufen und Wachstum

### 4.1 Drei Grundstufen

| Stufe | Land (Rahmen) | Raster (0,5 m) | Strände | Zweck |
|---|---|---|---|---|
| I | ~12×12 m | 24×24 | 1 | Start: erste Pflanzen, 1–2 Hütten |
| II | ~16×16 m | 32×32 | 2 | kleines Dorf, Strandobjekte, erste Wasserobjekte |
| III | ~20×20 m | 40×40 | 2–3 | Grundausbau komplett, Sonderobjekte |

Jede Stufe ist ein **eigenes Inselbild** (die ChatGPT-PNGs), plus eine
**Zonenmaske** (§6), die aus dem Bild erzeugt wird.

### 4.2 Danach: Skalierung

Ab Stufe III wird **das Bild der Stufe III** in Weltkoordinaten skaliert:

```text
scale(n) = 1.15^n            n = Wachstumsschritte nach Stufe III
Raster   = round(40 · scale) × round(40 · scale) Unterzellen
Maske    = Stufe-III-Maske, per Nearest Neighbor auf das neue Raster
Kamera   = zoom = 1 / scale  → die Insel bleibt ungefähr gleich groß am Bildschirm,
                               alles andere wirkt kleiner und die Insel „wächst"
```

Objekte behalten ihre **Weltposition in Metern**. Mit der Skalierung kommen am
Rand neue Unterzellen hinzu, bestehende Objekte bleiben gültig, solange ihre
Zone gleich bleibt (Prüfung §7.5).

### 4.3 Wann wächst die Insel?

Aus der Anforderung „Anzahl und Platz", beides:

| Trigger | Standardwert |
|---|---|
| Belegte Nutzfläche (Gras-Unterzellen mit blockierendem Footprint) | ≥ 65 % |
| **oder** Objektanzahl auf der aktuellen Stufe | I→II ab 12, II→III ab 30 Objekten |
| **oder** der Platzierungs-Solver findet für das nächste gewählte Objekt keinen gültigen Platz | sofort |

Wachstum ist monoton, es gibt kein Schrumpfen. Beim Stufenwechsel dauert der
Crossfade des Inselbilds 800 ms, gleichzeitig animiert die Kamera auf den neuen
Zoom und der Hintergrund blendet über (§5).

### 4.4 Wichtig: Stufenbilder passen nicht automatisch ineinander

Die alten Blender-Stufen enthielten jeweils die vorherige Landfläche. Drei
unabhängige KI-Bilder tun das nicht. Deshalb gilt:

1. Die Stufenbilder werden am **Schwerpunkt der Landfläche** ausgerichtet.
2. Beim Wechsel läuft der **Umzugs-Solver** (§7.5). Gültige Objekte bleiben stehen,
   ungültige, etwa weil dort jetzt Wasser oder Strand statt Gras ist, rücken auf
   den nächsten gültigen Platz (BFS). Findet sich keiner, wandern sie ins
   Inventar. **Es geht nie etwas verloren.**

---

## 5. Hintergrund-Stufen (5–6 Bilder) mit Zoom

### 5.1 Warum das heutige Bild zu nah wirkt

Bei orthografischer Kamera ist die sichtbare Wellengröße umgekehrt proportional
zur Kamerahöhe. Große Sonnenreflexe und grobe Wellenzellen lesen sich wie
„knapp über dem Wasser". Aus größerer Höhe werden Wellen fein, Reflexe klein und
zahlreich, die Farbe tiefer. Der Horizont wandert aus dem Bild, weil man steiler
nach unten schaut.

### 5.2 Stufen als geometrische Zoomleiter

Wie Web-Karten: feste Detailstufen, dazwischen gebrochener Zoom durch Skalieren
des nächsten Bilds (Quellen 12, 13).

```text
Z(scale) = Kamera-Zoomfaktor = scale (Stufe III bei scale = 1, Stufe I/II < 1)
Stufen   = 6 Bilder B1..B6, jede Stufe gilt für Z ∈ [Z_k, Z_k+1)
r        = Z_max^(1/5)   bei Z_max = 4 → r ≈ 1.32 (jede Stufe ~32 % höher)
```

**Übergang:** Zwischen `Z_k` und `Z_k+1` wird das **fernere** Bild `B_k+1` **heran-
gezoomt** mit `Faktor = Z_k+1 / Z` (≤ r). Am Anfang der Stufe wirkt es damit so nah
wie `B_k`, am Ende hat es Originalgröße. An der Grenze gibt es einen kurzen
Crossfade (400 ms), der kleine Unterschiede zwischen den Bildern versteckt.
Das deckt „heranzoomen für einen besseren Übergang" ab.

Konsequenz für die Auflösung: Weil bis Faktor r hineingezoomt wird, müssen die
Bilder r-mal größer sein als der Bildschirm. Bei r = 1.32 heißt das mindestens
ca. 1700 px Breite (@3x), besser 2048×3600 px im Hochformat.

### 5.3 Bildvorgaben pro Stufe (für die Generierung)

Für alle gilt: gleiche Sonne (oben links), gleiche Grundfarbe wie das heutige
Meerbild, **keine Insel, kein Boot, kein Objekt**, nahtlos wirkende Fläche.

| Stufe | Wirkung | Wellen und Reflexe | Horizont |
|---|---|---|---|
| B1 | knapp über dem Wasser (heutiges Bild) | groß, weiche Zellen, große Reflexe | sichtbar, ca. 30 % |
| B2 | Drohne tief | etwas feiner | sichtbar, ca. 15 % |
| B3 | Drohne mittel | fein, viele kleine Reflexe | am oberen Rand |
| B4 | hoch | sehr fein, leichte Farbverläufe | außerhalb |
| B5 | sehr hoch | kaum Einzelwellen, Muster | außerhalb |
| B6 | sehr hoch, fast Karte | nur noch Textur und Tiefenverlauf | außerhalb |

Zuordnung Stufe → Hintergrund: Insel I = B1, II = B2, III = B3, danach per
Skalierung B4–B6.

---

## 6. Zonenmaske (genaue Positionen auf der Insel)

Pro Inselstufe eine Maske über das Unterzellenraster. Jede Unterzelle bekommt
genau eine Zone:

| Zone | Bedeutung |
|---|---|
| `GRASS` | Wiese, Standardfläche für Pflanzen und Gebäude |
| `BEACH` | Sand |
| `COAST` | Landzelle (Gras oder Sand) direkt am Wasser, abgeleitet |
| `SHALLOW` | Wasser bis 2 m vom Land |
| `DEEP` | Wasser weiter draußen (nur innerhalb des Kamerarahmens) |
| `BLOCKED` | per Hand gesperrt (z. B. Bildfehler, Deko im Bild) |

**Erzeugung, automatisch mit Handkorrektur:**

1. Das Unterzellen-Zentrum über die Umkehrformel (§3.1) auf ein Pixel im Inselbild
   abbilden. Pro Unterzelle 3×3 Stichproben, Mehrheit gewinnt.
2. Pixel klassifizieren: Alpha < 50 % → Wasser. Farbton im Grün → `GRASS`, im
   Sand-Gelb → `BEACH`.
3. Aufräumen: Inseln kleiner als 2 Unterzellen entfernen, Löcher schließen.
4. `COAST`, `SHALLOW` und `DEEP` über Distanztransformation von der Landfläche.
5. Ergebnis als JSON (RLE) mit `mask_version` neben dem Bild. Eine optionale
   Override-Datei setzt einzelne Zellen, etwa `BLOCKED`.
6. **Benannte Slots** nur für Sonderfälle, z. B. `lighthouse_slot` oder
   `dock_slot_1`: vorberechnete Küstenstellen, an denen große Sonderobjekte gut
   aussehen.

---

## 7. Objekte

### 7.1 Kategorien und Standardregeln

| Kategorie | Beispiele | Erlaubte Zonen (Footprint) | Größenstrategie |
|---|---|---|---|
| Pflanzen | Gras, Blumen, Busch, Baum, Palme | `GRASS` (Palme: `GRASS`/`BEACH`) | Baum/Busch: Stufenbilder; Gras/Blume: 1 Bild, skaliert 0.85–1.15 |
| Strandobjekte | Liegestuhl, Schirm, Sandburg, Treibholz, Muschel | nur `BEACH` | 1 Bild, leicht skaliert |
| Wasserobjekte | Boot, Boje, Fels im Wasser, Steg | `SHALLOW` (Fels/Boot groß: `DEEP`); Steg: hinten `COAST`, vorn `SHALLOW` | Boot: Größenstufen; Rest skaliert |
| Gebäude | Hütte → Haus → Villa, Werkstatt, Mühle | `GRASS` | **nur Größenstufen**, nie skaliert |
| Sonderobjekte | Brunnen, Statue, Leuchtturm, Monument | je Objekt (Leuchtturm: `COAST`) | Einzelbild, feste Größe, oft Slot |

**Warum Gebäude nie skaliert werden:** Fenster, Türen und Strichstärken passen
sonst nicht mehr zum Rest. Pflanzen und kleine Deko vertragen ±15 %, dann wirkt
eine Wiese natürlicher.

### 7.2 Katalogeintrag (Manifest)

```ts
type Zone = "GRASS" | "BEACH" | "COAST" | "SHALLOW" | "DEEP";

interface IslandAsset {
  key: string;                      // "tree_oak", "house", "boat"
  category: "plant" | "beach" | "water" | "building" | "special";
  tiers: Array<{
    tier: number;                   // Größenstufe, 1..n
    image: string;                  // WebP im Bundle
    footprint: { w: number; h: number; cells?: [number, number][] }; // Unterzellen, optional L-Form
    zones: Zone[] | Zone[][];       // global oder pro Footprint-Zeile (Steg)
    heightM: number;                // sichtbare Höhe, für Sortierung und Verdeckung
    anchorPx: [number, number];     // Bildpunkt der vorderen Footprint-Ecke am Boden
    clearance?: number;             // freier Ring in Unterzellen (Eingang, große Bäume)
  }>;
  scaleRange?: [number, number];    // stumpfes Skalieren, z. B. [0.85, 1.15]
  layer: "ground" | "object";       // ground = Wege, Blumenbeet (dürfen unter Objekten liegen)
  blocks: boolean;                  // false = kein Belegungseintrag (winzige Deko)
  requires?: "coast" | "slot";      // Zusatzbedingung
  maxPerIsland?: number;
  unlock: { stage?: 1 | 2 | 3; focusHours?: number; streakDays?: number };
}
```

### 7.3 Footprint-Faustregeln (0,5-m-Unterzellen)

| Objekt | Footprint | Anmerkung |
|---|---|---|
| Blume, Gras | 1×1 | `blocks: false`, darf in Lücken |
| Busch | 1×1 bis 2×2 | |
| Baum | **1×1 (nur Stamm)** | Krone ist nur Sprite und darf über andere ragen |
| Palme | 1×1 | Stamm |
| Liegestuhl / Schirm | 2×1 / 1×1 | `BEACH` |
| Hütte / Haus / Villa | 4×4 / 6×6 / 8×8 | `clearance: 1` vor dem Eingang |
| Boot klein / groß | 2×4 / 3×6 | `SHALLOW` / `DEEP` |
| Steg | 2×6 | Zeilen 0–1 `COAST`, Rest `SHALLOW` |
| Leuchtturm | 4×4 | `COAST`, `requires: "slot"` |

---

## 8. Plausibilitätscheck (das Gate)

### 8.1 Eine Funktion, zwei Aufrufer

```ts
validateLayout(island: IslandState, items: PlacedItem[], catalog): {
  ok: boolean;
  errors: Array<{ code: RuleCode; itemId: string; detail: string }>;
  warnings: Array<{ code: RuleCode; itemId: string; detail: string }>;
}
```

- **Rein und deterministisch**, keine Zufälle, kein Netzwerk. Gleiche Eingabe
  gleiches Ergebnis.
- Liegt in `supabase/functions/_shared/island/` (wie `coachPatterns.ts`) und
  wird von App und Server importiert, damit es **eine** Quelle der Wahrheit gibt.
- **App:** live bei jeder Vorschau (Rot/Grün), beim Laden, nach jedem
  Wachstum.
- **Server (verbindlich):** Edge Function `island-place` prüft JWT, lädt den
  Zustand, ruft `validateLayout` mit dem geplanten neuen Objekt auf und
  schreibt nur bei `ok`. Manipulierte Clients können so nichts Ungültiges
  speichern.
- Abgedeckt durch `npm run test:domain` (Regel-Fixtures plus Zufallstest: 10 000
  zufällige Platzierungen, der Validator darf **nie** eine Überlappung
  akzeptieren).

### 8.2 Regeln

| Code | Regel | Fehler/Warnung |
|---|---|---|
| `BOUNDS` | Alle Footprint-Unterzellen liegen im Raster | Fehler |
| `ZONE` | Jede Footprint-Unterzelle hat eine erlaubte Zone (bei Steg pro Zeile) | Fehler |
| `OVERLAP` | Keine Unterzelle ist von zwei blockierenden Objekten derselben Ebene belegt → **Stamm-in-Stamm** | Fehler |
| `LAYER` | `object` auf `ground` nur, wenn beide es erlauben (Bank auf Weg ja, Haus auf Weg nein) | Fehler |
| `CLEARANCE` | Freiring (Eingang, große Bäume) frei von blockierenden Objekten | Fehler |
| `REQUIRES` | Küsten-/Slot-Bedingung erfüllt (Steg berührt Küste, Leuchtturm auf Slot) | Fehler |
| `LIMIT` | `maxPerIsland` und Stufen-/Freischaltbedingung eingehalten | Fehler |
| `SORT` | Tiefenordnung ohne Zyklus bestimmbar (§8.3) | Fehler |
| `OCCLUSION` | Ein Objekt ist nicht zu stark verdeckt (§8.4) | Warnung, ab 90 % Fehler |
| `ISOLATION` | Gebäude-Eingang ist nicht komplett zugestellt | Warnung (v2: Fehler) |

„Hintereinander" ist **kein** Regelverstoß: Sprites dürfen überlappen, solange
`OVERLAP`, `SORT` und `OCCLUSION` bestehen.

### 8.3 Tiefensortierung

1. **Schnellweg (fast immer ausreichend):** Sortierschlüssel =
   `frontX + frontY` der vorderen Footprint-Ecke, dann `layer` (ground zuerst),
   dann Höhe. Das ist Pivot bzw. Fußlinie wie in den Quellen 5, 6 und 9. Weil
   Footprints nie überlappen (`OVERLAP`), stimmt das für 1×1- und kompakte
   Footprints.
2. **Exakt für große und längliche Footprints** (Steg 2×6, Villa 8×8, Boot 3×6):
   Objekte als Iso-Boxen (x-, y-, z-Bereich) behandeln. Nur Paare, deren
   Bildschirm-Hexagone überlappen, werden verglichen: Auf einer Achse ohne
   Überschneidung liegt das Objekt mit kleinerem x bzw. y hinten, das mit
   größerem z vorn. Aus diesen Beziehungen ein gerichteter Graph, dann
   **topologische Sortierung** (Quelle 1).
3. Ein **Zyklus** (A hinter B hinter C hinter A) ist nur mit Sprite-Zerschneiden
   lösbar. Der Validator lehnt so eine Anordnung mit `SORT` ab, statt falsch zu
   zeichnen. Das kommt bei Rechteck-Footprints ohne Überlappung praktisch nicht
   vor, wird aber abgesichert.
4. Sehr hohe Sprites (Leuchtturm) werden, falls später Figuren herumlaufen, in
   horizontale Streifen mit steigender Tiefe geschnitten (Quelle 3). In v1 nicht
   nötig.

### 8.4 Verdeckungscheck (2.5D-Plausibilität)

Überlappen ist erlaubt, **Verschwinden** nicht. Beispiel: Eine Blume direkt hinter
einer Villa wäre regelkonform, aber unsichtbar.

- **Schlüsselfläche** jedes Objekts: Die untere Hälfte seiner Sprite-Bounds (Fuß
  und Körper) in Bildschirmkoordinaten.
- Verdeckung: Anteil dieser Fläche, den Sprites **später gezeichneter**
  Objekte decken. Zuerst über Rechtecke (schnell), bei > 40 % über
  Alpha-Masken in niedriger Auflösung (32 px).
- Über **60 % → Warnung**: Der Solver sucht einen besseren Platz, der Nutzer
  sieht einen Hinweis. Über **90 % → Fehler** bei kleinen Objekten (Blume, Deko),
  weil sie dort sinnlos wären.

### 8.5 Automatische Platzierung und Umzug

- **v1: Nutzer wählt was, System wählt wo** (ISLAND.md §5.3). Der Solver bildet
  alle Kandidaten-Positionen, bewertet sie (Häuser innen, Bäume Richtung Rand,
  Strandobjekte am Wasser, wenig Verdeckung, Session-Seed für Varianz) und nimmt
  die **erste, die `validateLayout` besteht**. Die Wertung schlägt nie das Gate.
- **Umzug nach Wachstum oder Stufenwechsel:** Alle Objekte neu validieren. Ungültige
  per Breitensuche auf den nächsten gültigen Platz derselben Zone. Reihenfolge:
  große Objekte zuerst. Ohne Platz → Inventar.
- **Später (v2):** Manuelles Verschieben mit demselben Gate, Vorschau Grün/Rot
  wie in Builder-Systemen (Quellen 7, 8).

---

## 9. Datenmodell

```sql
-- Zustand der Insel pro Nutzer
create table public.island_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  stage smallint not null default 1 check (stage between 1 and 3),
  scale_step integer not null default 0 check (scale_step >= 0),
  mask_version text not null,
  updated_at timestamptz not null default now()
);

-- Platzierte Objekte, Position in 0,5-m-Unterzellen (vordere Footprint-Ecke = Anker)
create table public.island_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  asset_key text not null,
  tier smallint not null default 1,
  scale real not null default 1,
  x integer not null,
  y integer not null,
  flip boolean not null default false,
  state text not null default 'placed' check (state in ('placed', 'inventory')),
  source_session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
```

- Die alte Idee „unique (cell_x, cell_y)" reicht bei Mehrzellen-Footprints nicht.
  Überlappung verhindert **nur** der Validator in der Edge Function.
- Schreiben ausschließlich über `island-place` / `island-grow`, keine direkten
  INSERT/UPDATE-Grants an `authenticated` (dieselbe Grant-Falle wie bei `users`).

---

## 10. Rendering in der App

| Punkt | Entscheidung |
|---|---|
| v1 | Absolut positionierte `expo-image`-Views, sortiert nach §8.3. Reicht bis ca. 150–200 Sprites. |
| Ab vielen Objekten / Pinch-Zoom | `@shopify/react-native-skia`, Komponente `Atlas`: viele Sprites aus einem Sprite-Sheet mit eigenen Transformationen, animierbar über Reanimated (Quelle 14) |
| Blocker | Skia ist ein natives Paket und braucht einen nativen Build. Der geht auf diesem Mac erst, wenn die iOS-26.5-Simulator-Plattform installiert ist (siehe `run-goals`-Skill). |
| Ebenen | Hintergrund Bk (Zoom + Crossfade) → Inselbild → Boden-Objekte → Objekte (sortiert) → UI |
| Weltzu-Bildschirm | Formel §3.1 × Kamera-Zoom (§4.2) + Zentrierung |
| Animationen | Neues Objekt 400 ms, Wachstum 800 ms Crossfade plus Kamerafahrt, Reduce Motion: sofort |

---

## 11. Umsetzungsreihenfolge

1. Inselbilder I–III festlegen (ChatGPT-Prompt ohne Wasser, ISLAND.md) und
   Hintergründe B1–B6 generieren.
2. Masken-Generator (Python, Scratchpad-Pipeline wie `key.py`) → JSON pro Stufe,
   Masken als Overlay-Bild prüfen.
3. `_shared/island/`: Raster, Projektion, `validateLayout`, Sortierung, Solver +
   Domain-Tests inkl. Zufallstest.
4. Katalog v1 mit wenigen Objekten pro Kategorie (Platzhalter-Sprites reichen
   für die Logik).
5. Edge Functions `island-place`, `island-grow` + Tabellen + RLS.
6. App-Renderer v1 (expo-image), Home-Vorschau, Grove-Screen.
7. Hintergrund-Zoomleiter + Crossfade.
8. Später: Skia-Atlas, manuelles Verschieben.

---

## 12. Offene Entscheidungen

Standardannahme in Klammern.

1. Unterzellen 0,5 m oder ganze Meter? (0,5 m)
2. Wachstums-Trigger: 65 % belegt / 12 bzw. 30 Objekte / kein Platz? (ja, alle drei)
3. Skalierung nach Stufe III: +15 % pro Schritt, Obergrenze? (keine, Z_max = 4 für die Hintergrundplanung)
4. 5 oder 6 Hintergrundbilder? (6) Horizont nur in B1–B2 sichtbar? (ja)
5. Nutzer platziert selbst oder System? (System in v1, manuell in v2)
6. Verdeckungsgrenzen 60 % Warnung / 90 % Fehler? (ja)
7. Ungültige Objekte nach Stufenwechsel ins Inventar statt löschen? (ja)
8. Renderer v1 expo-image, Skia erst später? (ja)

---

## 13. Quellen

1. [Shaun Lebron: Depth-Sorting Isometric Blocks](https://shaunlebron.github.io/IsometricBlocks/): Separationsachse, topologische Sortierung, Zyklen
2. [Clint Bellanger: Isometric Tiles Math](https://clintbellanger.net/articles/isometric_math/): Raster ↔ Bildschirm
3. [Pogicity Demo (Iso-City-Builder)](https://github.com/twofactor/pogicity-demo): Tiefe = (x + y) · Faktor, Ebenen-Offsets, Mehrzellen-Anker vorne, vertikales Slicen hoher Gebäude
4. [GameDev.net: Isometric depth sorting](https://gamedev.net/forums/topic/693256-iometric-depth-sorting-c-sfml/5361462/)
5. [Daniel Rusnok: Runtime Sorting by Collider „Feet"](https://danielrusnok.medium.com/stop-hand-fixing-2d-sprite-pivots-runtime-sorting-by-collider-feet-in-unity-390befb16479): Sortierung am Fuß-Collider
6. [Bugnet: Sprites nach Pivot statt Mitte sortieren](https://bugnet.io/blog/how-to-fix-unity-sprite-sort-point-pivot-vs-center)
7. [Chris' Tutorials: Grid Placement für Godot 4](https://chris-tutorials.itch.io/grid-placement-godot): Vorschau, Validierung, Regeln
8. [Tsartsaris: Unity City Builder Grid System](https://tsartsaris.gr/unity-city-builder-grid-system/): Zellzustände, `AreCellsValidForPlacement`, Küstenzellen
9. [Defold Forum: 2.5D-Sortierung nach Tiefe](https://forum.defold.com/t/top-down-2-2-5d-template-with-sorting-objects-by-depth/70149)
10. [Envato Tuts+: Isometric Depth Sorting](https://gamedevelopment.tutsplus.com/tutorials/isometric-depth-sorting-for-moving-platforms--cms-30226)
11. [SuperTiled2Unity: Iso-Sprite-Ordering](https://github.com/Seanba/SuperTiled2Unity/issues/209): gemeinsamer Sortierwert für Mehrzellen-Sprites, Basislinie
12. [ArcGIS: Zoom levels and scale](https://developers.arcgis.com/documentation/mapping-apis-and-services/reference/zoom-levels-and-scale/): feste Detailstufen, Resampling dazwischen
13. [Azure Maps: Zoom levels and tile grid](https://learn.microsoft.com/en-us/azure/azure-maps/zoom-levels-and-tile-grid)
14. [React Native Skia: Atlas](https://shopify.github.io/react-native-skia/docs/shapes/atlas): viele Sprites performant

---

## 14. Runde 2 (2026-09-10): Pixel-Stil, Katalog, Wachsen statt Duplikate, Rewards

### 14.1 Stil: Pixel statt detailliert

Jannis: „Qualität bisschen runterschrauben, eher Pixel-Style als detailliert."

- Sprites auf kleinem Raster (Objekte 16–48 px, Inselbasis passend dazu), feste
  Palette (≤ 24 Farben, Basis ISLAND.md §3.2), 1-px-Kontur, keine Verläufe, kein
  Anti-Aliasing.
- Export **ganzzahlig** hochskaliert (×4, ×6) als PNG, gerendert ohne Glättung,
  damit Pixel nie verschwimmen.
- Der ChatGPT-Insel-Prompt muss auf Pixel-Stil umgeschrieben werden (offen).

### 14.2 Katalog v1 (von Jannis gewählt)

Wachstumsarten siehe §14.4. Footprints in 0,5-m-Unterzellen.

> **Die Spalte „Max" ist überholt.** Sie stammt aus der Planung, bevor es Bilder
> gab. Verbindlich ist der Katalog im Code (`GROW_OBJECTS` in
> `src/lib/growRewards.ts`): Die Stufenzahl eines Objekts ist immer die Zahl
> seiner Bilder — Pflanzen 10, Gebäude 8–12, Strand 8–12, Boot 14, Steg 10,
> Delfine 12, Möwen 12. Die Maße in `island/SPRITES.md` §5–§8 sind ebenfalls
> aktuell, diese Tabelle nicht.

| Objekt | Kategorie | Zone | Wachstum | Max | Start-Footprint |
|---|---|---|---|---:|---|
| Grasbüschel | Pflanze | `GRASS` | multiply | 12 | 1×1, nicht blockierend |
| Blumenbeet | Pflanze | `GRASS` (ground) | resize | 3 | 2×2 |
| Busch | Pflanze | `GRASS` | stages | 3 | 1×1 → 2×2 |
| Laubbaum | Pflanze | `GRASS` | stages | 5 | 1×1 (Stamm) |
| Tanne | Pflanze | `GRASS` | stages | 3 | 1×1 |
| Obstbaum | Pflanze | `GRASS` | stages (Blüte → Früchte) | 3 | 1×1 |
| Palme | Pflanze | `GRASS`/`BEACH` | stages | 3 | 1×1 |
| Weltenbaum | Pflanze | `GRASS` | stages | 3 | 2×2 → 4×4 |
| Muscheln und Seesterne | Strand | `BEACH` | multiply | 10 | 1×1, nicht blockierend |
| Sandburg | Strand | `BEACH` | stages | 3 | 2×2 |
| Liegestuhl | Strand | `BEACH` | multiply (ab 2 mit Schirm) | 4 | 2×1 |
| Lagerfeuer | Strand | `BEACH` | stages (Feuer → Feuerstelle mit Sitzstämmen) | 3 | 2×2 |
| Surfbretter (im Sand steckend) | Strand | `BEACH` | multiply | 5 | 1×1 |
| Hängematte | Strand | `BEACH` | stages (+ zweite Hängematte) | 2 | 2×4, braucht 2 Palmen im Abstand |
| Beachvolleyballnetz | Strand | `BEACH` | stages (Netz → Feld → Tribüne) | 3 | 2×6 |
| Strandbar | Strand | `BEACH` | resize | 3 | 4×4 |
| Boje | Wasser | `SHALLOW` | multiply | 6 | 1×1 |
| Boot | Wasser | `SHALLOW` → `DEEP` | stages (Ruderboot → Segelboot → Yacht) | 3 | 2×4 → 3×6 |
| Steg | Wasser | hinten `COAST`, vorn `SHALLOW` | resize (länger) | 3 | 2×6 |
| Kajak | Wasser | `SHALLOW` | multiply | 4 | 1×3 |
| Fels | Wasser | `SHALLOW`/`DEEP` | multiply | 5 | 2×2 |
| Delfin | Wasser | `DEEP`-Bereich | multiply (Schule wächst) | 8 | kein Footprint, schwimmt animiert |
| Möwen | Luft | über Insel und Wasser | multiply | 10 | kein Footprint, eigene Luftebene |
| Wohnhaus | Gebäude | `GRASS` | resize | 5 | 4×4 → 8×8 |
| Windmühle | Gebäude | `GRASS` | resize | 3 | 4×4 |
| Café | Gebäude | `GRASS` | resize | 3 | 4×4 → 6×6 |
| Bibliothek | Gebäude | `GRASS` | resize | 3 | 4×4 → 6×6 |
| Werkstatt | Gebäude | `GRASS` | resize | 3 | 4×4 |
| Gewächshaus | Gebäude | `GRASS` | resize | 3 | 4×4 → 6×4 |
| Trainingsplatz | Gebäude | `GRASS` | resize | 3 | 4×6 → 6×8 |
| Yoga-Pavillon | Gebäude | `GRASS` | resize | 3 | 4×4 |
| Sternwarte | Gebäude | `GRASS` | resize | 3 | 4×4 → 6×6 |
| Bootshaus | Gebäude | `COAST` | resize | 3 | 4×4 |
| Fahnenmast, Schatzkiste, Brunnen, Uhrturm, Leuchtturm, Monument | Sonder | je Objekt (Leuchtturm `COAST`-Slot) | nur über Rewards (§14.5) | 2 | 2×2 bis 4×4 |
| Flaschenpost | System | `BEACH` | — | 1 | nicht blockierend (§14.6) |

### 14.3 Mechanik: jedes Objekt genau einmal, dann wachsen

- Pro Insel höchstens **eine Instanz pro Objekt** (`unique (user_id, asset_key)`).
  Mehrfach-Objekte (Delfine, Möwen, Muscheln, Bojen …) sind **eine Gruppe** mit
  `count`.
- **Keine Punkte (Jannis, 2026-09-10):** Jede beendete Session ab 5 Minuten
  (Fokus oder Auto Check-In) bringt genau **eine Belohnung**. Der Nutzer wählt
  entweder
  - **Wachsen lassen:** ein vorhandenes Objekt wird höher (stages, resize) bzw.
    die Gruppe größer (multiply), **oder**
  - **Neu hinzufügen:** ein Objekt, das noch nicht auf der Insel steht.
- **Größe der Belohnung = Schritte.** Die Session wird mit der üblichen Länge
  desselben Ziels verglichen: Median der letzten 50 Sessions ab 5 min, bis
  8 Sessions zur Mitte gezogen, ohne Verlauf Medium. Stufen nach dem Vielfachen
  der üblichen Länge: Tiny unter 0,4×, Small bis 0,75×, Medium bis 1,35×, Large
  bis 2×, Huge ab 2×. Schritte: Tiny 1, Small 1, Medium 2, Large 3, Huge 4. Ein
  neues Objekt startet auf dieser Stufe, ein vorhandenes wächst um so viele,
  jeweils höchstens bis Max. Ausgewachsene Objekte sind nicht wählbar.
- **Sonderobjekte** sind nie eine Session-Belohnung, nur Roadmap (§14.5).
- **Nichts wächst von allein.** Wachstum passiert nur, wenn der Nutzer es wählt.
- Jede Wachstumsaktion läuft durch `validateLayout` (§8): Der größere Footprint
  bzw. die neue Instanz muss passen. Sonst versucht der Solver das Objekt zu
  verschieben; klappt das nicht, wächst zuerst die Insel (§4.3) oder die Option
  wird mit Hinweis ausgegraut.
- Datenmodell-Änderung zu §9: `island_items` bekommt `level smallint` und
  `count smallint`; Einzelpositionen einer multiply-Gruppe in `positions jsonb`
  (Array aus `{x, y}`).
- Wachstums-Trigger §4.3 neu: statt „Objektanzahl" zählt die **Summe aller Stufen
  und Anzahlen**. Die Zahlen von damals (I→II ab 12, II→III ab 30) sind überholt;
  verbindlich sind die fünf Stufen in `ISLAND_STAGE_LEVELS`
  (`src/lib/islandScene.ts`): 0, 25, 70, 145, 240 von insgesamt 333.
- **Umgesetzt in der App (2026-09-10):** Kategorie im Start-Sheet vor der
  Fokus-Session, das Objekt wächst im Timer mit. Nach dem Ende zeigt ein
  Reveal-Screen alle Objekte der Kategorie mit ihrem echten Ergebnis
  („New, stage 2“, „Stage 2 → 5“) und „Add to island“ bzw. „Grow on island“.
  Auto Check-In: Notification → Kategorie → Objekt. Logik rein und getestet in
  `src/lib/growRewards.ts` (Katalog v1 ohne Sonderobjekte; Möwen vorerst unter
  Wasser). Inselstand nur auf dem Gerät pro Konto (`islandSlice`: `level` pro
  Objekt, jede Session wird nur einmal angewendet), offene Belohnungen in
  `src/lib/pendingGrows.ts`. Noch ohne `island_items`, `validateLayout` und
  Pixel-Sprites (Platzhalter `GrowObjectArt`).

### 14.4 Wachstumsarten

| Art | Verhalten | Objekte |
|---|---|---|
| `stages` | neues Motiv pro Stufe, Footprint wächst mit | Bäume, Busch, Sandburg, Lagerfeuer, Boot, Volleyball, Hängematte |
| `resize` | gleiches Motiv, nächste Größenstufe als **eigenes Pixel-Sprite** | Gebäude, Blumenbeet, Strandbar, Steg |
| `multiply` | eine weitere Instanz bei der Gruppe | Delfine, Möwen, Muscheln, Surfbretter, Liegestühle, Bojen, Kajaks, Felsen, Grasbüschel |

**Pixel-Art verträgt kein krummes Skalieren:** Bei ×1,15 werden Pixel ungleich
groß. Deshalb ersetzt „eigenes Sprite pro Größe" die ±15-%-Streckung aus §7.1.
Nur ganzzahlige Faktoren sind erlaubt.

### 14.5 Rewards-Roadmap (Fokus + Auto Check-In zusammen)

| Stunden | Belohnung | Art |
|---:|---|---|
| 5 | Fahnenmast | neues Objekt |
| 10 | Schatzkiste | neues Objekt |
| 25 | Brunnen | neues Objekt |
| 50 | Uhrturm | neues Objekt |
| 100 | Leuchtturm | neues Objekt |
| 200 | Großer Brunnen | Brunnen wächst |
| 300 | Glockenturm | Uhrturm wächst |
| 500 | Leuchtfeuer | Leuchtturm wächst |
| 750 | Goldene Schatzkiste | Schatzkiste wächst |
| 1000 | Monument | neues Objekt |

- Gesamtstunden = Summe `duration_seconds` aller **beendeten** Sessions (Fokus-Timer,
  Auto- und manueller Check-In).
- Freischaltung legt das Sonderobjekt auf die Insel bzw. lässt es wachsen,
  Platzierung automatisch (Leuchtturm auf Küsten-Slot). Sonderobjekte gibt es nie
  als Session-Belohnung; sie kommen und wachsen nur über die Roadmap.
- **Umgesetzt (2026-09-10):** Rewards-Pill oben auf Home (Pixel-Pokal +
  Gesamtstunden) → Screen `Rewards` im Paper-Design: Gesamtzeit, Fortschritt zum
  nächsten Meilenstein, scrollbare Roadmap mit 10 Meilensteinen und
  Pixel-Sprites (gesperrt = Silhouette, nächster = halbtransparent). Logik rein
  in `src/lib/rewards.ts` (Domain-Tests), Daten über `useLifetimeHours` (paginiert,
  Query-Key unter `sessions`, aktualisiert sich nach jeder Session). Pixel-Sprites
  vorerst als Zeichenketten-Raster in `src/components/PixelArt.tsx`. Auf der Insel
  selbst erscheinen die Objekte noch nicht.

### 14.6 Flaschenpost

- Erscheint auf einer freien Strandzelle, sobald der KI-Coach einen neuen Tipp hat
  (`coach_nudge_cache`). Antippen öffnet den Tipp, danach verschwindet sie.
- Kein Kauf, blockiert nichts, wird bei Bedarf umgesetzt.

### 14.7 Neue offene Entscheidungen

1. **Pixel-Iso 2:1 statt True Isometric 35,3°?** Bei True Iso (Höhe 0,577 × Breite)
   entstehen unsaubere Treppenkanten. Übliche Pixel-Iso nutzt 2:1 (26,6°) mit
   sauberen Zwei-zu-eins-Treppen. (Empfehlung: 2:1, Formel §3.1 dann mit
   `TILE_H = TILE_W / 2`.)
2. **Insel-Skalierung nach Stufe III vs. Pixel-Art:** Stumpfes Skalieren macht Pixel
   unterschiedlich groß. (Nearest Neighbor und ganzzahlige Zoomstufen, oder jede
   weitere Größe als eigenes Pixelbild.)
3. Flaschenpost auch auf Home sichtbar, ohne Insel-Screen? (ja, kleines Icon.)


---

## 15. Runde 3 (2026-09-10): 2:1-Pixel-Iso, ganzzahlige Schritte, Maske pro Insel

Jannis: **„1. 2:1"** und **„dann machen wir ganzzahlige Schritte. Wir müssen ja für
jede Insel festlegen, welche Pixel im Raster Strand, Meer, Insel sind."**
Damit sind §14.7 Punkt 1 und 2 entschieden.

**Überholt:**
- §3.1: `TILE_H = TILE_W · 0.57735` sowie 90.5 / 52.25 pt
- §4.2: `scale = 1.15^n`
- §5.2: `r ≈ 1.32` mit stufenlosem Zoom

### 15.1 Projektion und Pixelmaß

```text
Pixel-Iso 2:1 (Dimetrie, ca. 26,6° Blickhöhe): TILE_H = TILE_W / 2
Kunstraum (Art-Pixel): 1 m = 16 × 8 px, eine 0,5-m-Unterzelle = 8 × 4 px
artX = (gx − gy) · 4          artY = (gx + gy) · 2        (gx, gy in Unterzellen; korrigiert 2026-09-10, vorher · 8 / · 4)
Tiefe = gx + gy (unverändert)
Bildschirm: devicePx = artPx · D, D ganzzahlig (1 … 6), Rendering Nearest Neighbor
```

2:1 ergibt saubere Pixeltreppen (2 Pixel seitlich, 1 Pixel hoch). Alles wird im
Kunstraum 1:1 gezeichnet und nur um ganzzahlige Faktoren vergrößert. So bleibt
jeder Pixel quadratisch und gleich groß.

### 15.2 Stufen, ganzzahlige Schritte, Kamera

Beispielrechnung für iPhone @3x (1206 px Breite, Inselbereich ca. 1080–1150 px):

| Insel | Land | Inselbild (Art-px, Breite) | Kamera D | Breite am Gerät | Hintergrund |
|---|---|---:|---:|---:|---|
| Stufe I | 12 × 12 m | 192 | 6 | 1152 px | B1 |
| Stufe II | 16 × 16 m | 256 | 4 | 1024 px | B2 |
| Stufe III | 20 × 20 m | 320 | 3 | 960 px | B3 |
| III × 2 | 40 × 40 m | 640 | 2 | 1280 px (Ränder leicht angeschnitten) | B4 |
| III × 3 | 60 × 60 m | 960 | 1 | 960 px | B5 |
| III × 4 | 80 × 80 m | 1280 | 1 | 1280 px (scrollen) | B6 |

- **Wachstum nach Stufe III = Faktor k ∈ {2, 3, 4}:** Das Inselbild wird um k
  vergrößert (Nearest Neighbor). Weltmaß und Raster wachsen um k, und **jede
  Maskenzelle wird exakt zu k × k Zellen**. Genau deshalb passen ganzzahlige
  Schritte zur Maske: Es entsteht nie eine halbe oder unscharfe Zelle.
- **Objekte bleiben in ihrer Pixelgröße.** Auf der größeren Insel ist dadurch
  Platz für mehr. Die Landpixel werden gröber, fallen aber auf den flachen
  Gras- und Sandflächen kaum auf, nur die Küstentreppe wird gröber.
- **Kamera nur in ganzzahligen D-Stufen.** Beim Wachstum animiert sie von D
  zum nächsten D. Während der Fahrt kurz nicht pixelgenau, im Ruhezustand immer.
  Dazu blendet der Hintergrund über (400 ms). Der stufenlose Zoom innerhalb einer
  Stufe entfällt, weil die Insel zwischen den Schritten gleich groß bleibt.
- **Folge ab D ≤ 2:** Objekte werden auf Home klein (ein 16-px-Baum hat bei D 1
  nur ca. 5 pt). Home zeigt deshalb die Übersicht. Zum Anschauen gibt es im
  Insel-Screen Pinch-Zoom **in ganzzahligen Stufen** (D 1–6) plus Verschieben,
  wie in Pixel-Aufbauspielen.

### 15.3 Maske pro Insel (Strand, Meer, Gras)

Pro Inselbild (I, II, III) wird festgelegt, welche Zelle was ist.

1. **Zonenebene von Hand**, empfohlen: Im Pixel-Editor (z. B. Aseprite) liegt über
   dem Inselbild eine Ebene „zones" mit fünf Vollfarben:
   - `GRASS` grün
   - `BEACH` gelb
   - `SHALLOW` hellblau
   - `DEEP` dunkelblau
   - `BLOCKED` rot

   Export als PNG → Skript → JSON auf dem 0,5-m-Raster. Pro Unterzelle zählt die
   Mehrheit der 8 × 4 Pixel ihrer Raute, bei Pixel-Art praktisch immer eindeutig.
2. **Automatischer Vorschlag** aus dem Inselbild: Weil Pixel-Art eine feste
   Palette hat, ist jede Farbe genau einer Zone zugeordnet (Sandfarben →
   `BEACH`, Grüntöne → `GRASS`, transparent → Wasser). Das liefert einen exakten
   Startpunkt für Schritt 1, ohne Farbschätzung wie bei den gerenderten Bildern.
3. **Abgeleitet, nicht gemalt:** `COAST` (Landzelle neben Wasser) und die Grenze
   `SHALLOW`/`DEEP` (Abstand zum Land), falls die Ebene sie nicht ausdrücklich
   setzt.
4. Ergebnis `island_I.zones.json` usw. mit `mask_version`. Die App und die Edge
   Function lesen dieselbe Datei.

### 15.4 KI-Bilder auf ein echtes Pixelraster bringen

„Pixel-Art" von ChatGPT ist fast nie pixelgenau: Die Kunstpixel sind
unterschiedlich groß, verschmiert und haben zu viele Farben. Deshalb vor jeder
Maske:

1. **Pixelgröße erkennen:** Häufigster Abstand der Farbkanten, z. B. 6 Bildpixel =
   1 Kunstpixel.
2. **Einrasten:** Um genau diesen Faktor verkleinern, pro Block die häufigste Farbe.
3. **Palette erzwingen:** Auf die Insel-Palette quantisieren (≤ 24 Farben), ohne
   Dithering.
4. **Kontrolle:** Wieder ganzzahlig hochskalieren und neben dem Original anzeigen.

Das passt zur vorhandenen lokalen Pipeline (`islands/key.py`, `topdown.py`).

### 15.5 Hintergründe B1–B6

Die Stufen hängen jetzt an den Kameraschritten (Tabelle 15.2) statt an einer
stufenlosen Zoomleiter. Vorgaben §5.3 bleiben. Neu: Auch das Meer ist
Pixel-Art im selben Pixelmaß und wird mit demselben D gezeichnet, sonst wirkt es
gegenüber der Insel zu weich.

### 15.6 Offen

1. ChatGPT-Prompt auf **Pixel-Art + 2:1** umschreiben (Prompt v2 ist True Iso und
   gemalt).
2. Palette für Pixel-Art festlegen (Basis ISLAND.md §3.2, max. 24 Farben).
3. Obergrenze nach Stufe III: × 4? (ja, danach nur noch Objekte wachsen lassen.)

### 15.7 Stand der Hintergründe (2026-09-10)

- **B1 geliefert** (Jannis, ChatGPT): Pixel-Meer mit Himmel und Horizont bei ca.
  34 % Höhe. Liegt als `assets/home/ocean-pixel-1.png` (einmal per Nearest
  Neighbor auf 1320 × 2868 hochskaliert, damit iOS die Pixel nicht weichzeichnet)
  und ist der Home-Hintergrund. Das Inselbild `island-bg.png` ist auf Home damit
  ersetzt; die Insel kommt als eigene Ebene, sobald die Pixel-Inseln da sind.
- Das Bild hat kein exaktes Raster (Blöcke 5–6 px, weiche Übergangspixel, viele
  Farben). Das exakte Einrasten nach §15.4 folgt zusammen mit den Inseln, damit
  Meer und Insel dasselbe Pixelmaß bekommen.
- B2–B6 (weiter herausgezoomt) liefert Jannis später.
- **B2 geliefert** (Jannis, 2026-09-10): Version für die **mittlere Inselgröße**
  (Stufe II). Original in `assets/ocean/stage-2-middle-island.png`, noch nicht in
  der App eingebunden. Übersicht aller Versionen: `assets/ocean/README.md`.
- **Weiteste Version geliefert** (Jannis, 2026-09-10): **am weitesten
  herausgezoomt**, für die größte Insel. Original in
  `assets/ocean/stage-3-farthest.png`, noch nicht eingebunden. Damit liegen drei
  Meer-Stufen vor (nah, mittel, fern) statt der geplanten sechs. Die Zuordnung
  zu Inselstufen und Wachstumsschritten (Tabelle §15.2) wird beim Einbau
  festgelegt.
- **Inseln I–III geliefert und auf Home sichtbar** (Jannis, 2026-09-10): drei
  Basisinseln klein → groß in `assets/island/stages/` (Streupixel entfernt,
  zugeschnitten). Paarung und Bildschirmbreite nach §15.2 in
  `src/lib/islandStages.ts`: I auf B1, II auf B2, III auf B3, alle mit 94 %
  Bildschirmbreite (die schrumpfenden Breiten aus §15.2 erst nach dem Pixel-Snap).
  Home zeigt Stufe I zwischen Balance-Pill und Goal-Karten. **Nur Anzeige:**
  Tippen auf die Insel schaltet zur Vorschau durch die drei Stufen, es gibt noch
  kein Wachstum, kein Raster, keine Maske und kein Pixel-Snap.
- **B1 ersetzt** (Jannis, 2026-09-10): Neue nächste Meer-Version (`07_44_57 PM`,
  887 × 1774, Horizont bei 13 % statt 34 %) ist `assets/ocean/stage-1-closest.png`
  und über `assets/home/ocean-pixel-1.png` (1320 × 2640) der Home-Hintergrund der
  kleinen Insel. Die erste Version liegt als `stage-1-closest-v1.png` daneben.
- **B1 erneut ersetzt** (Jannis, 2026-09-10): Version `07_53_34 PM` (887 × 1774,
  Horizont bei 25 %) ist jetzt `assets/ocean/stage-1-closest.png` und Home-Hintergrund
  der kleinen Insel. Die 13-%-Version liegt als `stage-1-closest-v2.png` daneben.
- **Insel-Ebene wieder entfernt** (Jannis, 2026-09-10): Home nutzt jetzt ein Bild mit
  eingemalter Insel (`08_11_37 PM`, Original `assets/ocean/stage-1-with-island.png`,
  App-Version `assets/home/island-ocean-1.png`). `src/lib/islandStages.ts` und die
  Tipp-Vorschau sind raus; die Inselbilder in `assets/island/stages/` bleiben liegen.
- **Insel wieder drauf** (Jannis, 2026-09-10): Hintergrund mit eingemalter Insel 10 pt
  nach oben (im App-Asset um 30 px verschoben, unten gespiegelt), die kleine Insel
  liegt wieder als eigene Ebene darüber (94 % Breite, mittig zwischen Pill und Karten,
  ohne Tipp-Vorschau).
- **Doppelte Insel behoben** (2026-09-10): Die Insel-Ebene liegt jetzt passgenau über
  der ins Hintergrundbild gemalten Insel, statt mittig zwischen Pill und Karten. Das
  Rechteck (Asset-Pixel des Hintergrunds) stammt aus einem Masken-Fit: Die gemalte
  Insel ist 6,4 % höher als das Sprite, dazu 1,5 % Übermaß, damit kein gemalter Rand
  hervorschaut (0,1 % der gemalten Landfläche bleiben unbedeckt). Position folgt der
  Cover-Skalierung und der Transformation des Hintergrunds (`styles.bgImage`, gleiche
  Wrapper-Box), sitzt also auf jedem Gerät und bei jedem Zoom an derselben Stelle.
- **Neuer Home-Hintergrund mit Flachwasser, ohne gemalte Insel** (Jannis, 2026-09-10):
  Codex-Bild `11_20_09 PM` (846 × 1860), Original `assets/ocean/stage-1-shallows.png`,
  App-Version `assets/home/shallows-ocean-1.png`. Die kleine Insel liegt als Ebene
  mittig auf dem hellen Flachwasser; Position und Größe aus dem vorigen Bild
  übertragen (Verhältnis Insel zu Flachwasser). Das Rechteck steht in `HomeScreen.tsx`.

### 15.8 Stufe 1 abgenommen (Jannis, 2026-09-10)

Endstand auf Home, so im Code (`src/screens/HomeScreen.tsx`):

| Teil | Wert |
|---|---|
| Hintergrund | `assets/home/shallows-ocean-1.png` (Codex `11_20_09 PM`, 846 × 1860, Nearest Neighbor auf 1320 × 2902); Original `assets/ocean/stage-1-shallows.png` |
| Transformation `styles.bgImage` | `scale` 1.05 * 1.05 = 1,1025, `translateY` -3,9 (wirkt als -4,3 pt) |
| Insel | `assets/island/stages/island-1-small.png`, Rechteck in Hintergrund-Asset-Pixeln: left 91,4, top 1176,3, width 1157, height 718 (Seitenverhältnis des Sprites, keine Streckung) |

Lage auf dem iPhone 16 Pro (402 × 874 pt):

- Horizont bei 179 pt (20,4 % von oben).
- Flachwasser x 16–389 pt, y 352–619 pt (40–71 % von oben).
- Insel (Land) x 12–397 pt, y 342–580 pt (39,1–66,3 % von oben), frei zwischen Balance-Pill (bis 267 pt) und Goal-Karten (ab 688 pt).

Regeln, die für alle weiteren Stufen gelten:

- **Die Insel wandert immer mit dem Hintergrund** (Jannis). Technisch liegt sie in einer Ebene mit derselben Box und Transformation wie das Hintergrundbild (`StyleSheet.absoluteFill` + `styles.bgImage`), ihr Rechteck ist in Hintergrund-Asset-Pixeln angegeben und folgt der Cover-Skalierung. Hintergrund verschieben oder zoomen = nur `styles.bgImage` ändern. Nur „Insel verschieben“ ändert das Rechteck.
- `Image` immer mit expliziter Breite und Höhe, nie `aspectRatio`: Das Asset-Default (Pixelhöhe) plus `aspectRatio` lässt Yoga die Breite überschreiben.
- Prozentangaben von Jannis beziehen sich auf die Bildschirmhöhe des iPhone 16 Pro.
- Der Zoom darf oben keinen Streifen freilegen: Oberkante = 437 − `scale` · 437 + `scale` · `translateY` muss ≤ 0 pt sein.

Weg dorthin, kurz: Bild mit eingemalter Insel → Insel-Ebene passgenau darübergelegt → Flachwasser-Bild ohne Insel, Rechteck übertragen → Zoom zweimal 5 % → Hintergrund mit Insel 4 % und 1,5 % hoch → Insel allein 2 % hoch.

### 15.9 Stufe 2: nächster Schritt

- Insel: `assets/island/stages/island-2-medium.png` (1371 × 695, Seitenverhältnis ca. 2 : 1).
- Braucht einen neuen Hintergrund im Stil von Stufe 1, weiter herausgezoomt, mit Flachwasser in der Form der mittleren Insel. Horizont und Insel-Mitte an derselben Bildschirmstelle wie Stufe 1 (20 % bzw. 53 % von oben), damit der Wechsel zwischen den Stufen ruhig wirkt.
- Einbau wie Stufe 1: eigener Eintrag mit Hintergrund, `bgImage`-Transformation und Insel-Rechteck, gleiche Kopplung.

**Stufe 2, erster Versuch (2026-09-11):** Hintergrund `assets/home/shallows-ocean-2.png`
(ChatGPT `11_59_04 PM`, 887 × 1774, Nearest Neighbor auf 1320 × 2640; Original
`assets/ocean/stage-2-shallows.png`), Insel `island-2-medium.png`. Beide Stufen stehen jetzt
als Tabelle in `src/lib/homeIslandStages.ts` (Hintergrund, `zoom`, `shiftY`, Insel,
Rechteck); `HOME_ISLAND_STAGE` wählt, welche Home zeigt (zum Testen 2). Werte: Zoom 1,1576
(Stufe 1 plus 5 %, am 2026-09-14 auf Jannis' Wunsch näher an die Insel; Horizont dadurch bei
ca. 166 pt statt 179 pt), `shiftY` 12,9,
Insel-Rechteck left 170.7 / top 1094.3 / 1015 × 514. Der Zoom gilt nur fürs Meer: Das Rechteck steht in Hintergrund-Pixeln und wurde durch dieselben 5 % geteilt, damit die Insel 385 pt breit bleibt. Die Insel sitzt wie bei Stufe 1 leicht
über der Mitte des Flachwassers, behält aber die Bildschirmbreite von Stufe 1 (385 pt),
weil dieses Flachwasser breiter als der Bildschirm ist. Lage iPhone 16 Pro: Land x 15–400 pt,
y 366–559 pt.

### 15.10 Maximale Anzahl je Objekt (2026-09-14)

**Regel (Jannis):** Pflanzen haben je Art eine feste Höchstzahl, **Gebäude gibt es
genau einmal pro Insel**. Der Fußabdruck unten ist der der größten Stufe.

| Pflanze | Fußabdruck | Vorschlag max. Anzahl | Fläche |
|---|---:|---:|---:|
| Laubbaum | 1 × 1 | 6 | 6 m² |
| Busch | 2 × 2 | 8 | 32 m² |
| Tanne | 1 × 1 | 5 | 5 m² |
| Palme | 1 × 1 | 5 | 5 m² |
| Obstbaum | 1 × 1 | 4 | 4 m² |
| Blumenbeet | 4 × 4 | 3 | 48 m² |
| Grasbüschel | 1 × 1 | 12 | 12 m² |
| Weltenbaum | 4 × 4 | 1 | 16 m² |
| **Summe Pflanzen** | | **44 Objekte** | **128 m²** |

Die 10 Gebäude belegen zusammen 63 m² (Haus, Windmühle je 2 × 2; Café, Werkstatt,
Gewächshaus, Bootshaus je 3 × 2; Bibliothek, Trainingsplatz, Yoga-Pavillon je
3 × 3; Sternwarte 2 × 2).

**Platz, wenn man ALLES hat** (alle Gebäude einmal, alle Pflanzen maximal oft).
Mit Faktor 1,6 für Wege und Abstand sind das rund **306 m²**. Nutzbares Land ist
etwa 55 % des Quadrats, weil die Insel eine organische Form hat:

| Inselstufe | Größe | Land | Belegung |
|---|---|---:|---:|
| Stufe I | 12 × 12 m | 79 m² | 386 % |
| Stufe II | 16 × 16 m | 141 m² | 217 % |
| Stufe III | 20 × 20 m | 220 m² | 139 % |
| III × 2 | 40 × 40 m | 880 m² | **35 %** |
| III × 3 | 60 × 60 m | 1980 m² | 15 % |

**Vorschlag:** Die Vollsammlung passt ab **III × 2**, und zwar mit rund einem
Drittel Belegung, also üppig bewachsen statt vollgestellt. Auf Stufe III wäre
alles gleichzeitig überfüllt. Damit ist das Wachstum der Insel selbst Teil der
Progression: Erst alles sammeln zu können setzt eine gewachsene Insel voraus.
Wer kleiner bleiben will, lässt Pflanzen weg statt Gebäude, denn Gebäude sind
Einzelstücke.

Umgesetzt am 2026-09-16: `maxCount` steht im Katalog **und** dahinter steht
etwas — siehe §15.15.

### 15.11 Steinwege zwischen Gebäuden (Notiz, 2026-09-14, offen)

**Jannis:** Sobald mehr als ein Gebäude steht, sollen die Gebäude über den
kürzesten Weg mit einer **Steinstraße** verbunden werden. Dafür braucht es einen
Algorithmus.

Stand der Überlegung, noch nicht umgesetzt:

- **Welche Wege überhaupt:** Nicht jedes Gebäude mit jedem verbinden, sonst wird
  die Insel ein Netz. Ein **minimaler Spannbaum** über die Gebäude-Ankerpunkte
  reicht: n Gebäude ergeben n − 1 Wege, alles hängt zusammen, nichts ist doppelt.
- **Wie der einzelne Weg läuft:** Kürzester Pfad auf dem Unterzellen-Raster
  (0,5 m) mit A*, Kosten: Gras 1, vorhandener Weg 0,3 (Wege bündeln sich also und
  laufen gern zusammen), Strand 2, belegte Zellen und Wasser gesperrt. Ergebnis
  sind Wegzellen, keine Linien.
- **Zeichnung:** Wegzellen als Steinplatten im selben 2:1-Raster, Kanten weicher
  über Übergangsplatten. Die Türseite jedes Gebäudes ist der Anschlusspunkt, der
  Weg endet an der Tür, nicht am Mittelpunkt.
- **Wann neu gerechnet:** Bei jedem neuen Gebäude und bei jedem Umzug. Bestehende
  Wege möglichst behalten, damit die Insel nicht bei jeder Änderung anders
  aussieht.
- **Prüfung:** Der Weg zählt in der Plausibilitätsprüfung (§8) als eigene Ebene,
  er darf Objekte nicht überlagern, aber unter Bäumen durchlaufen.

### 15.12 Strandobjekte auf der Insel: Maßstab und Verteilung (2026-09-14)

**Jannis:** „die objekte sind viel zu groß und nur an einem der strände platziert."

Beides stimmte und beides ist behoben.

**Maßstab.** Die Strandobjekte waren durchweg baumgroß gezeichnet — die Sandburg
2,3 m breit und 3,2 m hoch, das Muschelfeld 2,6 m lang. Zum Vergleich: ein
ausgewachsener Laubbaum ist 26 × 34 px, also 2,6 m breit und 3,4 m hoch. Die
Baupläne sind unverändert geblieben, sie werden über `beach.SCALE` nur im
richtigen Maßstab gerastert (0,72 bis 1,0 je Objekt, Tabelle in
`island/SPRITES.md` §5c). Die Strandbar bleibt bei 1,0: sie ist eine Hütte und
darf Baumgröße haben.

**Verbindliche Regel für alle weiteren Objekte:** der ausgewachsene Laubbaum
(26 × 34 px) ist das Maß. Was in Wirklichkeit kleiner als ein Baum ist, wird auch
kleiner gezeichnet. Nur Gebäude und die Bar liegen darüber.

**Verteilung.** Die Insel hat fünf sandige Abschnitte, nicht einen. Die
Beispielanordnung (`python3 island/pixel/scene.py 5`) verteilt in Gruppen, die
zusammengehören: Bar + Muscheln in der großen Bucht rechts, Lagerfeuer vorne
rechts, Volleyballnetz + Surfbretter vorne links, Sandburg links hinten,
Hängematte + Liegestühle in der Bucht hinten. Für die spätere automatische
Platzierung gilt dasselbe: erst die Buchten aufteilen, dann innerhalb einer Bucht
setzen.

**Nebenbefund für die Platzierungslogik:** Das Sandband der Insel ist nur 0,5 bis
1,7 m breit. Kein Strandobjekt passt vollständig darauf; es ragt immer ein Stück
ins Gras, und das sieht richtig aus. Die Prüfung darf deshalb nicht „ganz auf
Sand" verlangen, sondern nur den Überhang über die Wasserkante verbieten.

**Nachgeschärft (Jannis: „manches geht über den rand hinaus", dann „shells gehören
aber auch nicht aufs gras … so dass es NUR aufm strand ist"):**

1. Geprüft wird der tatsächliche Fuß des Sprites — das untere Drittel der
   undurchsichtigen Pixel —, nicht die Bounding-Box und nicht ein paar Eckpunkte.
   **Jeder** Fußpixel muss auf Sand liegen; Gras zählt wie Wasser als Fehler.
2. Daraus folgt eine harte Obergrenze für die Größe: die nutzbare Uferlinie auf
   Stufe 5 ist rund 218 px lang, alle acht Objekte zusammen dürfen nicht breiter
   sein. Deshalb liegen die Faktoren in `beach.SCALE` jetzt bei 0,55 bis 0,78.
   `scene.py` bricht ab, wenn ein Objekt nirgends ganz auf den Sand passt.
3. Nutzbar sind nur drei der fünf Sandabschnitte. Bei den beiden schmalen ist das
   Band 7 bis 10 px breit — dort passt nichts.

Außerdem sperrt ein Strandobjekt das Stück Wiese **vor** sich für Pflanzen: ein
Baum dort steht zwar korrekt im Vordergrund, verdeckt das Objekt dahinter aber
vollständig.

**Und der Strand ist breiter geworden** (`BEACH_AT_92` 4,2 → 5,2 in `ocean.py`,
auf Jannis' Wunsch „mach gerne den strand bisschen größer, minimal nur, bei allen
inseln"). Damit passen auf Insel 4 und 5 alle acht Objekte in Endstufe auf den
Sand, auf Insel 3 fast alle. Auf den kleinen Inseln nimmt `scene.py` automatisch
die höchste Wachstumsstufe, die dort noch ganz auf den Sand passt — die Insel
wächst, die Objekte wachsen mit. Die Tabelle dazu steht in `island/SPRITES.md` §5c.

Das ändert alle Inselbilder. Danach müssen `ocean.py --sizes`, `zones.py` und
`layout.py` neu laufen und die Hintergründe nach `assets/home/pixel-island-N.png`
kopiert werden.

Nach jeder Änderung an `beach.py` neu exportieren, sonst zeigt die App die alten
Größen:

```bash
python3 island/pixel/beach.py island/pixel
python3 island/pixel/export_sprites.py island/pixel/beach src/components/grow/beachSprites.ts BEACH
```

### 15.13 Platzierung, Steinwege, Maximalzahlen, Grove weg (2026-09-14)

**Jannis:** „wie machen wir es mit platzierung? random? ja. wir machen so, dass man
per button am ende einer session es selber setzen kann … wenn nicht, dann random
wo platz ist. … steinwege sollen einzelne steine mit minimal spacing dazwischen
sein (ganz flache steinplatten, leicht runde ecken) … grove soll weg … maximalzahlen
bitte eintragen"

#### Platzierung

Automatisch bleibt der Normalfall: `findSpot` wählt unter allen freien Plätzen
gewichtet nach Platz — die ersten Objekte landen in der offenen Mitte, spätere
verteilen sich nach außen, und zwei Spieler bekommen trotzdem verschiedene Inseln.

Neu ist die Wahl. Nach einer Session steht im Reveal **„Place it yourself"** neben
**„Leave it where it is"**. Der Platzier-Screen (`src/screens/IslandPlaceScreen.tsx`)
zoomt auf die Insel, das Objekt hängt halbtransparent unter dem Finger, rastet auf
das Halbmeter-Raster und zeigt seine Standfläche darunter: Akzentfarbe, wo es
stehen darf, dunkel, wo nicht. Abbrechen behält den automatischen Platz.

Ein Koordinatensystem für alles auf dem Screen: `ppp` Punkte je Bildpixel und das
sichtbare Fenster `view`. Das Hintergrundbild wird genau damit gelegt, das SVG
nimmt es als viewBox, und eine Berührung wird mit denselben zwei Zahlen
zurückgerechnet (`cellAt` in `islandZones.ts`, die exakte Umkehrung von
`cellCentre`; der Hin- und Rückweg ist in der Domain-Suite abgesichert).

#### Wann von Hand platziert wird (2026-09-15)

**Jannis:** „add to island soll man setzen können und man soll rearrangen können.
aber nicht bei growen ort ändern." Und danach: „man soll einfach ein ding nehmen,
draggen und wenn man loslässt ist es da fest. (außer es geht nicht dann bleibts im
dragging mode). Am ende per haken alle changes bestätigen."

Drei getrennte Fälle:

- **Neu dazugekommen** → das Reveal bietet „Place it yourself" an. Der Bildschirm
  schließt sich in diesem Fall **nicht** von allein; ein Angebot, von dem der
  Bildschirm nach einer Sekunde wegläuft, ist keins.
- **Umräumen** → eigener Modus über „Arrange" neben der Fortschrittsanzeige auf
  Home.
- **Gewachsen** → **keine** Ortsänderung. Was schon steht, behält seinen Platz.
  Beim Wachsen danach zu fragen würde eine Insel umsortieren, die der Spieler
  selbst gelegt hat, und zwar als Nebenwirkung davon, dass eine Session endet.

**Die Geste, verbindlich:** anfassen, ziehen, loslassen. Wo losgelassen wird,
steht es. Kein Aufheben-Tap, kein Bestätigen pro Objekt, kein Zurückschnappen.
Passt die Stelle nicht, **bleibt das Objekt in der Hand** und der nächste Zug
macht weiter — abgelehnt wird nie.

**Der Haken am Ende** übernimmt alle Züge und geht zurück. Bis dahin liegen sie
nur lokal im Screen, deshalb ändert Abbrechen nichts. Das ist der Unterschied
zwischen „jeder Zug schreibt sofort" und „ein Satz Änderungen, den man bestätigt".

Zwei Dinge brauchen dabei Refs statt State: das Objekt in der Hand und die Zelle
unter dem Finger. Die Geste läuft React voraus — Anfassen und Ziehen passieren
innerhalb **einer** Berührung, und das zweite Ereignis sähe sonst noch den Stand
von vor dem ersten. Ohne das ließe sich nichts bewegen.

Davon unberührt bleibt, dass `resolveSpots` ein Objekt umsetzt, das seinem Platz
entwachsen ist — das ist kein Angebot, sondern die Rettung vor einem Objekt, das
sonst verschwinden würde.

#### Fußabdruck statt Mittelpunkt

Vorher prüfte die App nur die **Mittelzelle** eines Objekts — der Kommentar im
Code sagte ausdrücklich, ein breiter Liegestuhl dürfe über die Wasserlinie ragen.
Genau das war auf den Bildern falsch. Jetzt gilt dieselbe Regel wie in `scene.py`:

- `LAND_FOOT` in `islandLand.ts` hat **je Wachstumsstufe** Block, Breite und Tiefe
  des Fußes. Vorher galt für jede Stufe der Fußabdruck der größten — damit passte
  auf Insel 1 kein einziges Strandobjekt auf den Sand.
- Der Fuß ist ein **Streifen, kein Quadrat**: ein Schritt (+1, −1) verschiebt das
  Bild 8 px zur Seite, (+1, +1) 4 px nach hinten. `ground` zählt Zellen längs des
  Ufers, `depth` wie weit der Fuß nach hinten reicht. Als Quadrat gerechnet würde
  eine Hütte Sand verlangen, den sie nie bedeckt.
- Jede Fußzelle muss der richtige Boden sein. Die Krone darf über den Strand
  ragen, der Stamm nicht im Sand stehen.

Die Strand-Obergrenzen sind dadurch auf `[4, 5, 6, 8, 8]` gegangen: bei 5 bzw. 8
voll ausgewachsenen Objekten fand auf Insel 1 und 3 nicht mehr jedes einen Platz,
und ein Objekt, das man besitzt, darf nie verschwinden.

#### Steinwege (`src/lib/islandPaths.ts`)

- **Welche Paare:** minimaler Spannbaum über die Gebäude — n − 1 Wege, alles hängt
  zusammen, nichts doppelt.
- **Wie ein Weg läuft:** Dijkstra auf dem Halbmeter-Raster. Wiese 10, Sand 20,
  eine Zelle mit vorhandenem Weg 3 — deshalb bündeln sich Wege, statt
  nebeneinander herzulaufen. Objekte und Wasser sind Wände; nur die Gebäude
  selbst sind offen, sonst erreicht kein Weg seine Tür.
- **Steine:** jede zweite **freie** Zelle bekommt eine Platte. Zellen unter einem
  Gebäude bleiben leer, sonst läge der Stein hinter dem Haus und der Weg sähe
  zerrissen aus.
- **Bild:** vier flache Platten mit weichen Ecken (`PATH_SLABS` in
  `export_layout.py`), etwas kleiner als ihre Zelle — das ist das „minimal
  spacing". Vier Varianten, damit ein Weg nicht gestempelt wirkt.

Fallstrick, der zwei Anläufe gekostet hat: `new Int32Array(n).fill(Number.MAX_SAFE_INTEGER)`
läuft über und wird zu −1, danach gilt jeder Vergleich als „schon billiger" und
es entsteht **kein einziger** Weg. Dafür steht jetzt `UNREACHED = 0x7fffffff`.

#### Maximalzahlen

`maxCount` steht je Objekt im Katalog (`growRewards.ts`), Zahlen aus §15.10:
Laubbaum 6, Busch 8, Tanne 5, Palme 5, Obstbaum 4, Blumenbeet 3, Grasbüschel 12,
Weltenbaum 1; jedes Gebäude 1. Gruppen zählen ihre Teile, `growPieceCount`
deckelt daran.

**Offen und wichtig:** Mehrere einzelne Bäume derselben Art gibt es damit noch
nicht. §14.3 gibt jedem Objekt genau **einen** Platz, der wächst — der Schlüssel
ist die Art, nicht das Exemplar. Sechs Laubbäume brauchen mehrere Instanzen je
Schlüssel im Wachstumsmodell (Zustand, Platzierung, Reveal). Bis dahin ist
`maxCount` die eingetragene Obergrenze für Gruppen und die Kapazitätsrechnung.

#### Grove entfernt

Auf Jannis' Wunsch ersatzlos. `GardenScreen` (Sternenhimmel) und `GardenPreview`
sind weg, `MainTabs` ist kein Tab-Navigator mehr, sondern rendert Home direkt —
der Routenname `MainTabs` bleibt, damit alle `navigate("MainTabs")` weiter
stimmen. `App.openNextPendingGrow` prüft entsprechend auf `MainTabs` statt auf
`Home`/`Grove`. Die Insel gibt es nur noch auf dem Homescreen.

### 15.14 Das Inselwachstum sichtbar machen (2026-09-15)

**Jannis:** „Wenn die Insel eine Stufe wächst — das Ereignis, auf das alles
hinarbeitet — tauscht der Hintergrund in einem Frame … Es kann gut sein, dass ein
Spieler es schlicht nicht bemerkt." Und: „`totalGrowthLevels` wird außerhalb von
`islandScene.ts` nirgends benutzt … Gleichzeitig blockt das System ihn mit
‚Island too small'. Das ist die frustrierende Hälfte ohne die motivierende."

Beides war richtig, und beides gehört zusammen: dieselbe Zahl, einmal als Wand und
einmal als Weg gelesen.

#### Die motivierende Hälfte

`islandGrowth(island)` in `islandScene.ts` liefert Stufe, gesammelte Level, die
Schwelle der nächsten Stufe, den Abstand dorthin und das Verhältnis dazwischen.
Rein, deshalb in der Domain-Suite abgedeckt.

Benutzt an **drei** Stellen — überall dort, wo vorher nur die Grenze stand:

- **Home, dauerhaft:** `IslandProgressPill` unter der Balance-Karte,
  „Insel II · 39 to grow" mit einem dünnen Balken. Bewusst klein und
  halbtransparent: sie liegt über der Insel, von der sie spricht.
- **Gesperrte Objekte:** „Island too small" heißt jetzt „39 to grow the island" —
  im Start-Sheet und im Reveal.
- **Volle Kategorie im Reveal:** nennt den Abstand statt nur „bis deine Insel
  wächst".

#### Das Ereignis

`IslandGrewOverlay`: das alte Inselbild liegt beim Wechsel noch über dem neuen,
hält einen Moment und blendet dann über 900 ms aus. Danach die Karte — welche
Insel erreicht wurde und wie breit sie jetzt ist (`ISLAND_STAGE_METRES`), mit
Erfolgs-Haptik.

Gezeigt **genau einmal je Stufe**. `islandStageSeenByUser` im Island-Slice merkt
es sich, persistiert, und zählt nur vorwärts — eine von einem anderen Gerät
gemergte Insel darf keine Stufe ankündigen, die der Spieler schon gesehen hat.
Beim ersten Mal, wenn für ein Konto noch nichts vermerkt ist, wird die aktuelle
Stufe stillschweigend als gesehen eingetragen: eine frische Installation feiert
nicht die Insel, mit der sie startet.

Bei reduziertem Bewegungsumfang entfällt die Überblendung, die Karte erscheint
sofort. Die Karte blockiert nie: Button **und** Hintergrund schließen sie.


### 15.15 Mehrere Exemplare einer Art (2026-09-16)

`maxCount` sagte sechs Laubbäume, das Modell gab jedem Schlüssel genau einen
Platz. Die Zahl war eine Zahl ohne etwas dahinter. Jetzt nicht mehr.

**Die Kennung entscheidet.** Ein Objekt auf der Insel heißt `leafy_tree`,
`leafy_tree#2`, `leafy_tree#3` (`src/lib/islandInstances.ts`). Daraus folgt alles
Weitere:

- Was **aussieht wie** — Sprite, Fußabdruck, Katalogeintrag — geht über den
  **Grundschlüssel**. Kopien sind dasselbe Objekt.
- Was **welches ist** — Platz, Level, Kollision — geht über die **Kennung**.
  Kopien sind eigenständig und wachsen jede für sich aus einem Samen.

Inseln, die vor dieser Änderung gespeichert wurden, enthalten reine Schlüssel —
und das sind genau die Kennungen der ersten Exemplare. Nichts zu migrieren.

**Wohin die Belohnung geht:** an das erste Exemplar, das noch nicht ausgewachsen
ist. Erst wenn alle fertig sind, beginnt das nächste — und erst wenn die erlaubte
Anzahl steht, ist das Objekt wirklich fertig. Im Reveal steht dann „Another one,
stage 3" statt „Fully grown", und das ist der einzige Weg, auf dem ein Spieler
überhaupt erfährt, dass mehr als eines möglich ist.

**Nebenbefund, der dabei auffiel:** `resolveSpots` ließ Objekte fallen, wenn kein
Platz mehr da war — auf Insel 1 verschwanden Volleyballnetz und Strandbar
kommentarlos. Was man besitzt, darf nie einfach weg sein. `findSpot` hat jetzt
einen letzten Ausweg: der richtige Boden, egal wie eng es neben den Nachbarn ist.
Zwei Dinge Schulter an Schulter sind ein Schönheitsfehler, ein verschwundenes
Objekt ist ein Verlust.

`TOTAL_GROWTH_LEVELS` zählt jetzt jede Kopie — sechs Laubbäume sind sechsmal zehn
Stufen Arbeit. Damit wandert auch die Schwelle der Inselgrößen.

### 15.16 Wasserobjekte ragten aus dem Bild (2026-09-16)

Auf Insel 1 lagen Steg, Flaggschiff, eine Boje, eine Felsgruppe und eine
Delfinschule halb außerhalb der Leinwand, auf Insel 2 drei Stücke, auf Insel 3
eines. Ursache und Lösung stehen in `island/SPRITES.md` §10 („Warum die Teile auf
kleinen Inseln knapper sitzen"); kurz:

Insel, Flachwasser und Leinwand skalieren zusammen, die Bilder nicht. Auf Stufe 1
ist die Leinwand 165 px breit und die Insel selbst 138 — links und rechts bleiben
zwölf Pixel Wasser, weniger als ein Boot breit ist. Der alte Export durfte eine
Gruppe höchstens 16 px zurückschieben und ließ den Rest über den Rand laufen.

Jetzt schiebt er so weit, wie es nötig ist, und lässt eine Gruppe, die dabei auf
Land oder unter ein anderes Stück geriete, die Küste entlang zum nächsten freien
Wasser wandern. Der Steg darf den Strand wechseln, aber nie von ihm herunter; sein
Winkel wird direkt auf der kleinsten Insel gewählt (291° statt 229°, ungespiegelt),
damit er auf allen fünf Stufen am selben Fleck liegt. Geprüft wird ab jetzt die
gezeichnete Position, nicht der Wunschplatz.

**Alle fünf Stufen sind sauber.** Regenerieren:

    python3 island/pixel/layout.py && python3 island/pixel/export_layout.py --preview

### 15.17 Die Flotte wächst mit der Insel (2026-09-16, Jannis)

Dieselbe Ursache, zweite Folge: Die volle Besatzung sind 72 Stücke. Um die größte
Insel gelegt wirkt das ruhig, um eine Zwölf-Meter-Insel wie ein Stau. Jannis wollte
das Design angepasst haben.

**Regel:** Eine Insel zeigt so viel Flotte, wie ihr Wasser trägt. Die Zahl wird
gemessen, nicht geschätzt — Details und Tabelle in `island/SPRITES.md` §9 („Wie
groß die Flotte auf einer Insel ist"). Insel 1 zeigt 4 Boote, 3 Bojen, 2 Kajaks,
6 Felsen und eine Delfinschule; Insel 3 hat schon fast alles; Insel 4 und 5 alles.

**Zwei Regeln schützen den Spieler dabei:**

- Jede Gruppe zeigt mindestens ein Stück. Was man besitzt, muss irgendwo sein.
- Die Flotte wird nie kleiner, wenn die Insel wächst. Der Domain-Test prüft beides
  über alle fünf Stufen.

Was über dem Limit liegt, ist nicht verloren, sondern kommt beim nächsten
Inselwachstum heraus — ein Grund mehr, die Insel wachsen zu lassen.

### 15.18 Das Ende der Belohnungsschleife (2026-09-16, Jannis)

Jannis: „Ab der größten Insel gibt es kein Ziel mehr — kein ‚noch X bis…', und
wenn alles ausgewachsen ist, verfällt die Belohnung. Freunde sehen die Insel
außerdem gar nicht."

**Erst ein Rechenfehler, der darunter lag.** `maxCount` bedeutet zweierlei: bei
`stages`/`resize` die Anzahl der Kopien (sechs Laubbäume), bei `multiply` die
Anzahl der Stücke, die *ein* Objekt zeigt (zehn Bojen, und `shells_10` zeichnet
schon acht Muscheln in einem Bild). Die Kopien-Mechanik aus §15.15 las die Zahl
überall als Kopien — damit hätte das Spiel nach der zehnten Boje `buoys#2`
angeboten, deren Stufen das Wasser nie zeichnet, und zehn Muschelhaufen à acht
Muscheln an den Strand gelegt. `growCopies()` trennt das jetzt: eine Gruppe ist
ein Objekt. Der Katalog schrumpft damit von 1573 auf **583 Stufen** — die echte
Zahl, und ohne sie wäre jedes Ziel unten gelogen gewesen.

**Nach Insel V geht es weiter.** Die letzte Inselgröße kommt bei 240 Stufen, der
Katalog hat 583. Es bleibt also mehr übrig, als bis dahin gesammelt wurde. Die
Pille misst ab Insel V deshalb die Sammlung statt der nächsten Größe:
„Island V · 181 to finish", Balken über den ganzen Katalog. „complete" steht erst
da, wenn jede Kopie jedes Objekts ausgewachsen ist.

**Eine fertige Insel ist ein Abschluss.** Der Reveal sagte „Your island is fully
grown" und warf die Belohnung weg. Jetzt: „Your island is finished", die 583
Stufen werden genannt, und es steht dabei, dass die Session weiter für Stunden,
Streak und Statistik zählt. Eine *zu kleine* Insel verhält sich wie vorher — die
Belohnung wartet und landet beim nächsten Wachstum von selbst.

**Offen, bewusst nicht entschieden:** Was nach einer vollständigen Sammlung
kommt — eine zweite Insel, Prestige, kosmetische Ziele — ist eine
Produktentscheidung und keine Fehlerbehebung. 583 Stufen sind sehr weit weg;
bis dahin ist die Schleife jetzt durchgehend sichtbar.

**Freunde sehen die Insel.** Zwei Zahlen wandern mit der Insel auf den Server
(`island_state.stage`, `island_state.levels`) und kommen über
`get_friends_weekly` zurück: Größe und gewachsene Stufen, sonst nichts — nicht,
was daraufsteht, und nicht, wo. In der Liste steht neben jedem Namen ein kleines
Inselbild; weil alle fünf Bilder die Insel gleich breit zeigen, wächst statt des
Bildes der Rahmen mit den echten Metern, sonst wäre Insel I von Insel V nicht zu
unterscheiden.

### 15.19 Freunde besuchen sich (2026-09-16, Jannis)

Die Freundeszeile zeigt jetzt drei Zahlen in festen Spalten — **Check-ins**
(Besuche diese Woche gegen das Wochenziel), **Focus** (Stunden diese Woche gegen
das Ziel) und **All time** (alle je gesammelten Stunden, Fokus und Besuche
zusammen). Der frühere Fortschrittsbalken ist weg: „12.4 / 15h" sagt dasselbe,
und drei Zahlen an immer derselben Stelle liest man im Vorbeigehen.

**Das Inselbild ist antippbar.** Es führt auf `FriendIslandScreen`: die Insel
formatfüllend mit allem, was daraufsteht, oben links Zurück, oben rechts Name und
Größe. Sonst nichts — keine Statistik, keine Aktionen, nichts, das sich ändern
ließe.

**Was den Account verlässt, ist jetzt zweistufig:**

- Größe und Stufen (`island_state.stage`, `island_state.levels`) wandern mit
  jeder Speicherung mit und stehen in der Liste.
- Was *auf* der Insel steht, holt `get_friend_island` erst beim Besuch — und nur
  für jemanden, der beim Besitzer als Freund eingetragen ist. Die Funktion prüft
  den Freundeslink selbst und gibt nichts als Objekte und Plätze zurück: keine
  Sessions, keine Ziele, keine Zeiten.

Das ist eine bewusste Erweiterung gegenüber §15.18, wo nur die Größe reiste. Eine
Insel besuchen heißt, sie zu sehen; der Text neben dem Freundescode sagt das jetzt
auch.

### 15.20 Greifen nach Bild, Laden am Stück (2026-09-17, Jannis)

**„Bei einem Haus muss man ganz unten draggen."** Stimmt: das Verschieben fragte,
welche *Bodenzelle* berührt wurde, und die liegt beim Fundament. Ein Haus wird
aber hoch und nach oben von dieser Zelle weg gezeichnet — der ganze sichtbare
Körper lag außerhalb des Ziels.

Jetzt entscheidet das Bild. `spriteReach` sagt, wie weit ein Punkt von einem
Sprite entfernt ist: 0, wenn er auf einem gezeichneten Pixel liegt, sonst der
Abstand zum Bildrahmen. Ein Treffer gewinnt sofort, vorderstes Objekt zuerst;
trifft nichts, bekommt es das nächste Bild im Umkreis von 6 Bildpixeln — eine
Fingerkuppe ist breiter als ein Pixel, und ein Setzling ist nur ein paar Pixel
Grün. Nachgemessen im Simulator: 25 Bildpixel über dem Fundament greift jetzt das
Haus.

Nebenbei repariert: Die Kandidaten waren nach `i + j` absteigend sortiert und der
Kommentar behauptete „vorne zuerst". In der 2:1-Ansicht ist größeres `i + j`
weiter *hinten* — bei zwei überlappenden Objekten gewann also das hintere.
Sortiert wird jetzt nach absteigendem y, also der Zeichenreihenfolge rückwärts.

**Insel eines Freundes lädt am Stück.** Vorher stand sofort Insel I da und wurde
ausgetauscht, sobald die echte Größe eintraf — man sah kurz die Insel von jemand
anderem. Jetzt wird gar nichts von der Insel gezeigt, bis Daten *und*
Hintergrundbild fertig sind (`onLoad`); solange läuft eine Ladeanzeige auf offener
See (`PAPER.openSea`), dann blendet die ganze Szene in 340 ms auf einmal ein.
Zurück geht ab dem ersten Bild — ein Ladebildschirm, den man nicht verlassen kann,
ist schlimmer als ein langsamer.
