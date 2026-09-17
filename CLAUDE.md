# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Expo React Native goal-tracking app with focus sessions, geofencing, and a garden gamification system. Uses Supabase for auth and data, Zustand for local state, and TanStack React Query for server state.

## Commands

- `npx expo start` — start dev server
- `npx expo run:ios` — run on iOS simulator
- `npx expo run:android` — run on Android emulator
- `npx expo start --web` — run web version
- `npx eas build --profile development` — create dev build
- `npx eas build --profile preview` — create preview build
- `npm run typecheck` — strict TypeScript compile check
- `npm run test:domain` — deterministic domain smoke suite
- `npm run check` — typecheck + domain suite + Expo Doctor

No separate linter is configured. Do not describe `npm run check` as a full
device/E2E suite; OAuth, background geofencing and provider configuration still
need their documented physical-device tests.

## Architecture

### Tech Stack
- **React Native 0.83 + Expo 55** with TypeScript (strict mode)
- **React Native StyleSheet/inline styles** with canonical semantic tokens
- **Zustand 5** for local/persisted state (AsyncStorage, key: `"goals-app-state-v3"`)
- **TanStack React Query** for Supabase data fetching
- **Supabase** for auth (email/password) and PostgreSQL with RLS
- **React Navigation** (native stack + unsichtbarer Home/Grove-Tabcontainer)
- **Reanimated 4** for animations
- **expo-location + expo-task-manager** for background geofencing

### Path Alias
`@/*` maps to `src/*` (configured in tsconfig.json)

### State Management
Zustand store in `src/store/index.ts` combines 5 slices:
- **configSlice** — auth state, user config, permission warnings, onboarding status
- **goalsSlice** — goal CRUD, weekly progress
- **sessionSlice** — active focus session, pomodoro state, ambient sound prefs
- **walletSlice** — time budget (fixed commitments → disposable hours)

### Data Flow
- **Auth**: genau ein `useAuthBootstrap` am App-Root → Supabase Auth → Zustand;
  `useAuth` in Screens stellt nur Aktionen bereit
- **Goals**: `useGoals` hook → Supabase query → React Query cache → Zustand goals slice sync
- **Sessions**: Focus-Timer oder Geofencing-Background-Task → Supabase sessions →
  lokale Notifications und React-Query-Invalidierung
- **Mutations** use React Query with automatic query invalidation on success

### Navigation
- `RootNavigator`: Auth guard → Onboarding guard → MainTabs (+ modal stack screens)
- `MainTabs`: hidden Home/Grove route container; it must render **no visible tab bar**
- `Analytics`: Root-stack screen opened only from the Home header Stats button;
  it must always expose a visible Back action

### Database
Das vollständige Fresh-Project-Schema liegt in `supabase/schema.sql`; Änderungen
für das existierende Projekt liegen zusätzlich in `supabase/migrations/`.
Vier Tabellen: `users`, `goals`, `sessions`, `friend_links`. Alle besitzen RLS;
Session-Policies prüfen zusätzlich die Goal-Zugehörigkeit. SECURITY-DEFINER-RPCs
sind nur für `authenticated` ausführbar.

### Supabase Edge Functions
- `supabase/functions/delete-account/` — JWT-validierte Hard-Delete des eigenen Kontos
- `supabase/functions/analyze-sessions/` — JWT-validierte persönliche Insight-Analyse

### Key Types
All in `src/types/index.ts`. Two goal types: `"physical"` (geofenced) and `"focus"` (manual pomodoro). Sessions have triggers: `"geofence"` or `"manual_pomodoro"`.

## Styling Conventions

The final visual system is defined in the authoritative design section below.
Canonical runtime values live in `src/theme/neumorphism.ts`; do not duplicate hex values
inside screens.

- **Typography:** Outfit. Body `Outfit_500Medium`, labels `Outfit_600SemiBold`,
  headings `Outfit_700Bold`.
- **Colors:** `NEU.bg`, `NEU.card`, `NEU.accent`, `NEU.textPrimary`,
  `NEU.textSecondary`, `NEU.light`, `NEU.dark`.
- **Spacing:** 24pt outer card inset, 16–20pt card padding, 16pt standard card gap.
- **Radii:** 20pt cards, 12–16pt controls, full pills only where explicitly specified.
- **Implementation:** `NeumorphicSurface` nur für nicht-interaktive Inhaltskarten;
  Controls verwenden `PrimaryButton`, `TextAction`, `FlatToggle` oder flache
  Solid-/Outline-Pressables.

## Environment Variables

