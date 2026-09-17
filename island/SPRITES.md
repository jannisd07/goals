# SPRITES.md — Pixel-Sprites der Insel

Stand 2026-09-10. Wie jedes Insel-Objekt als Pixel-Sprite aussieht und geliefert
wird. Katalog und Wachstum stehen in `WACHSTUM.md` §14–15. Begonnen mit den
Pflanzen; Strand, Wasser, Gebäude und Sonderobjekte folgen nach demselben Muster.

Die Pflanzen erzeugt `island/pixel/plants.py`: Ein Lauf zeichnet alle PNGs, das
Manifest und die Vorschauen neu. Stil-Änderungen gehören ins Skript, nicht von
Hand in die PNGs, sonst überschreibt sie der nächste Lauf.

```bash
python3 island/pixel/plants.py island/pixel assets/home/ocean-pixel-1.png
```

Vorschauen in `island/pixel/previews/`:
- `plants-scene.png`: Stufe-I-Insel mit allen Pflanzen, so groß wie auf Home
  (iPhone @3x).
- `plants-sheet.png`: alle 80 Bilder mit ihrem Footprint.
- `plants-density.png`: derselbe Baum mit 12, 16 und 24 px pro Meter.

---

## 1. Wie pixelig

| Größe | Wert |
|---|---|
| Boden | 16 Art-Pixel pro Meter; eine 0,5-m-Unterzelle ist eine Raute von 8 × 4 px |
| Höhe | 10 Art-Pixel pro Meter, passend zur 2:1-Projektion |
| Objekte | 6 px (Grasbüschel) bis 67 px (Weltenbaum Stufe 3) hoch |
| Auf dem Handy | Insel-Stufe I mit D = 6: 1 Art-Pixel = 6 Gerätepixel = 2 pt. Stufe II D = 4 (1,33 pt), Stufe III D = 3 (1 pt) |

Beispiel: Der große Laubbaum ist 26 × 34 px, auf Home also etwa 52 × 68 pt.

**Warum 16 px pro Meter:**
- Mit 12 px werden Kronen zu Klecksen, Früchte und Blüten sind kaum lesbar.
- Mit 24 px wird das Inselbild 1,5-mal so breit (Stufe I 288 statt 192 px) und
  passt nur noch mit D = 4 aufs Handy. Jedes Sprite hat 2,25-mal so viele Pixel.
- 16 px ist das Maß, auf dem Tabelle 15.2 in `WACHSTUM.md` (Kamera D, Inselbreiten)
  aufbaut.

**Korrektur `WACHSTUM.md` §15.1:** Die Formel stand dort mit `· 8` und `· 4`. Mit
8 × 4 px pro Unterzelle und Tabelle 15.2 (12 m = 192 px) lautet sie
`artX = (gx − gy) · 4`, `artY = (gx + gy) · 2`. Dort korrigiert.

## 2. Regeln für jedes Sprite

1. **Blick:** 2:1-Pixel-Iso wie die Insel. Der Footprint ist eine Raute am Boden;
   Kronen, Dächer und Wedel dürfen darüber hinausragen.
2. **Licht von oben links.** Hellste Töne oben links, dunkelste unten rechts, bei
   jedem Objekt gleich.
3. **Tonstufen statt Verläufe.** Pro Material bis zu fünf feste Töne: Kontur,
   Schatten, Basis, Licht, Glanz. Kein Anti-Aliasing, kein Dithering.
4. **Kontur 1 px** rundherum in der dunkelsten Farbe des Materials, nie Schwarz
   (Blätter `#1E4A2C`, Holz `#4A2E1A`). Nur waagerecht und senkrecht angrenzend,
   damit keine doppelten Treppenpixel entstehen. Objekte aus mehreren Teilen
   bekommen pro Teil eine Kontur (jeder Palmwedel einzeln).
5. **Winzige Bodendeko ohne Kontur und Schatten:** Grasbüschel, Blumen im Beet.
6. **Bodenschatten:** flache Ellipse (2:1) am Fuß, leicht nach rechts versetzt,
   Schwarz mit 25 % Deckkraft. Das sind die einzigen halbtransparenten Pixel;
   alles andere hat Alpha 0 oder 255.
7. **Nur Palettenfarben** (§4). Eine neue Farbe braucht einen Namen. Budget für
   die ganze Insel: 24 Farben, die Pflanzen brauchen 12.
8. **Wachstum:** Alle Stufen eines Objekts teilen Anker, Palette und Licht. Jede
   Stufe ist deutlich größer oder bringt ein sichtbares neues Merkmal.
9. **An der Silhouette erkennbar,** auch bei D = 3: Laubbaum rund, Tanne gestuft,
   Palme mit Wedelstern, Busch flach und breit.

## 3. Lieferformat

- PNG, RGBA, Originalgröße (1 ×). Vergrößert wird nur in der App, ganzzahlig und
  ohne Glättung.
- Dateiname `<key>_<stufe>.png`, Keys wie in `src/lib/growRewards.ts`.
  Mehrfach-Objekte (multiply) haben ein Bild `<key>.png`, optional Varianten
  `<key>_v2.png`, `<key>_v3.png`.
- `manifest.json` pro Kategorie: Größe, Anker, Footprint (Unterzellen), Höhe in
  Metern, Ebene (`object` oder `ground`).
- **Anker** = Pixelkante unter der vorderen (unteren) Spitze der Footprint-Raute.
  Die App setzt diesen Punkt auf die Rasterposition.
- **Beim Einbau beachten:** React Native glättet hochskalierte PNGs auf iOS. Also
  entweder vorab ganzzahlig vergrößerte PNGs ausliefern oder die Pixel wie in
  `src/components/PixelArt.tsx` als SVG-Rechtecke zeichnen.

## 4. Palette der Pflanzen

| Token | Hex | Verwendung |
|---|---|---|
| `leaf_outline` | `#1E4A2C` | Kontur aller Pflanzen und Blüten |
| `leaf_dark` | `#2F7239` | Blätter im Schatten, Tannen |
| `leaf_mid` | `#4F9E4B` | Blätter Basis (= `canopy_a`) |
| `leaf_light` | `#7EC15A` | Blätter im Licht (= `canopy_b`) |
| `leaf_highlight` | `#B8E070` | Glanz oben links, Grasspitzen |
| `wood_outline` | `#4A2E1A` | Kontur Holz, Krümel in der Beeterde |
| `wood_dark` | `#7A4E2B` | Stamm Schattenseite, Erde |
| `wood_light` | `#B9834F` | Stamm Lichtseite, Beetrahmen (= `wood`) |
| `blossom` | `#F1A8BC` | Blüten (= `canopy_blossom`) |
| `blossom_light` | `#FCE4EA` | Blütenglanz, Glanzpunkt auf Früchten |
| `fruit` | `#E9605A` | Früchte, rote Blumen (= `flower_coral`) |
| `gold` | `#F6CF4C` | goldene Blätter und Funken am Weltenbaum, gelbe Blumen (= `flower_yellow`) |

