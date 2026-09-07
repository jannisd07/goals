# Neumorphism design specification — current product overrides

`CLAUDE.md`, section **VERBINDLICHES DESIGN-SYSTEM**, is the complete and
authoritative specification. This short file only preserves the final direction;
it must never be used to reintroduce an earlier experiment.

## Canonical tokens

- Page: `#E0E5EC`
- Cards: `#E9EDF2` (intentionally lighter than the page)
- Accent: `#415DCB` (accessible darkening of the original indigo)
- Text: `#171A1F` primary, `#3B4351` secondary
- Raised shadows: `-8/-8`, `+8/+8`, blur `12`, light `#FFFFFF`, dark `#A3B1C6`
- Normal cards: radius `20`
- Minimum hit target: `44×44`
- Font: Outfit 500 body, 600 labels, 700 headings

## Final component rules

- Cards use `NeumorphicSurface`, dual raised shadows, no outline.
- Ordinary buttons are **not neumorphic**: solid accent or dark flat fill,
  no gradient, glow, or shadow.
- Home Start/Resume are compact solid-accent pills.
- The round Friends/Stats/Settings header tools are the only confirmed
  neumorphic button exception.
- Text inputs are flat `MinimalTextInput` fields with a neutral 1pt border and
  2pt accent focus/error border. They never use inset shadows.
- Progress bars are flat accent fills on neutral tracks.
- Mechanical wells are limited to the Pomodoro dial, slider grooves and toggle
  tracks.
- The page is monochrome: no glass, blur, transparency, blobs, gradients,
  photos, emojis or multiple interface accents.

## Accessibility

- Use readable primary/secondary tokens; body text should target 7:1 and never
  fall below 4.5:1.
- Every control needs a visible non-shadow cue and semantic accessibility state.
- Interactive targets are at least 44×44.
- Inputs expose labels, validation text and a visible focus border.

If this summary and `CLAUDE.md` ever differ, follow `CLAUDE.md` and the canonical
runtime components under `src/theme/` and `src/components/`.