Required in `.env` (see `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

# VERBINDLICHES DESIGN-SYSTEM — FINALER STAND 2026-07-28

> **Aktueller Home-Override vom 2026-09-10 (Jannis):** Home verwendet exklusiv
> `assets/home/island-ocean-1.png` als vollflächigen `ImageBackground` mit
> `resizeMode="cover"`. Das Asset ist das von Jannis gelieferte Pixel-Ozeanbild
> mit kleiner Insel und viel freier Wasser-/Himmelsfläche. Es darf nicht durch
> einen Verlauf, eine Farbfläche oder ein anderes Inselbild ersetzt werden.
> Formulare, Onboarding, Focus, Stats, Friends, Settings und weitere sekundäre
> Screens bleiben auf ihrer opaken Paper-Fläche. Dieser Absatz überschreibt für
> Home die älteren Verbote von Hintergrundbildern in diesem Dokument.

Diese Spezifikation ist für jede weitere visuelle Arbeit verbindlich. Sie fasst die
Recherche, alle Nutzerkorrekturen und die im iPhone-Simulator visuell abgestimmten
Werte zusammen.

**Priorität:** Dieser Abschnitt überschreibt ältere Prompts, Screenshots,
`Information/initial-prompt.md`, frühere Glassmorphism-Regeln und widersprechende
Stellen in `NEUMORPHISM.md`. Die aktuelle Implementierung auf dem Homescreen ist die
visuelle Referenz. Wenn Dokumentation und Code voneinander abweichen, zuerst
`src/theme/neumorphism.ts`, `src/components/NeumorphicSurface.tsx`,
`src/screens/HomeScreen.tsx`, `src/components/BalanceCard.tsx`,
`src/components/GoalCard.tsx` und `src/components/GardenPreview.tsx` prüfen.

## 1. Visuelle Identität

Die App ist eine ruhige, monochrome, helle Neumorphismus-Oberfläche. Sie soll wie
weich geformtes Material wirken, nicht wie Glas, Acryl oder schwebende transparente
Panels.

Die wiedererkennbare Signatur besteht aus:

1. einem kühlen graublauen Seitenhintergrund;
2. leicht helleren, weich extrudierten Karten;
3. einer einzigen violetten Akzentfarbe;
4. konsequentem Licht von oben links;
5. klarer, dunkler Outfit-Typografie;
6. sehr wenigen, bewusst hervorgehobenen Interaktionen.

Das Design bleibt ruhig. Keine dekorativen Farbflächen, keine Hintergrundbilder,
keine Blobs, keine Verläufe und keine zufälligen Effekte ergänzen.

## 2. Verbotene bzw. endgültig verworfene Richtungen

Diese Regeln sind absolut. Nicht erneut ausprobieren:

- **Kein Glassmorphism und kein Liquid Glass.**
- Keine `BlurView`, `GlassView`, `backdrop-filter`, transparenten Karten oder
  halbtransparenten weißen Tints.
- Keine Glass-Borders, Lichtbrechungsränder, Noise-Texturen oder Eck-Glows.
- Keine bunten Blobs, Aurora-Verläufe, Stockbilder oder Fotos im Hintergrund.
- Kein reines Weiß als Seitenhintergrund.
- Keine Karten mit dunkler Outline oder sichtbarer 1px-Standardborder.
- Kein einzelner schwarzer Drop-Shadow. Neumorphismus braucht immer das gerichtete
  helle und dunkle Schattenpaar.
- Keine Farbverläufe auf Buttons oder Progress-Bars.
- Keine Glow-Shadows auf primären Buttons.
- Keine Emojis als UI-Icons. Ausschließlich SVG-Komponenten aus
  `src/components/TabIcons.tsx` oder neue Icons im exakt selben Stil.
- Keine zusätzlichen gesättigten Farben. `#415DCB` ist die einzige
  Interface-Akzentfarbe.
- Keine ad-hoc Hex-Werte pro Screen. Neue Farben zuerst als semantisches Token
  definieren.
- Keine riesigen Standardradien auf normalen Karten. Karten verwenden 20pt; nur
  eine gerätenahe untere Ecke darf nach der konzentrischen Radiusregel abweichen.
- **Kein Neumorphismus auf irgendeinem interaktiven Control.** Das gilt ohne
  Ausnahme für Header-Icons, Buttons, Toggles, Segmente, Stepper, Auswahlkarten,
  Slider, Rating-Kreise und Pills. Neumorphismus gehört ausschließlich auf
  nicht-interaktive Inhaltskarten und den ausdrücklich als Anzeige bestätigten
  Pomodoro-Dial.

Die Pakete `expo-blur` und `expo-glass-effect` wurden entfernt und dürfen für diese
Designrichtung nicht wieder installiert werden.

## 3. Kanonische Tokens

Alle Werte kommen aus `src/theme/neumorphism.ts`. Screens importieren `NEU` und
`NEU_FONTS`; sie definieren keine Parallelpalette.

| Bedeutung | Token | Wert | Verwendung |
|---|---|---:|---|
| Seitenhintergrund | `NEU.bg` | `#E0E5EC` | App-Root, SafeArea, Navigator, Screen |
| Kartenfläche | `NEU.card` | `#E9EDF2` | alle erhabenen Karten und Panels |
| Akzent | `NEU.accent` | `#415DCB` | Progress-Fill, aktive Labels, Icons, primäre CTAs |
| Primärtext | `NEU.textPrimary` | `#171A1F` | Überschriften, Werte, wichtige Labels |
| Sekundärtext | `NEU.textSecondary` | `#3B4351` | Body, Metadaten, Captions |
| Lichtschatten | `NEU.light` | `#FFFFFF` | ausschließlich Schatten oben links |
| Dunkelschatten | `NEU.dark` | `#A3B1C6` | Schatten unten rechts, neutrale Tracks |
| Kleiner Radius | `NEU.radiusSmall` | `12` | Inputs und kompakte Controls |
| Normaler Radius | `NEU.radius` | `16` | Controls, keine Standardkarte |
| Kartenradius | `NEU.radiusLarge` | `20` | jede normale Karte |
| Mindest-Touchziel | `NEU.hitTarget` | `44` | jede Interaktion |
| Schattenabstand | `NEU.raisedDistance` | `8` | beide Richtungen |
| Schattenstreuung | `NEU.raisedBlur` | `12` | bewusst reduziert; nicht wieder auf 16 erhöhen |
| Inset-Abstand | `NEU.insetDistance` | `6` | Inputs/Vertiefungen |
| Inset-Streuung | `NEU.insetBlur` | `12` | Inputs/Vertiefungen |

`#415DCB` ist die verbindliche, barrierearme Abdunklung des früheren
`#5B7CFA`: 4,54:1 auf `NEU.bg` und 5,75:1 zu weißem Buttontext. Den alten Wert
nicht wieder einsetzen; er lag auf der Seite nur bei 2,91:1.

### Warum `NEU.card` heller als `NEU.bg` ist

Klassischer Neumorphismus verwendet exakt dieselbe Farbe für Seite und Oberfläche.
Das wurde getestet, wirkte hier aber zu flach. Der bestätigte App-Stil hellt Karten
um ungefähr 30 % in Richtung Weiß auf:

```text
background #E0E5EC → card #E9EDF2
```

Das ist eine bewusste produktspezifische Abweichung. Nicht wieder beide Farben
gleichsetzen. Tiefe entsteht weiterhin primär durch Schatten; der Helligkeitsversatz
unterstützt nur die Lesbarkeit.

### Dark Mode

Die reservierten Werte sind `NEU.bgDark = #2A2D32`,
`NEU.lightDarkMode = #34383E` und `NEU.darkDarkMode = #1C1E21`.
Dark Mode ist visuell noch nicht final abgenommen. Keine automatische Invertierung
erfinden. Wenn Dark Mode umgesetzt wird, dieselben Komponentenrezepte verwenden und
separat visuell prüfen. Niemals reines Weiß oder Schwarz als Dark-Mode-Schatten.

## 4. Hintergrund und Screen-Roots

Jede Ebene hinter Inhalt muss explizit `NEU.bg` verwenden:

- `GestureHandlerRootView`
- `NavigationContainer`-Theme
- Stack `contentStyle`
- Tab `sceneStyle`
- Screen-Root
- `SafeAreaView`
- Loading- und Empty-State-Roots

Die Komponente `AtmosphericBackground` ist trotz ihres historischen Namens eine
einfarbige `NEU.bg`-Fläche. Sie darf keine Atmosphäre, Verläufe oder Blobs bekommen.

Wenn an einem Rand kurz Weiß sichtbar wird, nicht die Karte ändern. Zuerst prüfen,
welche Root-, Navigator- oder Safe-Area-Ebene noch keinen `NEU.bg`-Hintergrund hat.

## 5. Neumorphische Karten

### 5.1 Ausschließlich `NeumorphicSurface` verwenden

Neue Karten werden nicht direkt mit `View + shadow*` gebaut:

```tsx
<NeumorphicSurface
  radius={NEU.radiusLarge}
  contentPadding={0}
  style={{
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
  }}
>
  {content}
</NeumorphicSurface>
```

`NeumorphicSurface` kümmert sich um:

- den ungeclippten äußeren Layout-Wrapper;
- zwei getrennte Schattenebenen;
- die hellere Kartenfläche `NEU.card`;
- korrektes Clipping des Inhalts;
- getrennte Top- und Bottom-Radien;
- optional reduzierte dunkle Schattenintensität;
- korrektes Trennen von Außenlayout und Innenstil.

### 5.2 Schattenrezept

Die Lichtquelle liegt auf jedem Screen oben links. Sie darf nie zwischen
Komponenten wechseln.

Aktuelles React-Native-Rezept:

```ts
// dunkel, unten rechts
shadowColor: "#A3B1C6";
shadowOffset: { width: 8, height: 8 };
shadowOpacity: 1;
shadowRadius: 12;

// hell, oben links
shadowColor: "#FFFFFF";
shadowOffset: { width: -8, height: -8 };
shadowOpacity: 1;
shadowRadius: 12;
```

Wichtig: `shadowRadius: 12` ist das Ergebnis visueller Iteration. 16 war zu weit
gestreut. Schatten nicht pro Screen verändern.

Auf Android reicht ein einzelnes `elevation` nicht als Ersatz, weil dadurch der
helle Top-Left-Schatten fehlt. Die zwei Shadow-Layer beibehalten und Android separat
prüfen; `elevation` ist nur eine zusätzliche Fallback-Tiefe.

### 5.3 Kritische Wrapper-Regel

Schatten und `overflow: "hidden"` dürfen nie auf derselben View liegen. Sonst wird
der Schatten abgeschnitten. Immer:

```text
äußerer Wrapper: Layout + Schatten, nicht geclippt
└── innere Kartenfläche: NEU.card + Radius + overflow hidden
    └── Content: Padding
```

`NeumorphicSurface` implementiert das bereits. Nicht vereinfachen.

### 5.4 Margin-/Padding-Regel

- `margin*`, `flex`, `width`, `height`, `position` gehören auf den äußeren Wrapper.
- `padding`, Hintergrund, Border und Inhaltsausrichtung gehören nach innen.
- Niemals Margin auf eine innere, geclippte Surface legen.
- Der `splitStyle`-Mechanismus in `NeumorphicSurface` ist absichtlich vorhanden.
  Nicht entfernen.

### 5.5 Kartenradien

- Jede normale Karte: exakt 20pt an allen vier Ecken.
- Keine 16pt-Karte neben einer 20pt-Karte.
- Keine individuellen Radien nur aus ästhetischem Bauchgefühl.
- Inset-Flächen innerhalb einer Karte: 12–18pt, stets kleiner als der
  Außenradius.

Sonderregel für einen Screen-abschließenden, gerätenahen Bereich:

```text
innerer Radius ≈ iPhone-Screenradius − äußerer Abstand
```

Auf dem aktuellen iPhone-Layout:

```text
ca. 55pt Screenradius − 24pt Außenabstand = 31pt unterer Kartenradius
```

Deshalb hat **nur** die Grove-Karte:

```tsx
radius={20}          // oben wie alle Karten
bottomRadius={31}    // unten konzentrisch zur iPhone-Kante
```

Diese Abweichung nie auf alle Karten übertragen. Für andere Geräte nicht blind 31
kopieren: bei deutlich anderem Displayradius die konzentrische Formel verwenden und
im Simulator prüfen.

### 5.6 Kartenschatten nahe der Displayunterkante

Ein 8pt versetzter Schatten mit 12pt Radius braucht ungefähr 20pt Auslauf. Wird die
Karte nur 20pt vom unteren Rand platziert, kann der dunkle Schatten optisch stauen
oder clippen. Die bestätigte Grove-Lösung ist:

- äußerer Abstand links/rechts/unten: 24pt;
- Top-Radius: 20pt;
- Bottom-Radius: 31pt;
- `darkShadowOpacity={0.45}`;
- heller Top-Left-Schatten bleibt unverändert.

Nur den dunklen Schatten reduzieren, nicht die gesamte Karte transparent machen.

### 5.7 Keine Kartenborder

Normale Karten haben:

- `backgroundColor: NEU.card`;
- duale Schatten;
- **keine** Outline;
- **keine** 1px Border;
- **keine** transparente Border als Layout-Hack.

Eine sichtbare Linie um Karten liest sich wie ein Web-Dashboard und zerstört die
weiche Materialwirkung.

## 6. Layout- und Spacing-System

### 6.1 Standardwerte

| Element | Wert |
|---|---:|
| Horizontaler Kartenabstand | 24pt |
| Kartenabstand vertikal | 16pt |
| Standard-Kartenpadding | 16pt |
| Großes Kartenpadding | 20–24pt |
| Header horizontal | 22pt |
| Header oben | 12pt |
| Header unten | 16pt |
| Iconbutton-Abstand | 12pt |
| Label→Inhalt | 12–16pt |
| Mindest-Touchziel | 44×44pt |

Für visuell zusammengehörige Karten nicht zwischen 20 und 24pt Außenabstand
wechseln. Die Home-Referenz verwendet für alle Hauptkarten 24pt.

### 6.2 Homescreen-Grundriss

Die Reihenfolge ist verbindlich:

1. Header mit Begrüßung, Datum, Friends, Stats und Settings;
2. Balance-Karte;
3. Section-Label `GOALS`;
4. Focus-Goal-Karte;
5. Auto-Check-In-/Location-Goal-Karte;
6. Grove-Vorschau als unterer, flexibel wachsender Abschluss.

Die Location-Karte gehört zwischen Focus und Grove. Sie darf nicht versteckt,
separat oder auf einen anderen Screen ausgelagert werden.

Der Homescreen verwendet nach Möglichkeit keine `ScrollView`. Die Grove-Karte
nimmt den verbleibenden Raum über `flex: 1` ein. Dadurch gibt es keine zufällige
Leerfläche unter kurzen Inhalten und die untere Karte folgt der Displaygeometrie.

Wenn Warning- oder Empty-State-Karten erscheinen, darf Scrollen aus funktionalen
Gründen ergänzt werden; dann Abstände und Kartenreihenfolge beibehalten.

## 7. Typografie

### 7.1 Familie und Gewichte

- Body: `Outfit_500Medium`
- Labels/Buttons: `Outfit_600SemiBold`
- Headings/Werte: `Outfit_700Bold`
- `Outfit_400Regular` nur für sehr untergeordnete dekorative Texte; nicht für
  normale Body-Texte.
- Kein Inter, Roboto, Serif oder Systemfont-Mix.

### 7.2 Größen

| Rolle | Größe | Gewicht |
|---|---:|---:|
| H1 / Screen title | 28–32pt | 700 |
| Balance-Hauptwert | 34pt, 38pt line-height | 700 |
| H2 | 22pt | 700 |
| Kartenüberschrift | 16–18pt | 600 |
| Body | mindestens 16pt | 500 |
| Meta/Progress-Text | 13pt | 500 |
| Caption | 13pt | 500 |
| Start-Pill-Label | 14pt | 600 |

Der Homescreen nutzt beim kompakten Goal-Layout bewusst 13pt für Metadaten. Auf
textlastigen Screens Body-Inhalt nicht auf 13–14pt verkleinern.

### 7.3 Farbe und Kontrast

- Primär: `NEU.textPrimary`
- Sekundär: `NEU.textSecondary`
- Weiß nur für Text auf einer gefüllten Akzentfläche.
- Akzenttext nur für Interaktionen, nie für normalen Inhalt.
- Keine blassen grauen Texte unter WCAG AA.
- Body-Kontrast soll ungefähr 7:1 oder besser sein; 4.5:1 ist die absolute
  Untergrenze.

## 8. Control-System — alle Interaktionen sind flach

Der Nutzer hat Neumorphismus auf **allen** Buttons, Toggles und vergleichbaren
Controls ausdrücklich verworfen. Karten dürfen neumorphisch bleiben; jede
Interaktion ist eine klar gefüllte, umrandete oder reine Textaktion. Kein Control
verwendet duale Schatten, Inset-Shadows oder eine `NeumorphicSurface` als
Buttonkörper.

### 8.1 Primäre Standardaktion

`src/components/ui/PrimaryButton.tsx` ist die Standardimplementierung:

- Solid `NEU.accent`;
- weißes Label;
- kein Verlauf;
- kein Schatten;
- kein Glow;
- Radius 12pt;
- mindestens 50pt hoch;
- Press-Feedback über Scale `0.98`;
- Disabled-Feedback über Opacity `0.45`.

Nicht wieder durch eine neumorphische Pressable-Variante ersetzen.

### 8.2 Textaktion

`TextAction`:

- transparente Fläche;
- Akzentlabel;
- kein Schatten;
- mindestens 44pt Touchhöhe;
- Press-Opacity `0.5`;
- Disabled-Opacity `0.35`.

### 8.3 Kompakte Start-Pill auf einer Goal-Karte

Dies ist eine bewusst fein abgestimmte Komponente, kein allgemeiner großer CTA:

- sichtbare Fläche: 68×34pt;
- Touchfläche: 68×44pt;
- vollständige Pill: `borderRadius: 999`;
- Fill: `NEU.accent`;
- Text: Weiß, 14pt, 600;
- kein Verlauf;
- kein Schatten;
- kein Glow;
- kein Neumorphismus;
- Label immer horizontal und vertikal zentriert;
- sichtbare Pill liegt als eigener innerer `View` in der 44pt-Pressable.

Der getrennte innere View ist wichtig. Bei Tests verschwand die direkt auf einer
verschachtelten `Pressable` gesetzte Hintergrundfarbe, während das weiße Label
sichtbar blieb. Daher:

```tsx
<Pressable style={{ width: 68, height: 44, alignItems: "center", justifyContent: "center" }}>
  <View
    pointerEvents="none"
    style={{
      width: 68,
      height: 34,
      borderRadius: 999,
      backgroundColor: NEU.accent,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text style={{ color: "#FFFFFF", fontSize: 14 }}>Start</Text>
  </View>
</Pressable>
```

Die Home-Goal-Karte wurde auf dem aktuellen Layout zusätzlich feinjustiert:

```ts
marginRight: -6;
transform: [{ translateY: 10 }];
```

Diese beiden Offsets nur übernehmen, wenn exakt dieselbe GoalCard-Geometrie
verwendet wird. Bei anderen Karten stattdessen über reguläres Padding ausrichten,
nicht mit kopierten negativen Margins.

### 8.4 Header-Tools

Friends, Stats und Settings sind runde, **flache** Toolbuttons:

- Touch- und Sichtfläche: 44×44pt;
- Radius: 22pt, also echter Kreis;
- Solid-Fill: `NEU.accent`;
- kein Schatten, kein Glow, kein Inset;
- Abstand untereinander: 12pt;
- Icon: 20pt;
- Iconfarbe: Weiß;
- Press-Feedback: Opacity `0.76` plus Scale `0.96`.

Friends verwendet das bestätigte Personen-Icon. Stats verwendet drei **gefüllte,
ansteigende Balken**, kein 2×2-Grid. Settings verwendet ein **gefülltes Zahnrad**,
keine dünne Outline-Version.

Der Kreis darf trotz der allgemeinen 12–20pt-Radiusregel 22pt verwenden, weil es
ein kreisförmiges Icon-Control ist.

### 8.5 Toggle-, Segment- und Iconbutton-Zustände

- `FlatToggle` ist die einzige Toggle-Implementierung: neutraler Track im
  Off-Zustand, `NEU.accent` im On-Zustand, weißer Thumb, keinerlei Schatten.
- Segmente, Auswahlkarten, Rating-Kreise und Pills: inaktiv `NEU.card` plus
  1pt `NEU.track`; aktiv Solid `NEU.accent` plus weißes Label.
- Stepper dürfen reine Akzent-Text-/Iconaktionen sein; nie erhabene Plus-/Minus-
  Flächen erzeugen.
- Zustand nie über Schatten kommunizieren.
- `accessibilityState` (`selected`, `checked`, `disabled`) setzen.
- Native Touchfläche mindestens 44×44pt.
- Keine kleine sichtbare Form als einziges Touchziel; bei kleinen Pills/Knobs eine
  unsichtbare größere Pressable verwenden.

## 9. Progress-Bars und Slider

Die Homescreen-Progress-Bars sind bewusst flach und **nicht** neumorphisch:

- Fill: `NEU.accent` (`#415DCB`), exakt wie die Header-Tools;
- Track: `#C5CDD8`;
- kein Verlauf;
- kein Schatten;
- kein Glow;
- abgerundete Enden;
- Goal-Karten: 5pt hoch;
- Balance-Karte: 7pt hoch;
- Animation: 800ms, ruhiges Bezier `(0.25, 0.1, 0.25, 1)`;
- Wert immer auf `[0, 1]` begrenzen.
- Für `accessibilityValue` muss der Wertebereich dieselbe mathematische Basis wie
  der sichtbare Fortschritt verwenden: bei `current + 1` von `total` ist
  `min: 0`, `max: total`; jede Seite im Simulator auf Werte über 100 % prüfen.

Für echte interaktive Slider:

- Touchbereich mindestens 44pt hoch;
- Track ist flach `NEU.track`, Fill und Thumb sind Solid `NEU.accent`;
- kein `NeumorphicInsetOverlay`, kein Inner-/Drop-Shadow;
- Akzent-Fill zeigt den Wert explizit;
- Thumb braucht einen zusätzlichen nicht-schattenbasierten Cue;
- `accessibilityRole="adjustable"` plus `accessibilityValue`;
- Increment-/Decrement-Actions für Screenreader.
- Touch-/Drag-Berechnung verwendet stabile Fensterkoordinaten
  (`pageX - gemessene Track-Position`), niemals `locationX` eines möglicherweise
  getroffenen Thumb-/Fill-Kindes. Track, Fill und Thumb sind dekorative
  `pointerEvents="none"`-Kinder; der gesamte 44pt-Wrapper ist das einzige
  Touchziel.
- Der Thumb bleibt auch bei 0 % und 100 % vollständig innerhalb des Tracks;
  sämtliche gespeicherten Sliderwerte werden zusätzlich auf ihren gültigen
  Wertebereich geklemmt.

### 9.1 Flacher Pomodoro-Dial

> **Stand 2026-09-10 (Jannis):** Der Fokus-Screen verwendet den Paper-Look
> (`src/theme/paper.ts`, Variante B): weiße Scheibe mit `PAPER.sunken`-Track und
> `PAPER.accent`-Ring, in der Mitte wächst das gewählte Insel-Objekt. Timer,
> Status und Wachstumszeile stehen unter der Scheibe. Ring-Geometrie,
> Flowtime-Drag und die Aktionsregeln unten gelten weiter.

Der Focus-Timer wurde auf den ruhigen Zustand vor dem 3D-Experiment
zurückgesetzt:

- fester Dial von 260×260pt;
- ein flacher 6pt-Track in `NEU.track`;
- genau ein flacher 6pt-Progress-Stroke in `NEU.accent`;
- Start bei zwölf Uhr, Fortschritt im Uhrzeigersinn;
- runde Endkappen, aber keine zusätzliche Pillenform;
- keine Rail-, Pipe-, Innen-, Außen- oder Glow-Schatten;
- keine SVG-Filter, Gradient-Stops, ClipPaths oder Skia-Komponenten;
- keine zweite helle oder dunkle Progresskontur;
- die Dialfläche verwendet durchgehend `NEU.card`;
- Timertext mittig 48pt/700, Status, Goal und bei Flowtime eine kurze
  Drag-Affordance darunter.

Der Fortschrittsring bleibt ein expliziter Farbcue. Die äußere
`NeumorphicSurface` gehört weiterhin zur ruhigen Kartenhierarchie; der eigentliche
Track und der blaue Fortschritt bleiben vollständig flach. Der Play/Pause-Kreis
verwendet wie die Home-Start-Pill eine statische innere Akzentfläche innerhalb
der Touch-Pressable, damit der Fill zuverlässig rendert.

### 9.1a Flowtime-Ziel: am Ring gesetzt, nicht vorher eingegeben (2026-09-15)

> **Jannis:** „machs bei flowtime so dass man nicht ne zeit davor eingibt, sondern
> dass wenn man auf der timer page ist, man das rad dragged … es sollen bis zu 16h
> möglich sein, nicht lineare skala."

- Der Start-Sheet zeigt bei Flowtime **keine SESSION LENGTH** mehr, sondern den
  Hinweis, dass das Ziel am Ring gesetzt wird. Der CTA heißt `Set your target`.
- Der Timer-Screen öffnet bei Flowtime zuerst im **Einstellzustand**: großer
  Zielwert statt Uhrzeit, Skala am Ring, `Start focus` darunter. Erst der Tap
  startet die Session. Während der Session dreht derselbe Ring weiter.
- **Skala (`src/lib/flowTarget.ts`), verbindlich:** geteilt, nicht logarithmisch.
  Log verteilt 5 min bis 16 h gleichmäßig, trifft aber nur krumme Werte
  (37 min, 2 h 14). Geteilt bleiben es runde Zahlen:

  | Bereich | Schritt | Positionen |
  |---|---|---:|
  | 5 min – 1 h | 5 min | 11 |
  | 1 h – 2 h | 10 min | 6 |
  | 2 h – 4 h | 30 min | 4 |
  | 4 h – 8 h | 1 h | 4 |
  | 8 h – 16 h | 2 h | 4 |

- **16 h ist eine volle Umdrehung** (`FLOW_TARGET_SWEEP = 1`, Jannis 2026-09-15).
  Damit liegt die obere Marke auf beiden Enden der Skala zugleich. Sie ist
  deshalb **nicht** mit dem Minimum beschriftet: die Marke liest „16 h", und
  5 min ist schlicht die Stelle, an der der Bogen noch leer ist. Die Zahl unter
  dem Ring sagt immer, auf welchem der beiden man steht — der Ring muss das nie
  allein tragen.
- **Zwei Dinge auf einem Kreis, klar getrennt:** der Akzentbogen ist immer
  Fortschritt und bewegt sich nie durchs Drehen; das Ziel ist eine kurze Kerbe
  auf der Rail. Teilstriche und Beschriftungen erscheinen nur, **während** gedreht
  wird (und im Einstellzustand) — sonst bleibt der Ring der ruhige
  Fortschrittsring aus §9.1.
- Werte werden als `45 min`, `1 h 30`, `16 h` geschrieben, nie als `90 min`.

Nur im laufenden Flowtime-Fokus ist die Ring-Rail außerdem ein kreisförmiger
Slider:

- Drehung startet oben bei zwölf Uhr und läuft im Uhrzeigersinn;
- Zielzeit folgt der geteilten Skala oben, von 5 Minuten bis 16 Stunden;
- das Ziel darf auch kürzer als die bereits verstrichene Zeit gesetzt werden;
  dann bleibt der Progress-Stroke einfach voll. Drehen darf niemals `elapsed_seconds` oder
  `focused_seconds` manipulieren;
- `duration_seconds` speichert in Flowtime ausschließlich dieses optionale visuelle
  Ziel. Flowtime zählt trotzdem offen nach oben, löst keine automatische Pause aus
  und endet weiterhin nur durch Break oder End Session;
- Berührungen in der Timer-Mitte werden ignoriert. Nur ein breites unsichtbares
  Band um die Rail reagiert, damit Textauswahl und versehentliche Sprünge vermieden
  werden;
- während des Drags folgen Progress-Stroke und Zielanzeige direkt; jeder neue 5-Minuten-Schritt
  gibt leichtes haptisches Feedback;
- VoiceOver erhält `adjustable`, Min/Max/Now sowie Increment-/Decrement-Aktionen.

Für die Timer-Aktionen gelten zusätzlich:

- Die Modusauswahl verwendet überall dieselbe flache Zweizeilen-Komponente:
  `Intervals` + `Set time` sowie `Flowtime` + `No limit` (Setup, Settings,
  Start-Popup). `Countdown`/`Count up` wurden am 2026-09-10 auf Nutzerwunsch
  ersetzt: Die Flowtime-Karte nannte „Count up" und im Text „without a
  countdown" und damit beide Mechanismen gleichzeitig. Auswahltexte beschreiben,
  was passiert, nicht die Uhrrichtung. Das zweite Label ist auch im inaktiven
  Zustand sichtbar; Farbe allein darf die Bedeutung nicht tragen.
- Settings zeigt abhängig vom Modus nur relevante Werte. Für Intervals:
  Fokusblock und Basis-Pausenlänge. Für Flowtime **keine Zeitangabe** mehr — das
  Ziel gehört an den Ring (§9.1a); stattdessen der Satz, dass das Ziel den Timer
  niemals beendet und Break manuell ausgelöst wird.
- Home nennt am Focus-Goal den tatsächlich verwendeten Modus (`Intervals` oder
  `Flowtime`) statt des unspezifischen Typlabels `Focus`. Bei einer offenen
  Session stammt das Label aus der Session, nicht aus einer nachträglich
  geänderten Default-Einstellung.
- Oberhalb des laufenden Dials steht immer eines der eindeutigen Paare
  `INTERVALS · COUNTDOWN`, `FLOWTIME · COUNT UP` oder
  `RECOVERY · COUNTDOWN`, gefolgt von einem kurzen Satz zum Endverhalten.
- Pause/Resume ist keine schwebende neumorphische Kreisfläche, sondern eine große
  flache Solid-Accent-Pill mit sichtbarem Verb und echtem Pause-/Play-Icon;
- Im Flowtime-Fokus bleibt Pause/Resume die einzige gefüllte Primäraktion.
  `Break` ist eine flache Outline-Aktion in Accent, damit beide Aktionen nicht
  dieselbe visuelle Priorität vortäuschen.
- der Status schreibt `Paused` zusätzlich aus und der Countdown darf während
  Pause weder visuell noch intern weiterlaufen;
- `+5 min` ist eine flache Textaktion mit mindestens 44pt Touchziel;
- `End Session` ist sekundär und verlangt vor dem Speichern eine Systembestätigung,
  die die tatsächlich gespeicherte Fokusdauer nennt;
- Musik ist opt-in. `Off` muss als gleichwertige, klar ausgewählte Option sichtbar
  sein; Tests und Previews dürfen nie selbstständig einen Track starten;
- Flowtime füllt den Progress-Stroke bis zum gewählten Ziel. Wird das Ziel erreicht,
  bleibt er voll, während die ehrliche Count-up-Zeit weiterläuft; der Ring darf die
  Session niemals scheinbar zurücksetzen.

Sound-/Modusoptionen in einer horizontalen Reihe dürfen am rechten Displayrand nie
mit einem abgeschnittenen Teilwort enden. Entweder alle Labels vollständig innerhalb
der verfügbaren Breite verteilen oder echtes horizontales Scrollen mit klarer
Fortsetzungs-Affordance verwenden. Auch kompakte sichtbare Pills behalten eine
mindestens 44pt breite Pressable.

## 10. Inputs und vertiefte Flächen

Alle Texteingabefelder sind ausdrücklich **minimalistisch und flach**. Dies gilt
ohne Ausnahme für Auth, Freundescode, Ortssuche, Notizen und zukünftige Formulare.
Immer `src/components/ui/MinimalTextInput.tsx` verwenden:

- Hintergrund `NEU.card`;
- Radius `NEU.radiusSmall` (12pt);
- Mindesthöhe 52pt;
- 1pt neutrale Kontur `NEU.track` im Ruhezustand;
- 2pt `NEU.accent` bei Focus oder sichtbarem Validierungsfehler;
- 16pt Text, `NEU.textPrimary`, 16pt Horizontalpadding;
- Placeholder `NEU.textSecondary`;
- Passwortaktion „Show/Hide" als Text im Feld, Touchziel mindestens 44pt;
- Fehler zusätzlich als verständlicher Text unter dem Feld, nie nur als Farbe.
- kein `NeumorphicInsetOverlay`;
- kein heller oder dunkler Input-Schatten;
- keine extrudierte Wrapperkarte nur für ein einzelnes Eingabefeld.

`NeumorphicInsetOverlay` bleibt ausschließlich für den nicht als Button dienenden
inneren Pomodoro-Dial erlaubt. Slider, Toggles und Inputs bleiben vollständig flach.

### 10.1 Anmeldung: nur Apple und Google (2026-09-17, Jannis)

**E-Mail und Passwort gibt es nicht mehr.** Supabase liefert seine eingebauten
Mails ausschließlich an Mitglieder der eigenen Organisation aus; für echte Nutzer
käme keine einzige Bestätigungs- oder Wiederherstellungsmail an, und einen eigenen
Mailversand will Jannis nicht betreiben. Also fällt der ganze Zweig weg: kein
Registrierungsformular, keine Bestätigungsmail, kein „Forgot password?",
keine Tabs zwischen Anmelden und Registrieren. Die erste Anmeldung legt das Konto
an — das steht als einzelner Satz unter den Buttons.

Der Auth-Screen ist damit: Back, Überschrift, ein Satz, die beiden Kreise mit
ihren Namen darunter, ein Hinweissatz. Sonst nichts. `PasswordResetScreen` bleibt
nur als Ziel alter Wiederherstellungslinks bestehen und ist aus der Oberfläche
nicht mehr erreichbar.

Apple und Google sind weiterhin zwei **runde Buttons nebeneinander**, nicht
gestapelte Full-Width-Buttons — was sich geändert hat, ist der Raum um sie herum:
Sie stehen mittig statt unter einem Divider und tragen ihren Namen darunter, weil
ein unbeschrifteter Kreis keine Einladung ist.

- 66×66pt, Radius 33pt;
- `NEU.card`, 1pt `NEU.track`-Kontur, kein Schatten;
- Abstand 34pt, zentrierte Reihe;
- offizielles Apple- bzw. vierfarbiges Google-Zeichen, ungefähr 31pt;
- Brandfarben sind ausschließlich innerhalb des Google-Logos erlaubt und zählen
  nicht als zusätzliche Interface-Akzentfarben;
- `accessibilityLabel` lautet „Continue with Apple/Google";
- auf iOS müssen beide Buttons sichtbar sein, ohne initiales Scrollen oder Clipping.

### 10.2 Auth-Komposition (Stand 2026-09-17)

- Es gibt keine Primäraktion als Fläche mehr. Die beiden Kreise **sind** die
  Aktion; ein zusätzlicher Button darüber oder darunter wäre eine zweite Tür zum
  selben Raum.
- Der Inhalt sitzt vertikal mittig (`flexGrow: 1`, `justifyContent: "center"`),
  Back oben links. Kein Divider mehr — es gibt nichts, wovon zu trennen wäre.
- Ein Fehler erscheint als ruhige Karte über den Buttons, nie nur als Farbe.
- Sichtbare Füllfarben liegen weiterhin auf einer inneren `View`, nicht direkt auf
  `Pressable`, da React Native Pressable-Hintergründe in diesem Projekt bereits
  mehrfach im Simulator ausgefallen sind.
- **Historisch, nicht wieder einführen:** monochrome 56pt-Primärfläche,
  `Create account`/`Sign In`-Tabs, `Forgot password?`, Bestätigungsmail-Hinweis
  mit „Resend".

## 11. Icons

- Icons leben in `src/components/TabIcons.tsx`.
- Einheitliche 24×24 ViewBox.
- Standardgröße im Content 13–20pt, Header-Tools 20pt.
- Normale Metadatenicons: dunkles Sekundärgrau.
- Interaktive Headericons: weiß auf flachem `NEU.accent`-Kreis.
- Linienenden bei Outline-Icons rund.
- Keine Emojis.
- Keine externen Iconfonts nur für ein einzelnes Symbol installieren.
- Kein Mix aus filled, duotone und outline innerhalb derselben Control-Gruppe.
- Die Headergruppe ist bewusst filled; Metadaten innerhalb der Goal-Karten bleiben
  outline und sekundär.

## 12. Grove-/Garden-Vorschau — entfernt (2026-09-14)

> **Grove gibt es nicht mehr.** Jannis hat den eigenen Screen ersatzlos gestrichen:
> die Insel lebt ausschließlich als Hintergrund des Homescreens. `GardenScreen`
> und `GardenPreview` sind gelöscht, `MainTabs` rendert Home direkt. Der Abschnitt
> unten bleibt nur als Beleg für die konzentrische Radiusregel stehen; die
> Grove-Karte selbst nicht wieder einführen.

## 12b. Frühere Grove-Karte (historisch)

Die Grove-Karte ist der visuelle Abschluss des Homescreens:

- äußerer Wrapper: `flex: 1`;
- 24pt links, rechts und unten;
- 20pt obere Ecken;
- 31pt untere Ecken;
- Kartenfläche `NEU.card`;
- dunkler Schatten auf `0.45` reduziert;
- interner Preview-Well mit `NEU.bg`;
- interner Radius 18pt;
- Preview wächst per `flex: 1`;
- Header `Your Grove` links;
- `View` + Chevron rechts als flache Textaktion mit mindestens 44pt Touchhöhe;
- die neumorphische Kartenfläche selbst ist kein Button;
- keine zusätzliche Kartenborder.

Nur die **unteren** Grove-Ecken folgen der iPhone-Geometrie. Die oberen bleiben 20pt,
damit alle Karten als Familie gelesen werden.

## 13. Navigation ohne Bottom-Bar

Es gibt **keine sichtbare Bottom-Navigation**. Keine Tabbar, kein schwebendes Panel,
keine reservierten 88pt und keine Home/Grove-Labels am unteren Rand.

- `MainTabs.tsx` darf intern als Home-/Grove-Routencontainer bestehen bleiben,
  rendert aber `tabBar={() => null}` und reserviert keinen Bottom-Abstand.
- Home ist der Hauptscreen.
- Einen Grove-Screen gibt es nicht mehr (2026-09-14). Die Insel ist der
  Home-Hintergrund; keine zweite Seite dafür anlegen.
- Analytics wird ausschließlich über den runden Stats-Headerbutton geöffnet.
- Analytics und AnalyticsWeek bleiben Root-Stack-Screens mit sichtbarer Back-Aktion.
- Settings und Friends bleiben ebenfalls Home-Headeraktionen.

Keine neue persistente Navigation ergänzen, solange der Nutzer sie nicht ausdrücklich
wieder verlangt.

## 13.1 Onboarding-Komposition

- Genau ein Focus-Timer-Showcase. Keine zweite Timer-Seite mit einer anderen
  Visualisierung; Erklärung und Ring werden auf der Welcome-Seite gebündelt.
- Feature-Reihenfolge ist verbindlich: erst der gesamte Block **Feature 1 · Focus
  Timer** (Showcase, Stil, Ziel), danach der gesamte Block **Feature 2 · Auto
  Check-In** (Showcase, Standort, Ziel). Die Blöcke dürfen nie ineinander verschachtelt
  oder abwechselnd angeordnet werden.
- Beim ersten Screen jedes Feature-Blocks erscheint zunächst kurz eine große
  Kapitelkarte mit Feature-Nummer und Namen. Label, Titel, Linie und Erklärung
  steigen dezent zeitversetzt ein; nach 1,2 Sekunden fadet das Kapitel aus und der
  Inhalt fadet leicht verzögert ein. Das gesamte Kapitel ist zusätzlich als
  zugängliche Aktion „Tap to explore" nutzbar, damit niemand auf die Animation
  warten muss. Kein Springen, Drehen oder dauerndes Pulsieren. Währenddessen sind
  Swipe und beide Footer-Aktionen ausgeblendet. Bei systemweit reduziertem
  Bewegungsumfang wird die Sequenz auf einen praktisch sofortigen Zustandswechsel
  verkürzt.
- Der Fortschritt besteht aus einer ruhigen durchgehenden 4pt-Leiste. Darüber
  stehen links der aktuelle Abschnitt (`Welcome`, `Focus Timer`, `Auto Check-In`
  oder `Ready to begin`) und rechts `x of 8`. Leiste und Text liegen direkt auf
  `NEU.bg`, ohne separate Top-Bar, Schatten oder abweichende Fläche.
- Ein horizontaler Seitenwechsel kombiniert die native Pagerbewegung nur mit
  einer sehr kleinen 18pt-Gegenbewegung und Opacity 0,55→1→0,55. Bei Reduce
  Motion entfallen beide Effekte und programmatische Wechsel springen direkt.
- Demoanimationen vermitteln genau einen Zustand und enden dann: Der Timer füllt
  sich einmal bis zu einem plausiblen Beispielwert; der Standort-Puls läuft
  zweimal. Keine Onboarding-Illustration pulsiert oder rotiert endlos.
- Jede Inhaltsseite ist vertikal scrollbar und passt ihre Insets an die Tastatur
  an. Der Footer bleibt trotzdem als eine stabile Zeile in der Safe Area.
- Auf Seiten mit eigener horizontaler Interaktion — Zahlenrad und Karte — ist
  horizontales Pager-Swipen deaktiviert. `Back` und `Continue` bleiben vollständig
  erreichbar; so konkurriert die Seitengeste nicht mit Auswahl oder Karten-Pan.
- VoiceOver erhält bei jedem Seitenwechsel Abschnitt und Schrittzahl als
  Ankündigung. Seitentitel sind als Header markiert, Auswahlkarten lesen Titel,
  Verhalten und Erklärung.
- Die Welcome-Seite nennt neben allen vier vorhandenen Nutzen-/Privacy-Punkten
  die erwartete Dauer (`About 2 minutes`) und dass jede Auswahl später in
  Settings geändert werden kann.
- Auto Check-In ist ein separates Feature und erhält eine eigene Seite mit
  `Feature 2 · Auto Check-In`, Orts-/Besuchs-Sprache und Pin-Visual.
- Die optionale Einrichtung folgt direkt im Onboarding auf **zwei getrennten
  Setup-Seiten**: zuerst eine echte Karte mit direkt gesetztem/verschiebbarem Pin,
  optionaler Suche oder aktuellem Standort und Radius (15/30/70 m),
  danach Kategorie und wöchentliches Besuchsziel.
- Das Pinning findet vollständig im Onboarding statt. Nutzer können direkt auf die
  Karte tippen, den Marker ziehen, einen Suchtreffer anpinnen oder „My location"
  verwenden. Ortstreffer zeigen Name und Adresse. Eine Auswahl speichert echte Koordinaten,
  vollständige Adresse und Radius in `pendingOnboarding.checkin_location`; keine
  Platzhalterkoordinaten und kein bloßer Ortsname.
- Ortssuche beginnt immer lokal: Bei erteilter Vordergrund-Location wird das Land
  aus aktuellem/letztem Standort plus systemischem Reverse-Geocoding bestimmt.
  Nur wenn das nicht verfügbar ist, darf die Geräte-Region als Fallback dienen.
- Der erste Request verwendet einen harten ISO-3166-1-Alpha-2-Länderfilter, keine
  bloße geografische Gewichtung. Ein leerer lokaler Trefferzustand darf niemals
  still Ergebnisse aus anderen Ländern einblenden.
- Globale Suche ist eine ausdrücklich beschriftete zweite Nutzeraktion (`Search
  Worldwide`). Kein Suchergebnis wird automatisch ausgewählt: Nur der Tap auf
  Name + vollständige Adresse setzt den Pin. Das aktuell verwendete Suchland wird
  über den Ergebnissen sichtbar benannt.
- Auto Check-In bleibt vollständig optional. `Skip` muss vor und nach einer
  Ortsauswahl erreichbar sein, alle Auto-Check-In-Werte verwerfen und direkt zur
  Permissions-Seite springen. Ein Skip darf kein Physical Goal anlegen.
- Nach Signup beziehungsweise beim direkten Post-Auth-Abschluss wird das optionale
  Auto-Check-In Goal nur angelegt, wenn Kategorie und gültiger Ort vorhanden sind.
  Wiederholte Abschlussversuche dürfen keine doppelten aktiven Goals erzeugen.
- Es gibt keine zusätzliche Account-/Zusammenfassungs-Slide. `Permissions` ist die
  letzte Seite und führt mit `Create Account` direkt zum Auth-Screen beziehungsweise
  schließt post-auth mit `Finish` ab.
- Focus-Seiten tragen `Feature 1 · Focus Timer`. Nie „study" als übergeordnetes
  Produktlabel verwenden, weil Focus auch Arbeit und andere Kategorien abdeckt.
- Vergleichssatz beibehalten: „Focus Timer measures time. Auto Check-In measures visits."
- Intervals/Flowtime-Auswahlkarten: 20pt horizontal und vertikal innen,
  Titel 18pt/600, Beschreibung 16pt/24pt line-height, mindestens 8pt Titelabstand.
  Copy kurz halten; kein Text darf an der Kartenkante sitzen oder geclippt werden.
- Footer ist eine einzige horizontale Zeile. Maximal eine Textaktion links und eine
  rechts, beide gleiche vertikale Mitte und mindestens 44pt hoch.
- Footer-Textaktionen verwenden 32pt Abstand zur linken bzw. rechten Displaykante.
- Zulässige linke Aktionen: `I have an account` auf der ersten Pre-Auth-Seite
  oder `Back`. Zulässige rechte Aktionen: `Get Started`, `Continue`, optional
  `Skip`, `Sign In` oder `Finish`. `Create Account` ist entfallen: Anmelden und
  Registrieren sind seit 2026-09-17 dieselbe Tür (§10.1).
- Keine gefüllten Footerbuttons, keine Schatten, keine zweite Aktionszeile.

## 14. Modals, Popups, Empty States und Warnungen

- Modal-Hintergrund darf mit neutralem Schwarz abgedunkelt werden; dies ist keine
  Interface-Akzentfarbe.
- Friends und Settings besitzen keine separate feste Top-Bar. Titel, Close-Aktion
  und Karten liegen im selben ScrollView auf einer durchgehenden `NEU.bg`-Fläche.
  So existiert kein Viewport-Rand zwischen Header und erstem Kartenblock, der
  Schatten oder Hintergrund als horizontale Naht abschneiden kann.
- Die jeweils erste Karte unter diesem Inline-Header unterdrückt ihren hellen
  Top-Left-Schatten (`lightShadowOpacity={0}`). Dadurch entsteht oberhalb der
  Karte keine horizontale Lichtkante, die wie eine Top-Bar wirken kann.
- Inhaltspanel immer über `PopupCard`, Radius 20pt und `NEU.card`. Popups sind
  ausdrücklich flach: kein heller/dunkler neumorphischer Schatten, kein
  Drop-Shadow, kein Glow und keine zusätzliche Kontur.
- Maximale Popupbreite 420pt.
- Popup-Padding typischerweise 24pt horizontal, 20pt oben, 24pt unten.
- Empty States verwenden normale Karten, keine dashed Borders.
- Warnungen bleiben monochrom. Keine gelben, roten oder orangenen Flächen erfinden.
- Destruktive Semantik darf über Text und Systemdialog deutlich werden; zusätzliche
  gesättigte Flächen nur nach expliziter Produktentscheidung.
- Serverdaten besitzen vier getrennte Zustände: Loading, Error, Empty und Content.
  „Error" darf niemals als leere Liste oder als echte `0` gerendert werden.
- Loading zeigt eine ruhige Aktivitätsanzeige oder verständlichen Text und keine
  erfundenen Skeleton-Daten.
- Error nennt knapp, was nicht geladen/gespeichert wurde, und bietet bei einer
  wiederholbaren Aktion `Try Again`/`Retry` mit mindestens 44pt Touchfläche.
- Empty wird nur nach einer erfolgreichen leeren Antwort gezeigt und enthält eine
  konkrete nächste Aktion, wenn der Nutzer den Zustand selbst ändern kann.
- Optimistische Änderungen, die serverseitig scheitern, werden zurückgerollt oder
  bleiben sichtbar als ungespeicherter Zustand; nie still Erfolg vortäuschen.

## 15. Accessibility — nicht optional

- Jede Interaktion mindestens 44×44pt.
- Kleine sichtbare Elemente liegen in einer größeren Touchfläche.
- Bodytext Zielkontrast mindestens 7:1, niemals unter 4.5:1.
- Interaktionen brauchen einen nicht-schattenbasierten Cue:
  Akzentfill, Akzentlabel, Akzentborder oder verständliches Icon.
- Inputs erhalten einen sichtbaren 2pt Akzent-Focus.
- Toggle: `accessibilityRole="switch"` und `accessibilityState.checked`.
- Tabs/Selections: `accessibilityState.selected`.
- Disabled: `accessibilityState.disabled` plus sichtbare Opacity.
- Slider: `adjustable`, aktueller Wert, Min/Max und Accessibility-Actions.
- Icon-only Buttons brauchen konkrete Labels wie `Open stats` oder `Open settings`.
- Niemals nur Farbe verwenden, um einen kritischen Zustand zu erklären.

React Native hat kein Web-`:focus-visible`. Auf nativen Screens den Focus-State über
`onFocus`/`onBlur` abbilden; auf Web bei Bedarf zusätzlich `focus-visible` ergänzen.

## 16. Responsive Geometrie und iPhone-Ränder

- Safe Areas respektieren; keine optische Ausrichtung an der schwarzen
  Simulator-Bezel statt an der tatsächlichen Displayfläche.
- Hauptkarten verwenden 24pt horizontalen Abstand.
- Screennahe untere Karten brauchen genug Raum für ihren Schatten.
- Eine runde Geräteaußenkante wird durch konzentrische Radien reproduziert:
  äußerer Screenradius minus Abstand, nicht durch einen willkürlichen großen Radius.
- Sonderradien nur an den Ecken anwenden, die tatsächlich an die Gerätekante grenzen.
- Auf Android und kleineren iPhones Screenshots separat prüfen; feste 31pt nur
  verwenden, solange 24pt Inset und vergleichbare iPhone-Geometrie bestehen.

## 16.1 Das Inselwachstum ist ein Ereignis (2026-09-15)

Die Insel wächst über fünf Stufen, und das ist der Zielpunkt der ganzen
Sammelmechanik. Zwei Regeln, verbindlich:

- **Der Wechsel wird angekündigt, nicht getauscht.** `IslandGrewOverlay` blendet
  das alte Inselbild über 900 ms aus und nennt danach die erreichte Größe. Genau
  einmal je Stufe (`islandStageSeenByUser`), nie blockierend, bei reduziertem
  Bewegungsumfang ohne Überblendung.
- **Der Abstand zur nächsten Größe ist immer sichtbar.** `islandGrowth()` liefert
  ihn; die `IslandProgressPill` zeigt ihn dauerhaft auf Home, und jede Sperre
  („Island too small") nennt ihn statt nur abzulehnen. Eine Grenze ohne
  Entfernungsangabe ist die frustrierende Hälfte der Mechanik.
- **Nach der größten Insel ist nicht Schluss.** Die letzte Inselgröße kommt bei
  240 Stufen, der Katalog hat 583 — es bleibt also mehr als die Hälfte übrig.
  Ab Insel V misst die Pille deshalb nicht mehr die nächste Größe, sondern die
  Sammlung: „Island V · 181 to finish". Erst wenn wirklich jede Kopie jedes
  Objekts ausgewachsen ist, steht dort „complete".
- **Eine fertige Insel ist ein Abschluss, kein Verfall.** Wenn eine Belohnung
  nirgends mehr hin kann, darf der Reveal das nie als Verlust formulieren: die
  Sammlung ist vollständig, und die Session zählt weiter für Stunden, Streak und
  Statistik. Nur eine *zu kleine* Insel hebt die Belohnung auf und liefert sie
  beim nächsten Wachstum nach.

## 16.2 Was Freunde voneinander sehen (2026-09-16)

Die Freundeszeile zeigt drei Zahlen in immer denselben Spalten — Check-ins,
Focus, All time — und links die Insel. Regeln:

- **Drei Zahlen, feste Plätze.** Wie oft jemand diese Woche da war, wie lange er
  gearbeitet hat, und wie viel beides je zusammen ergeben hat. Eine Zeile, die
  sich nicht verschiebt, liest man im Vorbeigehen; ein Satz aus gemischten
  Einheiten nicht. Keine vierte Zahl ohne guten Grund.
- **Die Insel ist antippbar und führt auf `FriendIsland`.** Dort steht die Insel
  formatfüllend mit allem, was daraufsteht, plus Zurück und Name. Sonst nichts —
  keine Statistik, keine Aktionen, nichts Veränderbares.
- **Was den Account verlässt:** Größe und Stufen wandern mit jeder Speicherung
  mit (`island_state.stage`, `island_state.levels`) und stehen in der Liste. Was
  *auf* der Insel steht, holt `get_friend_island` erst beim Besuch und nur für
  jemanden, der als Freund eingetragen ist. Sessions, Ziele und Zeiten sind nie
  dabei.
- **Der Text neben dem Freundescode muss das benennen.** Er ist das Versprechen,
  was geteilt wird; wenn dort etwas fehlt, ist es ein Datenschutzfehler, kein
  Textfehler.
- **Die Bildgröße trägt die Inselgröße.** Alle fünf Inselbilder zeigen die Insel
  gleich breit — die Kamera geht mit. Im `IslandBadge` wächst deshalb der Rahmen
  mit den echten Metern (`ISLAND_STAGE_METRES`), sonst sähen Insel I und Insel V
  identisch aus und das Abzeichen wäre reine Dekoration.

## 16.3 Objekte anfassen und Inseln laden (2026-09-17)

- **Man greift, was man sieht.** Welches Objekt eine Berührung meint, entscheidet
  das **Bild**, nicht die Bodenzelle (`spriteReach` in
  `src/components/island/islandSprites.ts`). Ein Haus wird hoch und nach oben von
  seiner Zelle weg gezeichnet; die Zellenprüfung zwang dazu, es an der Türschwelle
  anzufassen. Ein getroffener Bildpunkt gewinnt sofort, vorderstes Objekt zuerst;
  trifft nichts, zählt das nächste Bild im Umkreis einer Fingerkuppe (6 Bildpixel).
  Reihenfolge ist die Zeichenreihenfolge rückwärts: was zuletzt gemalt wird, liegt
  vorn, und was vorn liegt, ist gemeint.
- **Ein Screen zeigt nie eine falsche Insel, während er lädt.** Welche Insel
  gezeichnet wird, hängt an der Größe, und die kommt erst mit den Daten. Also
  bleibt bis dahin alles aus, es läuft eine Ladeanzeige auf offener See, und dann
  blendet die ganze Szene auf einmal ein — Hintergrund und Objekte zusammen, nie
  nacheinander. Zurück funktioniert ab dem ersten Bild.

## 17. Animationsregeln

- Animationen ruhig und funktional.
- Screen Fade: etwa 300–500ms.
- Progress-Reveal: 800ms.
- Keine dauernd pulsierenden Glows.
- Eine rein erklärende Animation darf nie den einzigen Weg nach vorn blockieren;
  sie ist überspringbar oder läuft parallel zu einer erreichbaren Aktion.
- Keine springenden Karten ohne funktionalen Grund.
- Press-Feedback kurz über Opacity oder minimalen Scale.
- Animation darf Layout, Textlesbarkeit oder Touchziel nicht verändern.
- `prefers-reduced-motion`/Systemeinstellung bei größeren Animationen respektieren,
  wenn plattformübergreifend ergänzt.

## 18. Vorgehen für die Migration weiterer Screens

Die nächste KI arbeitet pro Screen in dieser Reihenfolge:

1. **Root vereinheitlichen:** Screen, SafeArea und Navigator-Hintergrund auf `NEU.bg`.
2. **Ad-hoc Palette entfernen:** lokale Weiß-/Grau-/Blau-Konstanten durch `NEU`.
3. **Glass entfernen:** Blur, Transparenz, Glass-Komponenten und deren Wrapper löschen.
4. **Karten migrieren:** jede echte Inhaltsgruppe in `NeumorphicSurface`, Radius 20,
   Kartenfarbe automatisch über die Komponente.
5. **Außenabstände vereinheitlichen:** 24pt horizontal, 16pt Standardabstand.
6. **Inputs migrieren:** ausnahmslos `MinimalTextInput`; keine Textinput-Inset-Schatten.
7. **Controls klassifizieren:** Solid-CTA/Accent-Pill, TextAction, flacher
   Outline-Selector oder `FlatToggle`. Kein interaktives Control neumorphisch machen.
8. **Progress/Slider bereinigen:** violetter Solid-Fill, kein Verlauf/Glow.
9. **Icons ersetzen:** Emojis und fremde Stilcluster entfernen.
10. **Typografie prüfen:** Outfit 500/600/700, Body ≥16.
11. **Accessibility ergänzen:** Labels, Rollen, States, 44pt Touchziele.
12. **Geräteränder prüfen:** terminale Karte, Schattenauslauf und Safe Area.
13. **Kompilieren:** `npx tsc --noEmit -p .`.
14. **Visuell prüfen:** mindestens iPhone 17 Pro / iOS 26.5 im Simulator.

Nicht mehrere Screens zuerst mechanisch ändern und erst am Ende ansehen. Nach jedem
Screen einen Screenshot prüfen, weil Schatten-Clipping, verschmolzene Margins und
geräteabhängige Radien durch TypeScript nicht erkannt werden.

## 19. Pflicht-Abnahmecheck pro Screen

Vor Abschluss jede Frage mit Ja beantworten:

### Farbe

- Ist jede Hintergrundebene `NEU.bg`?
- Sind Karten `NEU.card`?
- Ist `NEU.accent` die einzige gesättigte Interfacefarbe?
- Gibt es keine zufälligen Weißflächen?

### Karten

- Verwendet jede Karte `NeumorphicSurface`?
- Haben normale Karten überall 20pt Radius?
- Sind beide Schatten vorhanden und oben links/unten rechts konsistent?
- Ist kein Schatten durch `overflow: hidden` abgeschnitten?
- Sind Karten frei von sichtbaren Borders?

### Layout

- Beträgt der Hauptkartenabstand horizontal 24pt?
- Sind Margins außen und Paddings innen?
- Gibt es mindestens 44pt große Touchziele?
- Hat eine untere Karte genug Platz für den dunklen Schatten?

### Buttons

- Sind ausnahmslos alle Buttons, Header-Tools, Toggles, Segmente, Stepper,
  Auswahlkarten, Slider und Pills frei von Neumorphismus, Verlauf und Glow?
- Wird `NeumorphicSurface` ausschließlich als nicht-interaktive Inhaltskarte
  verwendet?
- Ist die sichtbare Aktion über Farbe/Label/Icon verständlich?

### Typografie und Icons

- Wird Outfit 500/600/700 korrekt verwendet?
- Ist Bodytext mindestens 16pt?
- Sind sekundäre Texte noch kontrastreich?
- Gibt es keine Emojis?
- Passen Filled/Outline-Stile innerhalb der Gruppe zusammen?

### Funktion und QA

- Funktionieren Navigation und Press-Zustände?
- Sind Focus-, Selected-, Checked- und Disabled-Zustände zugänglich?
- Sind Loading, Error, Empty und Content logisch getrennt und ist Retry erreichbar?
- Werden serverseitig fehlgeschlagene optimistische Änderungen zurückgerollt?
- Ist Analytics nur über Home-Stats erreichbar und besitzt die Seite eine Back-Aktion?
- Ist keine sichtbare oder platzreservierende Bottom-Bar vorhanden?
- Verwenden alle Texteingaben `MinimalTextInput` ohne Schatten?
- Hat Onboarding unten höchstens eine Textaktion links und rechts?
- Läuft `npx tsc --noEmit -p .` ohne Fehler?
- Wurde ein echter Simulator-Screenshot kontrolliert?

## 20. Häufige Fehler, die bereits aufgetreten sind

1. **Karte und Seite exakt gleich gefärbt:** wirkte zu flach. Karten bleiben
   `#E9EDF2`, Seite `#E0E5EC`.
2. **Schattenradius 16:** zu weit gestreut. Aktuell 12.
3. **Schatten auf geclippter View:** Schatten verschwand. Wrapper beibehalten.
4. **Margin auf innerer Surface:** Karten wirkten optisch verschmolzen.
5. **Grove-Schatten am unteren Rand:** dunkler Schatten staute sich. Bottom-Margin
   24 und Dark-Opacity 0.45 verwenden.
6. **Alle Grove-Ecken auf Geräteradius:** wirkte inkonsistent. Nur unten 31,
   oben 20.
7. **Uneinheitliche Kartenradien:** alle normalen Karten auf 20 vereinheitlichen.
8. **Neumorphische Controls:** endgültig appweit verworfen. Das umfasst auch
   Header-Tools, Toggles, Segmente, Stepper, Slider, Rating-Buttons und
   Auswahlkarten; nicht-interaktive Inhaltskarten bleiben neumorphisch.
9. **Start-Button mit Verlauf/Glow:** verworfen. Solid Accent-Pill ohne Schatten.
10. **Start-Fill direkt auf verschachtelter Pressable:** Hintergrund renderte in
    einem Zustand nicht, weißer Text blieb sichtbar. Fill auf innerem View setzen.
11. **Start-Text nicht zentriert:** sichtbaren Innen-View explizit horizontal und
    vertikal zentrieren.
12. **Stats als 2×2-Grid:** verworfen. Drei steigende gefüllte Balken.
13. **Settings als Outline-Zahnrad:** verworfen. Gefülltes Akzent-Zahnrad.
14. **Blaue Progress-Bars:** verworfen. Exakt `NEU.accent` wie Headericons.
15. **Weißer oder bunter Hintergrund:** verworfen. Ausschließlich `NEU.bg`.
16. **Glass-Abhängigkeiten behalten:** erzeugt Rückfallrisiko. Nicht reinstallieren.
17. **Analytics als dritter Tab:** erzeugte eine falsche Produkt-Hierarchie. Stats
    ausschließlich über den Home-Headerbutton öffnen.
18. **Zwei unterschiedlich gestaltete Timer-Onboardingseiten:** redundant. In eine
    Welcome-/Timer-Seite komprimieren.
19. **Dynamischer `Pressable`-Style für große Auswahlkarten:** In einer früheren
    Styling-Konfiguration ging das Innenpadding verloren und Text wurde geclippt.
    Geometrie (`padding`, `borderRadius`, `borderWidth`) statisch setzen; dynamisches
    Feedback separat und anschließend im Simulator prüfen.
20. **OAuth-Logos ohne klaren Kreis bzw. unterhalb des Viewports:** Auth-Inhalt so
    verteilen, dass die 66pt-Kreise als eigener unterer Block mit sichtbarer Kontur
    und ausreichendem Bottom-Padding erscheinen.
21. **Persistente Home/Grove-Bottom-Bar:** auf Nutzerwunsch vollständig entfernt.
    `MainTabs` darf nur noch unsichtbarer Routencontainer sein.
22. **3D-Pomodoro-Rail und erhabene Progress-Pipe:** nach mehreren Varianten
    verworfen. Die Schatten erzeugten sichtbare Kanten und machten den Timer
    unnötig schwer. Verbindlich ist wieder der flache 260pt-Ring mit einem
    einzelnen 6pt-Track und einem einzelnen 6pt-Akzentfortschritt.
23. **Neumorphische Texteingaben außerhalb Auth:** ebenfalls verworfen. Das flache
    `MinimalTextInput` gilt jetzt appweit.
24. **Frisches `[]` als Query-Fallback in Renderlogik:** kann abhängige
    Projection-/Layout-Effects bei jedem Render neu starten und eine
    „Maximum update depth exceeded"-Schleife erzeugen. Modulweit stabile leere
    Arrays verwenden und Layout-State nur bei real geänderten Koordinaten setzen.
25. **Teilweise sichtbare letzte Audio-Pill:** ein einzelner Buchstabe am rechten
    Rand ist kein akzeptabler Scrollhinweis. Labels vollständig einpassen oder
    die Fortsetzung bewusst und lesbar gestalten.
26. **Onboarding-A11y-Fortschritt mit `min: 1`:** erzeugt bei `current + 1`
    rechnerisch mehr als 100 %. Sichtbaren und semantischen Wertebereich immer
    gemeinsam testen.
27. **Neumorphische Header-Tools als frühere Ausnahme:** ebenfalls verworfen.
    Friends, Stats und Settings sind jetzt flache Solid-Accent-Kreise mit weißen
    Icons. Keine interaktive Ausnahme mehr einführen.

## 21. Source-of-Truth-Dateien

Vor einer visuellen Migration gezielt diese Dateien lesen:

- `src/theme/neumorphism.ts` — Tokens
- `src/components/NeumorphicSurface.tsx` — ausschließlich Karten, Kartenschatten
  und Pomodoro-Dial-Inset
- `src/components/ui/MinimalTextInput.tsx` — einziges Texteingabefeld
- `src/components/ui/PrimaryButton.tsx` — Standard-CTA
- `src/components/ui/TextAction.tsx` — Textaktion
- `src/components/ui/FlatToggle.tsx` — einziger Toggle
- `src/components/ui/PopupCard.tsx` — Modalpanel
- `src/components/ProgressBar.tsx` — Progress
- `src/components/TabIcons.tsx` — Icons
- `src/screens/HomeScreen.tsx` — Screenkomposition
- `src/navigation/MainTabs.tsx` — Routencontainer, rendert nur noch Home

Keine zweite Komponentenfamilie parallel anlegen. Wenn ein Rezept fehlt, die
bestehende primitive Komponente gezielt erweitern.

# Kommunikationsstil

**So wenig Text wie möglich.** Jannis will Zusammenfassungen, keine Berichte.

- Während der Arbeit: ein kurzer Satz, woran gerade gearbeitet wird. Bei
  Schritten über ein paar Sekunden die Dauer nennen.
- Am Ende: eine knappe Zusammenfassung, was gemacht wurde und was als Nächstes
  wichtig ist. Wenige Sätze, gern Stichpunkte.
- **Nichts Technisches**, solange nicht danach gefragt wird: keine Dateinamen,
  Funktionsnamen, Codeausschnitte, Zeilennummern, Testzahlen, Farbwerte,
  Migrationen, Fehlermeldungen oder Erklärungen der Umsetzung.
- Keine Tabellen mit Zwischenergebnissen, keine Aufzählung jedes Einzelschritts,
  kein Drumherumreden.
- Wichtige Entscheidungen, Risiken und offene Punkte trotzdem nennen — aber in
  einem Satz, in normaler Sprache.

Ausnahme: Wenn Jannis ausdrücklich nach Details, Code oder Ursachen fragt.

# Small design and logic changes: fast path

Small design / logic changes should not be overcomplicated. Read the relevant
files, change the code, review the diff, and rebuild on the simulator — without
testing. No typecheck runs, no domain tests, no screenshot rounds. Jannis does
not want to wait 10 minutes for a color change.

Rebuild = JS bundle only, straight into the installed simulator app (~7 s):

```bash
.claude/skills/run-goals/sim.sh bundle
```

Everything else (screenshots, logs, persisted state, GPS, tests, native build
status) lives in the `run-goals` skill: `.claude/skills/run-goals/SKILL.md`.

Full verification (typecheck, tests, simulator walkthrough) is only for real
features, data/auth/sync logic, or when Jannis asks for it.

# Lokaler Modell-Server — Betriebsanweisung

Diese Datei gilt für jedes App-Projekt in diesem Setup. Sie beschreibt einen lokalen
LLM-Server, der als Zuarbeiter zur Verfügung steht, und legt fest, wann du ihn
benutzt und wann nicht.

---

## 0. Tool-Status — getestet am 2026-07-27, alle 11 Tools

| Tool | Status | Befund |
|---|---|---|
| `ornith_ask` | ✅ funktioniert | Zuverlässig, schnelle korrekte Antworten |
| `ornith_health` | ✅ funktioniert | Guter erster Diagnose-Schritt bei Problemen |
| `ornith_task` | ⚠️ funktioniert, aber Compile-Check ist Fake außerhalb Dart | Zweimal an TS-Dateien getestet. Kleine additive Funktion: korrekt. Größerer Umbau (GlassCard → BlurView): fehlerhaft — entfernte einen noch gebrauchten Import (`ViewStyle`), meldete trotzdem `"status": "ok"` und `"Kompiliert"`. `tsc --noEmit` warf sofort `TS2304`. Das interne Gate ist `dart analyze` — für TS ein reines No-op, das JEDEN Fehler durchwinkt |
| `ornith_diff_review` | ⚠️ funktioniert, aber genauso blind für TS-Fehler | Gleicher Test: mit dem kaputten `ViewStyle`-Import im Diff trotzdem `"verdict": "ok", "issues": []`. Auch dieses Gate hängt an Dart-Tooling und prüft in TS/JS-Projekten keine echte Kompilierbarkeit |
| `ornith_translate` | ✅ funktioniert | Format-neutral (ARB = JSON), auch außerhalb Flutter nutzbar für simple key-value-JSON-Übersetzungen |
| `ornith_survey` | ❌ reproduzierbar leer | Zweimal getestet (kleine wie größere Datei) — immer `{"result":""}`. Nicht verlassen, bis behoben |
| `ast_definition` | ❌ kaputt | `ast-grep` fehlt auf dem Server-Host |
| `ast_callers` | ❌ kaputt | `ast-grep` fehlt auf dem Server-Host |
| `ast_find` | ❌ kaputt | `ast-grep` fehlt auf dem Server-Host |
| `grep_find` | ❌ kaputt | `rg` (ripgrep) fehlt auf dem Server-Host |
| `ornith_gen_tests` | ❌ nicht nutzbar hier | Hardcoded auf Flutter — sucht `pubspec.yaml`, bricht in JS/TS-Projekten sauber mit "nichts geschrieben" ab |

**Fazit:** Nur 5 von 11 Tools liefern zuverlässige Ergebnisse in diesem Projekt, und
selbst davon haben 2 einen kritischen blinden Fleck. Die drei AST-Tools + `grep_find`
sind ausschließlich durch fehlende Binaries (`ast-grep`, `rg`) auf dem Docker-Host
blockiert — vermutlich mit `apt-get install ripgrep` + `ast-grep` Binary-Install im
Container behebbar. `ornith_survey`, das laut Abschnitt 3 der wichtigste Anwendungsfall
sein soll, ist aktuell unbrauchbar. Bis das behoben ist: **nicht auf `ornith_survey`
verlassen**, stattdessen direkt lesen oder `ornith_ask` mit gezielter Frage nutzen.
`ornith_gen_tests` und `ornith_translate` sind auf Flutter zugeschnitten (ARB,
pubspec.yaml) — in diesem Projekt ist nur `ornith_translate` bedingt nutzbar (reines
JSON), `ornith_gen_tests` nicht.

**Kritisch — in diesem Projekt (kein Dart/Flutter) sind `ornith_task`'s "Kompiliert"-Meldung
und `ornith_diff_review`'s "verdict: ok" NICHT vertrauenswürdig.** Beide Gates hängen an
`dart analyze` und laufen in TS/JS-Projekten leer durch — verifiziert durch einen
reproduzierten Bug (fehlender `ViewStyle`-Import), den beide Tools als "ok" durchgewinkt
haben, während `npx tsc --noEmit` ihn sofort fand. Nach jedem `ornith_task` in diesem
Repo zwingend `npx tsc --noEmit -p .` laufen lassen — Regel 5 (Reparaturschleifen bleiben
lokal) gilt hier nicht, weil das lokale Gate den Fehler gar nicht sieht.

## 0b. Großer Nachtest — 6 Sprachen parallel (Dart, TS, JS, HTML, JSON, Swift), 2026-07-27

6 Subagenten gleichzeitig gegen den Server, je ein `ornith_task` + `ornith_survey` + `ornith_ask`
(+ `ornith_translate` beim JSON-Agent), jeweils mit unabhängiger lokaler Verifikation (tsc/dart
analyze/swiftc/node/python json). Testordner: `ornith-tests/`.

**`ornith_task` — deutlich besser als der frühere Einzeltest vermuten ließ.** In allen 6 Sprachen
korrekt für kleine, gut umrissene Einzeldatei-Edits (eine Methode/Funktion hinzufügen). Meldet jetzt
konsistent ehrlich `"Logik NICHT geprüft — bitte review"` statt zu überclaimen. **Aber:** Das interne
Gate ist und bleibt `dart analyze` — bei Swift/TS/JS/HTML/JSON prüft es strukturell nichts
Sprachspezifisches, der Erfolg beruhte hier auf Aufgaben-Einfachheit, nicht auf echter Prüfung.
Bei komplexeren Änderungen (siehe GlassCard-Vorfall oben) bricht es weiterhin. **Regel bleibt:**
immer selbst verifizieren, unabhängig von der gemeldeten Aufgaben-Komplexität.

**`ornith_survey` — der "immer leer"-Bug ist NICHT reproduzierbar** (0/6 leere Antworten diesmal,
vorher 2/2). Vermutlich intermittierend, nicht permanent kaputt. Aber: neue Qualitätsprobleme
gefunden — zählte bei HTML nur 2 von 5 vorhandenen Elementen (falsche Antwort, nicht nur leer), und
zwingt jede Antwort in ein Options/Risiko/Empfehlungs-Schema, selbst bei simplen Ja/Nein- oder
Auflistungs-Fragen (Fülltext wie "Keine Anomalien erkannt" bei einer reinen Key-Auflistung).
**Revidierte Regel:** nicht mehr grundsätzlich meiden, aber Ergebnis bei Zähl-/Vollständigkeitsfragen
nicht blind vertrauen.

**`ornith_ask` — am wenigsten verlässlich von den dreien.** Latenz extrem inkonsistent (5s bis 83s
für ähnlich einfache Fragen). Ein harter Fehlschlag (leere Antwort nach 65s Reasoning-Verbrauch).
**Schwerwiegender Fund:** halluzinierte bei einer Dart-API-Frage selbstbewusst falschen Code
(`value.clamp(0)` als "idiomatisch" empfohlen — kompiliert nicht, `clamp()` braucht 2 Argumente).
**Regel:** `ornith_ask` nie für API-/Stdlib-Fakten ohne Gegenprüfung nutzen — für allgemeine
Konzeptfragen (z.B. "was ist `mutating` in Swift") war die Qualität dagegen gut.

**`ornith_translate` — Übersetzungsqualität gut** (Deutsch/Spanisch korrekt und natürlich), aber
**ignoriert den Eingabe-Dateinamen** und schreibt immer hart `app_<lang>.arb` statt vom Quellnamen
abgeleitet — Risiko, bestehende `app_de.arb` etc. in echten Projekten stillschweigend zu
überschreiben. Vor Nutzung Zielpfad prüfen/umbenennen.

**Nebenbefund Nebenläufigkeit:** 6 parallele Agenten liefen ohne Abstürze durch, aber mit spürbar
höherer/inkonsistenterer Latenz als Einzelaufrufe — deckt sich mit der schon dokumentierten Regel
"max. 4 parallel, darüber Verhungern".

**Gesamt-Update:** Ornith ist brauchbar als schneller erster Entwurf für kleine, klar umrissene
Einzeldatei-Änderungen in JEDER Sprache (nicht nur Dart) — aber nur mit Pflicht-Gegenprüfung, nie
als vertrauenswürdiger Abschluss. Der Verifikations-Overhead frisst einen guten Teil der Zeitersparnis
wieder auf.

---

## 1. Was verfügbar ist

**Ornith 1.0 9B** (Q4_K_M, MIT-Lizenz), llama.cpp-Server auf `http://192.168.178.35:8081`
Hardware: RTX 2060 6GB, Ryzen 5 5600X, 16GB DDR4 · Ubuntu 24.04 · Docker-Container `ornith`

| Eigenschaft | Wert |
|---|---|
| Generierung | 47 tok/s, Streuung ±0,1 über 10 Läufe |
| Prefill (großer Kontext) | ~1.100 tok/s — 6.000 Token in ca. 6 Sekunden |
| Kontextfenster | **12.288 Token** — harte Grenze |
| Parallele Anfragen | 4 gleichzeitig = 1,8× Durchsatz. Darüber nichts mehr |
| Kosten | 0 € pro Token. Nur Strom, ~14 W im Leerlauf |

MCP-Werkzeuge (laufen auf dem Mac, rufen den Server über LAN):
`ornith_task`, `ornith_survey`, `ornith_ask`

---

## 2. Wie gut das Modell wirklich ist — gemessen, nicht geschätzt

**Stark:**

- **Strukturierte Ausgabe: 10/10.** JSON-Schema-Anfragen kommen zuverlässig valide zurück. Zusätzlich per GBNF-Grammatik erzwungen — syntaktisch ungültige Ausgabe ist unmöglich.
- **Kontextverständnis: 3/3.** Findet in einem 6.000-Token-Kontext Nachbarschaftsbeziehungen, zählt Klassen korrekt, liest Feldnamen aus der Mitte.
- **Dart/Flutter-Grundlagen:** korrekt und idiomatisch. Dart ist deutlich besser abgedeckt als Swift.
- **Stabil:** kein Throttling, keine Streuung, keine Ausfälle über längere Läufe.

**Schwach — und zwar auf eine gefährliche Art:**

Bei einer größeren Aufgabe (Flutter-Screen mit Drawer, Formular, Validierung, SnackBar)
lieferte es 241 Zeilen, erfüllte 9 von 10 Anforderungen — und enthielt trotzdem:

- einen **Compile-Fehler** (`GlobalKey<Form>` statt `GlobalKey<FormState>`)
- einen **Laufzeitfehler** (`Scaffold.of(context)` im eigenen Scaffold-Build)
- einen **schweren UX-Bug** (Validierung löschte bei Fehler die Nutzereingaben)
- **toten Code** (Form-Key angelegt, aber `validate()` nie aufgerufen)

Rund 8% der Zeilen waren falsch. **Muster: Die Bausteine stimmen, die Verdrahtung nicht.**
Struktur sieht professionell aus, es scheitert an den Nahtstellen.

**Die wichtigste Eigenschaft:** Es meldet Erfolg bei kaputtem Code. Es sagt nicht "ich bin
unsicher". Behandle jede Ausgabe als Entwurf eines schnellen, aber unaufmerksamen Praktikanten.

**Bekannte Fallstricke:**

- Es ist ein **Reasoning-Modell** mit separatem `reasoning_content`. Bei zu knappem
  `max_tokens` kommt eine **leere Antwort** statt eines Fehlers.
- Zählaufgaben und Ordinalfragen ("die letzten drei X") sind unzuverlässig.
- Veralteter Stil möglich (z. B. `primarySwatch` statt `ColorScheme.fromSeed`).

---

## 3. Wofür du es benutzt — verbindliche Regeln

### IMMER delegieren

**A. Kontext-Aufbereitung vor eigener Arbeit** *(der wichtigste Fall)*

Bevor du selbst mehrere Dateien liest, ruf `ornith_survey`. Du bekommst Befund,
2–3 Optionen mit Risikoeinschätzung und eine Empfehlung — etwa 150 Token statt
5.000–20.000 für die Rohdateien. **Du entscheidest, Ornith liefert die Grundlage.**

Nicht: Datei lesen, dann denken.
Sondern: `ornith_survey` → Optionen prüfen → entscheiden → gezielt handeln.

**B. Codebase-Fragen**

"Wo wird der Login-State gehalten?", "Welche Views nutzen dieses ViewModel?",
"Was passiert bei fehlgeschlagenem Request?" — immer `ornith_survey` oder `ornith_ask`.
Nie selbst durch Dateien suchen. Hier ist das Modell nachweislich zuverlässig.

**C. Lokalisierung**

Strings in weitere Sprachen übersetzen, ARB-Dateien befüllen, Konsistenz prüfen.
Reine Fleißarbeit im Volumen. Immer lokal, im Batch, nie selbst.

**D. Tests im Volumen erzeugen**

Für jede Funktion Testfälle generieren lassen, dann **ausführen und nur die
behalten, die durchlaufen**. Der Testlauf filtert, nicht das Modell. Große Mengen,
niedrige Anforderungen an Einzelqualität — idealer Fall.

**E. AI-Features prototypen**

Wenn das Projekt ein Feature braucht, das ein Sprachmodell aufruft: erst gegen
`192.168.178.35:8081` bauen. Keine API-Kosten pro Nutzer beim Experimentieren.
Erst wenn das Feature steht, entscheiden, ob Produktion lokal oder Cloud läuft.

### NUR mit Gate delegieren

`ornith_task` für **eine Datei, ein präzise beschriebener Schritt**. Das Werkzeug
prüft automatisch mit `dart analyze`, bessert bis zu 3× selbst nach und setzt die
Datei bei endgültigem Fehlschlag zurück.

Formuliere die Aufgabe so eng, dass es nichts zu interpretieren gibt:

- Gut: *"Ergänze in `_emailValidator` eine Prüfung auf leeren String, gib 'Pflichtfeld' zurück"*
- Schlecht: *"Verbessere die Formularvalidierung"*

**Ein `status: ok` bedeutet nur: es kompiliert.** Es bedeutet nicht, dass die Aufgabe
erfüllt wurde. Lies immer das `summary`-Feld und prüf, ob es zur Anweisung passt.

### NIEMALS delegieren

- Architektur- und Designentscheidungen
- Änderungen über mehrere Dateien hinweg
- Alles Sicherheitsrelevante — Auth, Keys, Berechtigungen, Zahlungen
- State-Management-Umbauten
- Refactorings ohne Testabdeckung
- Alles, wo ein Fehler schwer rückgängig zu machen ist
- Beurteilung deiner eigenen Arbeit — ein 9B kann das nicht

---

## 4. Kontext und Tokens sparen

**Regel 1 — Ornith liest, du entscheidest.**
Jede Datei, die du selbst öffnest und die Ornith hätte zusammenfassen können, ist
verschwendetes Budget. Der Unterschied ist Faktor 30 bis 100.

**Regel 2 — Entscheidungen weiterreichen, keine Daten.**
Fordere von `ornith_survey` immer Optionen mit Risiko und Empfehlung an, nie
Rohinhalte. Ein strukturiertes Kontextobjekt hat 150–500 Token, die Datei 5.000+.

**Regel 3 — Ergebnisse verdichten, nicht durchreichen.**
Nach einem `ornith_task` nie den erzeugten Code in deinen Kontext holen. Das
`summary` reicht. Willst du prüfen, lies gezielt die geänderten Zeilen.

**Regel 4 — Kontexte klein halten.**
12K ist die Obergrenze des Servers. Eine Aufgabe, die mehr braucht, ist zu groß
geschnitten — teile sie.

**Regel 5 — Reparaturschleifen bleiben lokal.**
Compilerfehler gehen zurück an Ornith, nicht an dich. Erst nach drei Fehlversuchen
übernimmst du — dann ist das Problem konzeptionell, nicht syntaktisch.

**Regel 6 — bis zu 4 Aufgaben parallel.**
Mehrere unabhängige `ornith_*`-Aufrufe gleichzeitig bringen 1,8× Durchsatz.
Ab 5 verhungern sie sich gegenseitig.

---

## 5. Standardablauf

```
Nutzer beschreibt einen Wunsch
   ↓
ornith_survey  → Befund, Optionen, Empfehlung        (~150 Token)
   ↓
DU entscheidest, welche Option                        (deine Kernaufgabe)
   ↓
klein genug + eine Datei?
   ├─ ja   → ornith_task, danach summary prüfen
   └─ nein → selbst umsetzen, oder in Einzelschritte zerlegen
   ↓
dart analyze / flutter test
   ↓
Ergebnis knapp berichten, nicht den Code wiederholen
```

---

## 6. Wenn der Server nicht erreichbar ist

Nicht raten, nicht schweigend selbst weitermachen — sag es kurz an und arbeite
normal weiter. Der Server ist eine Optimierung, keine Voraussetzung.

Diagnose auf dem Server: `sudo docker ps --filter name=ornith`,
Neustart: `sudo docker restart ornith`