Die Grundtöne kommen aus `ISLAND.md` §3.2; ergänzt sind Kontur-, Schatten- und
Glanztöne.

## 5. Pflanzen: 10 Wachstumsstufen je Pflanze (80 Bilder)

Stand 2026-09-14 (Jannis): Jede Pflanze hat **10 Stufen**, `key_01.png` bis
`key_10.png`. Stufe 1 ist Saatgut (Erdhügel mit erstem Trieb), Stufe 2 ein
Keimling, ab da wächst die Pflanze bis zur vollen Größe. Die Schritte sind
bewusst klein: Eine Höhenrampe in echten Pixeln (je Stufe rund 10–30 % mehr)
wählt die passende handgezeichnete Stufe und skaliert sie auf die Zielhöhe, und
keine Stufe darf kleiner sein als die vorige. Blumenbeet wächst in der Fläche,
Grasbüschel über die Anzahl der Büschel (1, 2, 3), der Weltenbaum nutzt die
Laubbaum-Stufen als Jugendphase. Erzeugt von `island/pixel/plants.py`.

### Die alten Schlüsselstufen (bleiben die Vorlagen)

Größen in Art-Pixeln (Breite × Höhe, inklusive Schatten). Footprint in Unterzellen.

### Laubbaum `leafy_tree` — 5 Stufen, Footprint 1 × 1 (nur Stamm)

| Stufe | Bild | Größe | Höhe | Was man sieht |
|---:|---|---|---:|---|
| 1 | Keimling | 9 × 7 | 0,4 m | Stängel mit zwei Blättern als V |
| 2 | Setzling | 10 × 13 | 1,0 m | Stamm 1 px, eine runde Krone |
| 3 | Jungbaum | 14 × 20 | 1,8 m | Stamm 2 px, Krone aus 3 Büscheln |
| 4 | Baum | 20 × 27 | 2,4 m | Krone aus 6 Büscheln |
| 5 | Großer Baum | 26 × 34 | 3,0 m | Stamm 3 px mit Wurzelansatz, Krone aus 9 Büscheln |

### Busch `bush` — 3 Stufen, Footprint 1 × 1 → 2 × 2

| Stufe | Bild | Größe | Höhe | Was man sieht |
|---:|---|---|---:|---|
| 1 | klein | 12 × 9 | 0,45 m | 3 Büschel |
| 2 | voll | 18 × 13 | 0,65 m | 5 Büschel, breit und flach |
| 3 | blühend | 18 × 14 | 0,75 m | wie 2, etwas voller, rosa Blüten |

### Obstbaum `fruit_tree` — 3 Stufen, Footprint 1 × 1

| Stufe | Bild | Größe | Höhe | Was man sieht |
|---:|---|---|---:|---|
| 1 | Jungbaum | 14 × 18 | 1,6 m | runde, hellere Krone, 4 erste Blüten |
| 2 | Blüte | 20 × 26 | 2,2 m | Krone voller rosa und hellrosa Blüten |
| 3 | Früchte | 20 × 26 | 2,3 m | 7 rote Früchte (2 × 2 px mit Glanzpunkt), keine Blüten |

### Tanne `fir_tree` — 3 Stufen, Footprint 1 × 1

| Stufe | Bild | Größe | Höhe | Was man sieht |
|---:|---|---|---:|---|
| 1 | klein | 10 × 12 | 1,0 m | 2 Etagen |
| 2 | mittel | 14 × 23 | 2,0 m | 3 Etagen |
| 3 | hoch | 18 × 33 | 3,1 m | 4 Etagen, ausgefranste Unterkanten |

Dunkler als der Laubbaum: Schatten und Basis `leaf_dark`, Lichtseite `leaf_mid`.

### Palme `palm_tree` — 3 Stufen, Footprint 1 × 1

| Stufe | Bild | Größe | Höhe | Was man sieht |
|---:|---|---|---:|---|
| 1 | klein | 14 × 15 | 1,2 m | kurzer Stamm, 4 Wedel |
| 2 | mittel | 21 × 26 | 2,2 m | Stamm mit Ringen, leicht geneigt, 6 Wedel |
| 3 | hoch | 26 × 38 | 3,2 m | stärker geneigt, 7 Wedel, 3 Kokosnüsse |

Ab Stufe 2 hat jeder Wedel eine eigene Kontur, damit die Krone nicht zum Hut wird.

### Weltenbaum `world_tree` — 3 Stufen, Footprint 2 × 2 → 3 × 3 → 4 × 4

| Stufe | Bild | Größe | Höhe | Was man sieht |
|---:|---|---|---:|---|
| 1 | junger Weltenbaum | 39 × 40 | 3,4 m | breite, flache Krone, dicker Stamm mit zwei Ästen, Wurzeln |
| 2 | Weltenbaum | 50 × 50 | 4,4 m | größer, Astloch im Stamm, erste goldene Blätter, ein Funke |
| 3 | uralter Weltenbaum | 60 × 67 | 5,4 m | größte Pflanze, viele goldene Blätter, 4 Funken |

### Blumenbeet `flower_bed` — 3 Größen, Bodenebene

| Größe | Bild | Footprint | Was man sieht |
|---:|---|---|---|
| 1 | 14 × 8 | 2 × 2 | Erde mit 4 Blumen (rot, gelb, rosa) |
| 2 | 22 × 12 | 3 × 3 | 9 Blumen |
| 3 | 30 × 17 | 4 × 4 | 16 Blumen, Holzrahmen an der Vorderkante |

### Grasbüschel `grass_tufts` — 1 Bild und 2 Varianten, Bodenebene, bis 12 Stück

`grass_tufts.png` 10 × 7, `grass_tufts_v2.png` 10 × 7, `grass_tufts_v3.png` 7 × 6.
4–5 Halme, dunkler Fuß, helle Spitze, ohne Kontur und Schatten.

## 5b. Gebäude: 8 bis 12 Stufen je Gebäude (102 Bilder)

Stand 2026-09-14: `island/pixel/buildings.py` zeichnet die 10 Katalog-Gebäude in
`island/pixel/buildings/`, Dateien `key_01.png` aufwärts. Die **Stufenzahl richtet
sich nach Größe und Detailgrad** (Jannis): Trainingsplatz 8, Gewächshaus und
Yoga-Pavillon 9, Haus, Café und Werkstatt 10, Windmühle und Bootshaus 11,
Bibliothek und Sternwarte 12. Die Detailschwellen im Code sind für zehn Stufen
geschrieben und werden auf die jeweilige Anzahl umgerechnet, damit sie relativ an
derselben Stelle sitzen. `manifest.json` nennt zu jedem Bild `level` und `stages`. Stufe 1
ist die Baustelle (Fundament mit Pfosten), danach wächst das Gebäude über eine
Größenrampe, und Details kommen ab festen Stufen dazu: Fenster ab 5, Schornstein,
Markise oder Kuppel ab 6 bis 8. Palette, Licht und Projektion kommen aus
`plants.py`, ergänzt um Wand, Dach, Stein, Glas und Dunkelholz. Jedes Gebäude
gibt es einmal pro Insel (WACHSTUM.md §15.10).

