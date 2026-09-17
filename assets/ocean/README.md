# Ocean backgrounds (pixel art)

One background per island size. The closer the camera, the bigger the waves;
larger islands get farther-out versions (island/WACHSTUM.md §5 and §15).
Originals exactly as delivered by Jannis (ChatGPT), not yet snapped to a pixel grid.

| File | Version | Island size | Source (ChatGPT export) | Status |
|---|---|---|---|---|
| `stage-1-closest.png` | most zoomed in | smallest island | `07_53_34 PM` | live on Home via `assets/home/ocean-pixel-1.png` (nearest-neighbour upscale to 1320 × 2640), horizon at 25 % |
| `stage-1-closest-v2.png` | most zoomed in, second version | smallest island | `07_44_57 PM` | replaced 2026-09-10, not used (horizon at 13 %, behind the header) |
| `stage-1-closest-v1.png` | most zoomed in, first version | smallest island | `07_08_33 PM` | replaced 2026-09-10, not used (horizon at 34 %) |
| `stage-2-middle-island.png` | middle | middle island size | `07_11_11 PM` | Home preview with the medium island via `assets/home/ocean-pixel-2.png` (nearest-neighbour upscale to 1320 px wide) |
| `stage-3-farthest.png` | most zoomed out | largest island | `07_14_19 PM` | Home preview with the large island via `assets/home/ocean-pixel-3.png` (nearest-neighbour upscale to 1320 px wide) |

Mapping verified against the images Jannis attached in chat (thumbnail diff ≈ 0.3).
Wave size shrinks from stage 1 to stage 3.

## Home background with the island painted in

`stage-1-with-island.png` (`08_11_37 PM`, 887 × 1774) is the current Home background via `assets/home/island-ocean-1.png` (nearest-neighbour upscale to 1320 × 2640). The app asset is shifted 30 px (≈ 10 pt) up with the bottom 30 px mirrored, so no gap opens at the bottom. The small island sprite is drawn on top of it again. The ocean-only files above are not used in the app right now.

## Home background with shallows, no island painted in (current, stage 1 approved 2026-09-10)

`stage-1-shallows.png` (Codex export `11_20_09 PM`, 846 × 1860) is the current Home background via
`assets/home/shallows-ocean-1.png` (nearest-neighbour upscale to 1320 px wide). It has a bright shallow-water
patch but no island; the small island sprite is drawn centred on that patch (rect in `src/screens/HomeScreen.tsx`).
`stage-1-with-island.png` / `assets/home/island-ocean-1.png` are no longer used.

## Stage 2 background with shallows (first try, 2026-09-11)

`stage-2-shallows.png` (ChatGPT `11_59_04 PM`, 887 × 1774) → `assets/home/shallows-ocean-2.png`
(nearest-neighbour upscale to 1320 × 2640). Used by stage 2 in `src/lib/homeIslandStages.ts`.