Jedes Gebäude trägt sein Zeichen in Gold über dem Dach: Buch, Tasse, Hammer,
Blatt, Hantel, Anker, Lotus, Stern. Auf der Wand gingen die Symbole bei 25 px
unter, als Silhouette gegen den Himmel lesen sie sich. Die Sternwarte ist ein
runder Turm, damit die Kuppel wirklich darauf sitzt.

Zwei Gebäude sind bewusst aufwendiger: Das **Bootshaus** hat ab Stufe 4 ein Boot
neben der Rampe (rot, damit es sich gegen Sand und Holz absetzt; als Pixelbild
`BOAT_ART` gezeichnet, weil Quader und Ellipsen bei 20 px kein Boot ergeben),
ab Stufe 8 mit Rudern. Die **Sternwarte** ist ein verjüngter Turm mit Umgang und
Geländer ab Stufe 7, heller Kuppel ab Stufe 5, Spalt ab 6, Teleskop mit Linse ab
8 und Sternen ab 10.

## 5c. Strandobjekte: 8 bis 12 Stufen je Objekt (76 Bilder)

Stand 2026-09-14: `island/pixel/beach.py` zeichnet die acht Strandobjekte in
`island/pixel/beach/`, Dateien `key_01.png` aufwärts. Stufenzahl wie bei den
Gebäuden nach Umfang: Surfbretter 8, Lagerfeuer, Liegestühle, Hängematte und
Volleyballnetz je 9, Sandburg und Muscheln je 10, Strandbar 12.

Wachstum je Objekt:

- **Sandburg:** Sandhaufen, ab Stufe 3 Mauer mit Zinnen, ab 5 Ecktürme, ab 6 Tor,
  ab 8 Fahne, ab 9 Wimpel auf den Türmen.
- **Lagerfeuer:** Steinring, ab 3 Scheite, ab 4 Flamme die mitwächst, ab 7 Funken.
- **Liegestühle:** 1 bis 3 Stühle mit Streifenbespannung, ab 6 ein Sonnenschirm.
- **Muscheln:** 1 bis 11 Muscheln und Seesterne, von Hand verteilt statt in Reihe.
- **Surfbretter:** 1 bis 5 Bretter mit spitzer Nase, unterschiedlich geneigt.
- **Hängematte:** zwei Pfosten, ab 3 das Tuch das tiefer durchhängt, ab 6 Kissen,
  ab 8 ein Buch.
- **Volleyballnetz:** Pfosten, ab 3 echtes Netzgitter, ab 6 Spielfeldlinien, ab 8 Ball.
- **Strandbar:** Theke, ab 4 Strohdach auf Pfosten, ab 6 Flaschen, ab 8 Hocker,
  ab 10 Laterne.

Neue Materialien dafür: Sand, Stoff, Leinen, Flamme, Muschel, Fels, Stroh.

### Weltmaßstab: `beach.SCALE`

Zwei Grenzen gelten gleichzeitig.

**1. Neben den Pflanzen.** Ein ausgewachsener Laubbaum ist 26 × 34 px — 2,6 m breit,
3,4 m hoch. Die erste Fassung war durchweg baumgroß: eine Sandburg von 37 × 32 px
ist 2,3 m breit und 3,2 m hoch und damit größer als ein Baum.

**2. Auf den Sand.** Das Sandband der Insel ist nur 0,5 bis 1,7 m breit, und die
nutzbare Uferlinie auf Stufe 5 beträgt rund 218 px. Alle acht Objekte in Endstufe
zusammen dürfen nicht breiter sein als das, sonst steht zwangsläufig etwas im Gras.
Das war die zweite Korrektur: Strandobjekte gehören auf den Strand, nicht halb
daneben.

Die Baupläne sind unverändert geblieben, sie werden nur im richtigen Maßstab
gerastert (`Sprite(s)`, kein Resampling — darum bleiben die Kanten sauber):

| Objekt | Faktor | Endstufe | real |
|---|---:|---|---|
| Strandbar | 0,72 | 30 × 25 | Hütte 1,9 m breit, 2,5 m hoch |
| Lagerfeuer | 0,78 | 16 × 15 | Steinring 1,0 m |
| Surfbretter | 0,68 | 19 × 23 | Bretter 2,3 m lang |
| Volleyballnetz | 0,64 | 25 × 18 | Netz 1,8 m hoch |
| Hängematte | 0,69 | 22 × 16 | 1,4 m zwischen den Pfosten |
| Liegestühle | 0,60 | 21 × 23 | Schirm 1,3 m breit, 2,3 m hoch |
| Muscheln | 0,56 | 24 × 8 | Muschelfeld 1,5 m |
| Sandburg | 0,55 | 21 × 19 | 1,3 m breit, 1,9 m hoch |

**Regel für alle weiteren Strandobjekte:** erst gegen den Laubbaum prüfen, dann
gegen das Sandband. `scene.py` bricht mit einer Meldung ab, wenn ein Objekt
nirgends ganz auf den Sand passt — dann muss der Faktor runter, nicht die Regel.

### Der Strand der Insel (2026-09-14)

`BEACH_AT_92` in `island/pixel/ocean.py` ist von **4,2 auf 5,2** gestiegen. Das
Sandband war nur 0,5 bis 1,7 m breit; die Objekte passten nicht darauf, ohne halb
im Gras zu stehen. Das Band zu verbreitern war der bessere Weg, als jedes Sprite
noch einmal zu verkleinern — optisch ist der Unterschied dezent, die Insel bleibt
grün.

Das ändert **alle** Inselbilder. Nach jeder Änderung an `BEACH_AT_92`:

```bash
python3 island/pixel/ocean.py island/pixel --sizes   # Hintergründe + Vorschauen
python3 island/pixel/zones.py                        # zones.json neu einstufen
python3 island/pixel/layout.py                       # Wasserplätze folgen der Küste
```

Danach die Hintergründe mit `Image.NEAREST` um ihren Zoomfaktor `d` hochskalieren
und nach `assets/home/pixel-island-<stufe>.png` kopieren — das sind die Bilder,
die `src/lib/homeIslandStages.ts` lädt.

### Beispielanordnung

`python3 island/pixel/scene.py <stufe>` setzt die Objekte auf die echte Insel und
schreibt `island/pixel/previews/scene-<stufe>{,-crop,-details}.png`.

Drei Regeln, die das Skript durchsetzt:

- **Nur Sand, ganz.** `foot_pixels()` nimmt das untere Drittel der undurchsichtigen
  Pixel — ein Sonnenschirm ist oben breit und unten schmal —, und **jeder** dieser
  Fußpixel muss auf Sand liegen. Nicht ins Gras, nicht über die Wasserkante. Was
  ein Objekt weiter oben vor dem Wasser verdeckt, ist in der 2:1-Ansicht dagegen
  richtig. Gesucht wird über Winkel **und** Abstand zur Wasserlinie.
- **Mehrere Buchten, nicht eine.** Auf Stufe 5 sind drei der fünf Sandabschnitte
  breit genug: rechts (341–24°), vorne links (125–157°) und hinten (268–299°).
  Jede bekommt eine Gruppe, die zusammengehört.
- **Nichts verschwindet hinter etwas anderem.** Zwei Objekte auf ähnlicher Tiefe
  müssen seitlich mindestens 90 % ihrer mittleren Breite auseinanderliegen.

**Kleine Inseln:** Statt abzubrechen nimmt das Skript die höchste Wachstumsstufe,
die dort noch ganz auf den Sand passt. Die Insel wächst, die Objekte wachsen mit.
Das ist keine Notlösung, sondern das gewünschte Verhalten — so passt jedes Objekt
auf jede Insel:

| Objekt | Stufen | Insel 1 | Insel 2 | Insel 3 | Insel 4 | Insel 5 |
|---|---:|---:|---:|---:|---:|---:|
| Muscheln | 10 | 10 | 10 | 10 | 10 | 10 |
| Lagerfeuer | 9 | 9 | 9 | 9 | 9 | 9 |
| Sandburg | 10 | 4 | 7 | 10 | 10 | 10 |
| Surfbretter | 8 | 5 | 7 | 8 | 8 | 8 |
| Liegestühle | 9 | 4 | 4 | 9 | 9 | 9 |
| Hängematte | 9 | 1 | 9 | 9 | 9 | 9 |
| Volleyballnetz | 9 | 1 | 5 | 9 | 9 | 9 |
| Strandbar | 12 | 3 | 3 | 8 | 12 | 12 |

Die Zahl ist die höchste Stufe, die allein auf den Sand passt. Wie viele Objekte
gleichzeitig Platz haben, ist eine zweite Grenze: auf Stufe 5 alle acht, auf
Stufe 1 vier.

Die Pflanzen werden erst nach den Strandobjekten gesetzt. Gesperrt wird nicht nur
der Standpunkt, sondern auch das Stück Wiese **davor**: ein Baum mit 67 px hoher
Krone steht zwar korrekt im Vordergrund, verdeckt das Objekt dahinter aber
vollständig. Gezeichnet wird am Ende alles gemeinsam nach Tiefe sortiert.

## 6. Offen

1. ~~Abnahme durch Jannis, Einbau der 10 Stufen in den Katalog und in den
   Fokus-Ring.~~ Erledigt: Jannis hat die Pflanzen am 2026-09-14 abgenommen,
   `maxLevel` ist überall die Zahl der Bilder, und das Objekt im Fokus-Ring
   wächst über die Stufen (`src/components/grow/GrowingObject.tsx`).
2. ~~Einbau in die App statt der SVG-Platzhalter.~~ Erledigt: alle vier
   Kategorien zeichnen echte Sprites; die Formen in
   `src/components/grow/GrowObjectArt.tsx` sind nur noch Rückfall.
3. Weiter mit den Sonderobjekten der Roadmap. Die
   Icons in `src/components/PixelArt.tsx` sind Frontansichten und brauchen dafür
   2:1-Versionen.

## 7. Zonenkarte `island/pixel/zones.json`

Damit später kein Objekt im Wasser oder auf einem Felsen landet, liegt für jedes
der fünf Inselbilder eine Karte bereit: Für jede halbe-Meter-Zelle steht darin,
ob sie Wiese, Strand, Fels, Flachwasser oder offenes Meer ist.

Erzeugt von `island/pixel/zones.py` (neu laufen lassen, sobald sich `ocean.py`
oder eine Inselgröße ändert):

```bash
python3 island/pixel/zones.py
```

### Wie die Einstufung entsteht

Jede Zelle ist im Bild eine Raute aus 16 Pixeln (8 × 4). Das Skript zählt deren
Farben und nimmt die Mehrheit — nicht nur einen einzelnen Pixel, sonst würde ein
Kiesel oder ein Schaumtupfer die ganze Zelle kippen. Ein Findling, der mehr als
40 % der Zelle bedeckt, macht sie zu `R` (blockiert). Nackte Erde innerhalb der
Insel zählt als Wiese, außerhalb als Kante.

Zur Gegenprobe wird dieselbe Zelle aus der Geometrie bestimmt, aus der das Bild
gezeichnet wurde. Die Übereinstimmung steht in der Datei; sie liegt bei 98–99 %.
Die Abweichung sind Randzellen, die halb im Wasser liegen.

### Aufbau der Datei

| Feld | Bedeutung |
|---|---|
| `legend` | was `G`, `B`, `R`, `S`, `D` und `.` bedeuten |
| `grid` | Umrechnung Zelle → Pixel, Zellgröße, Tiefensortierung, Küstenregel |
| `stages[]` | pro Inselstufe: Bild, Leinwand, Kamera-Zoom, Inselradius |
| `stages[].bounds` | kleinster und größter Zellindex |
| `stages[].rows` | die Karte: eine Zeichenkette pro `i`-Zeile, ein Zeichen pro `j` |
| `stages[].counts`, `areaM2` | Zellen und Fläche je Zone |
| `stages[].checks` | die Prüfergebnisse (siehe unten) |

Zelle `(i, j)` liegt im Bild bei
`x = originPx.x + 4 · (i − j)`, `y = originPx.y − 2 · (i + j) − 2`.
`i` läuft nach rechts oben, `j` nach links oben, beide in 0,5-m-Schritten.
Gezeichnet wird nach `i + j`: je größer, desto weiter vorne.

### Regeln für die Platzierung

- Ein Objekt braucht **alle** Zellen seines Footprints in seiner Zone
  (`G` für Pflanzen, Gebäude und die meisten Sonderobjekte, `B` für Strandobjekte,
  `S`/`D` für Wasserobjekte).
- `R` ist immer blockiert.
- **Küstenzelle** = eine `G`- oder `B`-Zelle mit einem `S`- oder `D`-Nachbarn.
  Bootshaus, Leuchtturm und Steg brauchen so eine Zelle.
- Grasflecken mit weniger als vier Zellen sind einzelne Halme zwischen Steinen
  und werden beim Platzieren übersprungen.

### Stand der Prüfungen

| Stufe | Zellen | Wiese | Strand | Fels | Flachwasser | Geometrie | Streugras | Strand ohne Wasseranschluss | Küstenzellen |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 989 | 396 | 37 | 41 | 139 | 98,3 % | 2 | 0 | 40 |
| 2 | 1748 | 728 | 55 | 66 | 217 | 99,0 % | 5 | 2 | 54 |
| 3 | 2510 | 1049 | 90 | 81 | 297 | 99,3 % | 5 | 2 | 67 |
| 4 | 3935 | 1667 | 131 | 104 | 446 | 99,4 % | 8 | 0 | 81 |
| 5 | 6935 | 2995 | 253 | 122 | 785 | 99,4 % | 15 | 3 | 118 |

Kein Landstück liegt außerhalb der Inselkontur, und die Wiese ist auf jeder Stufe
eine zusammenhängende Fläche (Stufe 5: 2980 von 2995 Zellen in einem Stück).

### Gegenprobe

`island/pixel/capacity.py` liest **nur noch diese Datei** und platziert damit den
ganzen Katalog. Wäre die Karte falsch, würde das hier scheitern. Ergebnis auf
Stufe 5: 84 von 84 Objekten, danach bleiben 521 m² Wiese frei.

## 8. Wasserobjekte: 75 Bilder

Gezeichnet von `island/pixel/water.py` mit derselben Engine wie die Pflanzen
(`plants.py` liefert Sprite-Klasse, Licht und Kontur; `water.py` ergänzt nur
Palette und Formen). Wasserobjekte schwimmen, sie bekommen deshalb **keinen
Bodenschatten, sondern einen Schaumring** an der Wasserlinie — eine aufgebrochene
Ellipse aus Schaumpixeln.

```bash
python3 island/pixel/water.py island/pixel
```

| Objekt | Stufen | Wie es wächst | Größe klein → groß |
|---|---:|---|---|
| Boot `boat` | 10 | Ruderboot mit Riemen → Jolle → Segelboot mit Fock → Kutter mit Kajüte → Yacht mit Aufbau und Flagge | 14 × 10 → 42 × 38 px |
| Steg `dock` | 10 | wird länger ins Wasser, ab Stufe 6 mit T-Kopf, ab 8 mit Poller | 24 × 15 → 64 × 39 px |
| Bojen `buoys` | 10 | 1 bis 10 Bojen, orange mit weißem Band und Stab | 10 × 7 → 46 × 27 px |
| Kajaks `kayaks` | 8 | 1 bis 8 Kajaks, abwechselnd orange, rot und weiß, mit Paddel | 19 × 7 → 50 × 25 px |
| Felsen `rocks` | 9 | 1 bis 9 Brocken in drei Größen, nasser Fuß | 12 × 8 → 46 × 30 px |
| Delfine `dolphins` | 10 | Schule von 1 bis 10, Rücken aus dem Wasser, Finne und Fluke | 16 × 10 → 66 × 36 px |
| Möwen `gulls` | 12 | Schwarm von 1 bis 12, fliegen 16–40 px über dem Wasser | 16 × 21 → 58 × 42 px |

Die Gruppenobjekte (Bojen, Kajaks, Felsen, Delfine, Möwen) liegen **als ganze
Gruppe in einem Bild pro Stufe**: Stufe 7 zeigt sieben Bojen. Die Streuung ist
deterministisch (goldener Winkel), also bleibt eine Gruppe beim Wachsen an
derselben Stelle und bekommt nur ein Stück dazu.

Neue Farben gegenüber den Pflanzen: `ink` `#33485C`, `hull_white` `#F2F6F8`,
`hull_grey` `#B9C6CF`, `hull_red` `#D8503F`, `sea_grey` `#6B8AA3`,
`sea_grey_light` `#94B0C4`, `buoy_orange` `#E8632F`, `stone_light` `#C3CFD6`,
`stone_mid` `#94A3AD`, `stone_dark` `#5F6E79`, `foam` `#E2FCFF`. Zusammen mit den
zwölf Pflanzenfarben sind das 23 — das 24er-Budget hält also noch, die Gebäude
müssen sich aber an vorhandenen Tönen bedienen.

Vorschau: `island/pixel/previews/water-sheet.png`.

## 9. Feste Plätze im Wasser `island/pixel/water/slots.json`

Bojen, Felsen, Möwen, Kajaks und Delfine stehen nicht mehr als Klumpen an einer
Stelle, sondern jedes Stück hat seinen eigenen Platz rund um die Insel — **für
alle Nutzer denselben**. Wer sieben Bojen hat, belegt die ersten sieben Plätze.

### Ein Platz ist ein Winkel, kein Pixel

```text
Radius   = Inselradius(Winkel) + Kantenhöhe(Winkel) + Flachwasserbreite · Band
x        = Mitte.x + cos(Winkel) · Radius
y        = Mitte.y + sin(Winkel) · Radius / 2
```

`Band` sagt, wie weit draußen der Platz liegt: 0 ist die Wasserlinie, 1 der
äußere Rand des Flachwassers, ab etwa 2 offenes Meer. Negativ heißt an Land — so
steht der Steg mit dem Landende am Ufer.

Der Vorteil: Wächst die Insel eine Stufe weiter, bleiben alle Plätze an derselben
Stelle der Küste. Es sind Winkel, keine Bildpunkte.

### Wo welche Plätze liegen

| Objekt | Plätze | Regel |
|---|---:|---|
| Steg | 1 | Das Sprite läuft nach rechts oben, gespiegelt nach links oben. Gesucht wird nur in diesen zwei Fenstern (315° bzw. 225°, ±12°) der breiteste, am wenigsten felsige Abschnitt — sonst steht der Steg schräg zur Küste. |
| Boote | 5 | Flotte: das größte am Steg, die anderen **weiter draußen** (Band 2,6 bis 6,5), auch hinter der Insel, jedes mit eigener Größe |
| Bojen | 10 | rundum, aber in **wechselnder Entfernung** (Band 1,0 bis 3,6), damit kein Ring entsteht |
| Kajaks | 8 | an den Sandabschnitten, nah am Ufer |
| Felsen | 3 Gruppen à 3 | an den Felsabschnitten; eine Gruppe wächst auf drei Brocken, dann beginnt die nächste |
| Delfine | 3 Schulen | eine Schule vorn, zwei im Wasser **hinter** der Insel; eine Schule wächst 3 → 5 → 7 → 9, dann beginnt die nächste |
| Möwen | 12 | zehn über dem Wasser rundum, **zwei über der Insel selbst** (negatives Band heißt landeinwärts), Höhe 16–44 px |

Felsen liegen also dort, wo die Küste ohnehin Geröll hat, Kajaks dort, wo Strand
ist. Gruppen (Felsen, Delfine) haben einen Ankerplatz und darin feste Abstände
der einzelnen Stücke — eine Schule bleibt also eine Schule und franst nicht aus.

**Nicht um die Insel zentriert:** Die Bänder sind je Platz verschieden und werden
zusätzlich nach Richtung begrenzt. Nach links und rechts endet das Bild kurz nach
dem Flachwasser, nach vorne und hinten ist viel Platz — dort liegen die Schulen
und die weiter entfernten Boote. Weil Insel, Leinwand und Flachwasser zusammen
skalieren, gilt eine einmal geprüfte Grenze auf allen Inselstufen.

### Zwei Arten von Bildern

- **Gruppenbild pro Stufe** (`buoys_7.png` zeigt sieben Bojen): für Reveal-Screen
  und Timer, damit man sieht, was man bekommt.
- **Einzelteil am Platz**: für die Insel selbst. Dieselben Zeichenfunktionen
  (`item_buoy`, `item_rock`, `item_gull`, `item_kayak`, `item_dolphin` in
  `water.py`), nur einzeln und an den Platz gesetzt.

### Nichts überlappt

Nach dem Aufstellen läuft ein Abstandsdurchgang. Jedes Stück ist dabei ein Kreis
(Boot 20 px, Kajak 9, Felsen und Delfin 8, Boje 5, der Steg vier Kreise entlang
seiner Länge); gemessen wird im ungestauchten Kreis, damit die Abstände in der
2:1-Ansicht stimmen. Wer zu nah an einem schon gesetzten Stück oder am Land steht,
wird verschoben: erst ein Stück weiter raus oder rein, dann ein paar Grad die Küste
entlang, bis er frei steht. Der Steg bleibt, wo er ist.

**Boote und Delfinschulen halten 30 px extra Abstand** — eine Schule direkt am Boot
sah aus, als würden die Tiere daran kleben.

### Prüfung

`island/pixel/layout.py` schreibt die Plätze und prüft jeden gegen die Zonenkarte:
Steg an Land, Boot und Bojen im Wasser, Felsen im Wasser, Möwen egal. Eine volle
Insel hat **72 Stücke** (Steg, 5 Boote, 10 Bojen, 8 Kajaks, 9 Felsen, 27 Delfine,
12 Möwen), und alle liegen in ihrer Zone. Das Beispielbild mit allen
Wasserobjekten auf der größten Insel: `island/pixel/previews/water-layout-5.png`.

## 10. Vom Platz in die App

`island/pixel/export_layout.py` übersetzt die Plätze in das, was die App lesen
kann. Die App hat keine Inselgeometrie, kann also aus Winkel und Band keine
Position rechnen — das Skript löst sie einmal pro Inselstufe in Pixel auf und
zeichnet dabei jedes Einzelteil, das dafür gebraucht wird.

```bash
python3 island/pixel/export_layout.py --preview
```

| Datei | Inhalt |
|---|---|
| `src/lib/islandSlots.ts` | Für jede der 5 Stufen alle 72 Plätze als Bildpixel |
| `src/components/grow/waterPieceSprites.ts` | Die 44 Einzelteile als Pixelzeilen mit Ankerpixel |
| `src/lib/islandScene.ts` | Reine Logik: Inselgröße und welche Stücke stehen (im Domain-Test) |
| `src/components/island/IslandObjectsLayer.tsx` | Zeichnet sie als SVG-Pfade über den Hintergrund |

### Was eine Stufe bedeutet

Eine Gruppe füllt ihre Plätze der Reihe nach auf: **n Stück heißt die ersten n
Plätze**. Die Reihenfolge der Listen ist deshalb Teil der Daten — Felsen laufen
Cluster für Cluster, Delfine Schule für Schule.

| Objekt | Stufen | Was wächst |
|---|---:|---|
| Boot | 14 | 1–10 der Rumpf des Flaggschiffs, 11–14 kommt je ein Boot dazu |
| Steg | 10 | ein Platz, das Bild wächst |
| Bojen | 10 | 1 bis 10 Plätze |
| Kajaks | 8 | 1 bis 8 Plätze |
| Felsen | 9 | 3 Cluster zu 3 |
| Delfine | 12 | Schulen zu 3, 5, 7, 9 — bis zu 3 Schulen, am Ende 27 Tiere |
| Möwen | 12 | 1 bis 12, eigene Luftebene, 2 davon über der Insel |

Die Stufenzahl jedes Objekts ist die Zahl seiner Bilder. Deshalb haben jetzt auch
alle Pflanzen 10 Stufen: so viele hat ihre Art.

### Die Insel wächst mit

Welche der fünf Inselgrößen der Homescreen zeigt, hängt nicht mehr an einer
Konstante, sondern an allem, was auf der Insel steht: 0, 25, 70, 145 und 240
gesammelte Stufen (`ISLAND_STAGE_LEVELS`). Der ganze Katalog hat 333 Stufen.

### Warum die Teile auf kleinen Inseln knapper sitzen (2026-09-16 neu gefasst)

Die Plätze wurden auf der größten Insel gemessen, und die Bilder sind auf jeder
Stufe gleich groß in Bildpixeln — die Kamera steht auf Stufe 1 nur näher dran.
Insel, Flachwasser und Leinwand skalieren zusammen, die Bilder nicht: auf Stufe 5
ist die Leinwand 440 px breit, auf Stufe 1 nur 165 px, und davon nimmt die Insel
selbst 138. **Links und rechts bleiben also gut zwölf Pixel Wasser** — weniger als
ein Boot breit ist. Alles, was auf die Flanken gehört, ragte dort aus dem Bild.

Bis 2026-09-16 durfte eine Gruppe dagegen höchstens 16 px zurückgeschoben werden;
was danach noch überstand, lief über den Rand und wurde nur gemeldet. Auf Insel 1
waren das Steg, Flaggschiff, eine Boje, eine Felsgruppe und eine Delfinschule, auf
Insel 2 noch drei Stücke, auf Insel 3 eines. **Ein halb abgeschnittenes Boot ist
kein Boot.** Jetzt gilt:

1. Die Gruppe wird so weit ins Bild geschoben, wie es nötig ist — nicht bis zu
   einer festen Grenze —, und hält dabei 3 px Wasser zum Rand. Ein Stück, das
   genau auf der letzten Spalte endet, liest sich sonst wie eines, das weitergeht.
2. Läge sie danach am Strand oder unter einem schon gesetzten Stück, wandert sie
   die Küste entlang und ein Stück rein oder raus, bis sie freies Wasser findet.
   Genommen wird der nächstgelegene Platz, der passt.
3. Findet sich gar nichts, bleibt der Wunschplatz, so weit ins Bild geschoben wie
   möglich. Ein fehlender Platz kostet einen schlechteren Platz, nie ein Objekt.

Der Steg ist der Sonderfall: er steht auf dem Sand, also darf er den Strand
wechseln, aber nicht von ihm heruntergeschoben werden. Damit er auf jeder Stufe
am selben Fleck liegt — er ist die erste Landmarke, die man freischaltet, und ein
Steg, der bei jedem Inselwachstum um die Küste wandert, liest sich als ein anderer
Steg — sucht `dock_choice` seinen Winkel direkt auf der **kleinsten** Insel. Dort
reicht ein 58 px langer Steg an den Flanken über den Rand; er liegt deshalb jetzt
bei 291° statt 229°, näher am Rücken der Insel, wo die Leinwand hoch genug ist.
Damit ist er auch nicht mehr gespiegelt.

### Wie groß die Flotte auf einer Insel ist (2026-09-16)

Dieselbe Ursache hat eine zweite Folge. Die volle Besatzung sind 72 Stücke — Steg,
5 Boote, 10 Bojen, 8 Kajaks, 9 Felsen, 27 Delfine, 12 Möwen. Auf der größten Insel
verteilt sich das ruhig; um eine Zwölf-Meter-Insel gelegt liest sich derselbe
Bestand als Stau, nicht als Meer. Die Stücke sind ja real bemessen und auf jeder
Stufe gleich groß — die See um sie herum ist es nicht.

Der Export **misst** deshalb pro Stufe, wie viel Wasser da ist. Beim Aufstellen
merkt er sich für jedes Stück, ob es in seinem eigenen Platz mit Luft ringsum
landete (5 px Abstand, derselbe, mit dem die Plätze auf der größten Insel gebaut
wurden) oder anderswo untergebracht werden musste. Danach sortiert er jede Gruppe
so, dass die guten Plätze vorn liegen — wer drei Bojen hat, bekommt die drei
besten, nicht die ersten drei —, und schreibt die Zahl der guten Plätze als
`limits` in `islandSlots.ts`. Gemessen:

| Insel | Boote | Bojen | Kajaks | Felsen | Delfine |
|---|---:|---:|---:|---:|---:|
| 1 (12 m) | 4 | 3 | 2 | 6 | 9 |
| 2 (16 m) | 4 | 7 | 4 | 6 | 18 |
| 3 (20 m) | 5 | 10 | 7 | 6 | 27 |
| 4 (24 m) | 5 | 10 | 8 | 9 | 27 |
| 5 (33 m) | 5 | 10 | 8 | 9 | 27 |

`waterPieces` zeichnet nie mehr als das. **Nichts davon ist verloren** — was über
dem Limit liegt, kommt heraus, sobald die Insel wächst, und jede Gruppe zeigt
mindestens ein Stück: was man besitzt, muss irgendwo sein. Die Vorschaubilder
zeichnen ebenfalls nur bis zum Limit, damit sie keinen Zustand zeigen, den das
Spiel gar nicht erreichen kann.

Was tatsächlich gezeichnet wird, prüft der Export gegen die Zonenkarte
(`zone_report` in `export_layout.py`) — vorher wurde der Wunschplatz geprüft, den
auf den kleinen Stufen niemand zu sehen bekommt. Alle fünf Stufen sind sauber:
nichts ragt heraus, alles liegt in seiner Zone.

## 10b. Die Meilenstein-Landmarken

`island/pixel/special.py` zeichnet die Objekte der Stunden-Roadmap
(`src/lib/rewards.ts`) — nicht Session-Belohnungen, sondern Marken für 5 bis 1000
Stunden. Sechs Objekte in zehn Bildern:

| Objekt | Stufe 1 | Stufe 2 | Grund |
|---|---:|---:|---|
| Fahnenmast | 5 h | — | Wiese |
| Truhe | 10 h | 750 h | Strand |
| Brunnen | 25 h | 200 h | Wiese |
| Uhrturm | 50 h | 300 h | Wiese |
| Leuchtturm | 100 h | 500 h | Wiese (siehe unten) |
| Monument | 1000 h | — | Wiese |

Zwei Regeln halten sie als Landmarken zusammen: Jede Silhouette ist auf
Daumennagelgröße unverwechselbar — dünne Stange, flache Truhe, breites rundes
Becken, quadratisches Zifferblatt, sich verjüngender gestreifter Turm, spitzer
Obelisk. Und **Gold kommt nur hier vor**, fast nur auf der zweiten Stufe.

Der Leuchtturm stand zuerst am Strand. Bei voller Größe braucht er 5 × 5 Zellen,
der Strandring ist dafür zu schmal, und auf einer fertigen Insel fand er nie einen
Platz — er wäre bei 100 Stunden stumm ausgefallen. Er steht jetzt auf der Wiese,
wo ein Leuchtturm ohnehin hingehört, und ein Test in der Domain-Suite sichert, dass
alle sechs auf einer fertigen Insel Platz finden.

```bash
python3 island/pixel/special.py island/pixel
python3 island/pixel/export_sprites.py island/pixel/special src/components/grow/specialSprites.ts SPECIAL
python3 island/pixel/export_layout.py     # nimmt sie in islandLand.ts auf
```

## 11. Wo ein neues Objekt hinkommt

Wasserobjekte haben feste Plätze, Landobjekte nicht: Wiese und Strand sollen bei
jedem anders aussehen. Die Regel ist **da, wo am meisten Platz ist, aber leicht
zufällig** (`src/lib/islandPlacement.ts`).

### Zwei Karten, zwei Fragen

Jedes Objekt belegt ein Quadrat aus Halbmeterzellen, so breit wie sein größtes
Bild (`cells` in `islandLand.ts`; ein 40 px breites Haus bekommt 5 Zellen, weil
ein Block aus n Zellen auf dem Bildschirm 8·n px breit ist). Daraus entstehen
zwei Abstandskarten:

- **frei** — wie weit das nächste andere Objekt weg ist. Das entscheidet, ob
  etwas überhaupt passt. Eine breite Strandliege darf dabei mit ihrer Kante über
  die Wasserlinie ragen.
- **offen** — zählt zusätzlich den falschen Untergrund als belegt. Das macht
  einen Platz attraktiv: mitten auf der Wiese hoch, in einer Ecke niedrig.

Gezogen wird gewichtet mit `offen³`: freie Fläche ist deutlich wahrscheinlicher,
aber nicht zwingend. Ohne Gewicht stünde alles exakt in der Mitte, mit Gleichverteilung
würde es sich in jede Ecke verteilen. Der Zufall hängt am Account, also sieht die
Insel für einen Spieler immer gleich aus und für zwei Spieler verschieden.

Ist die Insel voll, wird der Reihe nach gelockert: erst der Abstandsring weg, dann
der Block Stück für Stück kleiner. Lieber eng als gar nicht.

### Was bleibt und was umzieht

Der Platz wird einmal vergeben und im Speicher festgehalten
(`islandSpotsByUser`), damit nichts umspringt, wenn daneben etwas Neues wächst.
Nur wenn die Insel eine Stufe wächst und der Strand unter einem Strandobjekt
weggewandert ist, bekommt dieses eine neue Stelle.

### Wie viel auf eine Insel passt

Nicht alles passt auf jede Inselgröße — auf der kleinsten Insel sind 8
Strandobjekte schlicht mehr Strand, als es gibt. Jede Kategorie hat deshalb pro
Inselgröße ein Limit (`ISLAND_CATEGORY_LIMITS`):

| Insel | Pflanzen | Gebäude | Strand | Wasser |
|---|---:|---:|---:|---:|
| 1 | 4 von 8 | 3 von 10 | 5 von 8 | alle |
| 2 | 6 | 6 | 5 | alle |
| 3 | 8 | 9 | 8 | alle |
| 4 | 8 | 10 | 8 | alle |
| 5 | 8 | 10 | 8 | alle |

Die Zahlen sind **gemessen, nicht geschätzt**: Die echte Platzierung stellt die
größten Objekte einer Kategorie auf, jedes mit vollem Block und Abstandsring, in
acht gemischten Reihenfolgen — Spieler sammeln in keiner bestimmten Ordnung, und
das packt schlechter, als die großen zuerst zu setzen. Passt eine Reihenfolge
nicht, sinkt das Limit um eins.

```bash
python3 island/pixel/preview_islands.py limits   # neu messen
```

Ist eine Kategorie voll, kann die Session nur noch wachsen lassen, was schon
dasteht; die neuen Objekte stehen als „Island too small" daneben. Wasser hat kein
Limit, seine Plätze sind fest und immer da.

### Vorschau

```bash
python3 island/pixel/preview_islands.py        # 5 Inseln von fast leer bis fertig
python3 island/pixel/preview_islands.py vary 0.6 7 23 91   # dieselbe Insel, andere Spieler
```

Das Skript kompiliert die TypeScript-Logik der App und lässt sie die Szene bauen —
was hier steht, steht auch im Telefon.

### Gegenprobe

Beide Seiten müssen dasselbe Bild ergeben. Geprüft wurde, indem die Pfaddaten der
App rastert und Pixel für Pixel mit der Python-Vorschau verglichen wurden: auf
allen fünf Stufen **0 Abweichungen**. Dabei fiel ein echter Fehler auf — Pythons
`round()` rundet die Hälfte zur geraden Zahl, `Math.round` immer auf. Plätze auf
genau x,5 lagen dadurch ein Pixel daneben; der Export rundet jetzt selbst auf
ganze Bildpixel.

## 5d. Flaggen für den Flaggenmast (2026-09-15)

`island/pixel/flags.py` hält 30 Flaggen zu je **16 × 10 px**. Diese Größe
entscheidet den ganzen Ansatz: So klein wird eine Flagge über **Aufteilung und
Farbe** gelesen, nie über Details. Ein Wappen wird zu drei Pixeln, ein Halbmond
zu einer Kurve aus fünf. Was überleben muss, ist das, was man quer durch den Raum
erkennt — Streifenrichtung, Kreuz, Scheibe, Gösch.

Streifen, Kreuze und Scheiben sind Hilfsfunktionen statt Handarbeit: weniger
Fehlerquellen, und jede Trikolore ist dadurch exakt gleich aufgeteilt. Nur was
wirklich ein Bild ist, steht Zeile für Zeile da.

### Welche 30 (2026-09-15)

Nicht die „bekanntesten" Flaggen der Welt, sondern die **Nationalitäten, die in
Deutschland im Alter 15–30 tatsächlich vorkommen** — das ist die Zielgruppe der
App. Grundlage ist das Ausländerzentralregister zum 31.12.2025 (Destatis).

Wichtige Einschränkung: Destatis veröffentlicht die Altersgliederung nur als
„unter 20" und „20 bis 45". Eine exakte 15-bis-30-Rangfolge gibt es öffentlich
also nicht. Die Reihenfolge unten ist die Gesamtrangfolge, verschoben nach dem
Altersprofil der Gruppen — Flucht- und Studienkohorten (Syrien, Afghanistan,
Irak, Indien, Eritrea, Pakistan) sind deutlich jünger als die Arbeitsmigration
der Sechziger und Siebziger (Italien, Kroatien, Griechenland).

Deutschland steht an erster Stelle: Die meisten Menschen dieses Alters hier haben
diese Staatsangehörigkeit.

Rausgeflogen sind dadurch UK, USA, Kanada, Japan, Korea, Brasilien, Argentinien,
Mexiko, Australien, Irland, Schweiz, Frankreich, Belgien, Niederlande und
Skandinavien. Wer eine davon zurück will, ergänzt sie in `FLAGS`.

### Was nachgebessert werden musste

Jede Flagge wurde angesehen, bevor sie blieb. Korrigiert wurden:

- **Union Jack** — die Diagonalen waren einzelne Pixel und lasen sich als
  Rauschen. Jetzt läuft jeder Schrägbalken als durchgehendes Zweipixel-Band ins
  Kreuz, mit dem roten Gegenwechsel daneben.
- **Griechenland** — die Streifen liefen nicht unter der Gösch durch.
- **Brasilien** — die Raute war ein Oval mit einem Streupixel darin.
- **China** — alle fünf Sterne gleich groß; die Flagge las sich als Rot mit
  Krümeln.
- **Spanien** — Streifen falsch proportioniert.
- **Portugal** — das Wappen war ein Klumpen; jetzt ein echter Ring auf der Naht.
- **Vietnam** — der Stern war oben und unten symmetrisch und las sich als
  Pfeilspitze.
- **Marokko** — das Pentagramm muss als Linie gezeichnet sein, sonst ist es ein
  Klecks wie jeder andere Stern auf rotem Grund.
- **Afghanistan** — das Emblem als Block ergab ein weißes Kreuz und las sich als
  Schweiz. Jetzt eine Moschee: Kuppel, Körper, zwei Pfeiler.
- **Albanien** — zwei Fehlversuche: nach unten spitz zulaufend wurde es eine
  Fledermaus, mit geradem Flügelbalken über gespaltenem Schwanz eine Spinne. Ein
  Doppeladler braucht auf 16 × 10 drei Dinge in der Silhouette — zwei Köpfe mit
  nach außen gedrehten Schnäbeln, Flügel die aufspreizen und dann nach unten
  auslaufen, und einen einzelnen Schwanz, der breiter ist als der Körper darüber.

**Eine Quelle für beides.** `flags.py` erzeugt die Sprites *und* schreibt
`src/lib/islandFlags.ts` mit denselben Pixelzeilen. Die Auswahlkachel in der App
und das Tuch auf der Insel können deshalb nicht auseinanderlaufen.

### Varianten statt eigener Objekte

Der Mast bekommt pro Flagge ein eigenes Bild: `flagpole_1`, `flagpole_1_de`,
`flagpole_1_tr` … Es bleibt **ein** Objekt mit einem Platz und einem Fußabdruck;
nur das Tuch unterscheidet sich. Dafür wurden zwei Generatoren umgestellt:

- `export_sprites.py` benennt Sprites nach dem Dateinamen statt nach
  `key_level` — für alles andere derselbe Name, für Varianten ein eigener.
- `export_layout.py` schlüsselt die Anker ebenso und überspringt Varianten beim
  Bilden von `LAND_OBJECTS`, damit 30 Flaggen nicht 30 Objekte werden.

In der App hängt die Wahl als `variant` am Insel-Objekt, `spriteNameFor()` baut
daraus den Bildnamen — und verwirft eine Variante, die es nicht mehr gibt, statt
ihr zu vertrauen: Sonst ließe eine gelöschte Flagge den Mast von der Insel
verschwinden. Rein kosmetisch: nie Level, Fußabdruck oder Standort.

Gewählt wird im Rewards-Screen, auf der Karte, die den Flaggenmast freischaltet —
nicht in den Einstellungen, wo es niemand suchen würde.

Flagge ändern oder ergänzen: Eintrag in `FLAGS`, dann

```bash
python3 island/pixel/special.py island/pixel
python3 island/pixel/export_sprites.py island/pixel/special src/components/grow/specialSprites.ts SPECIAL
python3 island/pixel/export_layout.py
```
