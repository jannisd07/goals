# Island stages (pixel art)

The three base islands, small to big, as delivered by Jannis (ChatGPT, 2:1 pixel iso).
Stray pixels outside the island removed and trimmed to the island plus 6 px.
Not snapped to an exact pixel grid yet (island/WACHSTUM.md §15.4), no zone mask yet (§15.3).

| File | Stage | Ocean | Source (ChatGPT export) | Status |
|---|---|---|---|---|
| `island-1-small.png` | I (small) | `assets/home/ocean-pixel-1.png` (B1, closest) | `07_12_31 PM (1)` | Home, on the shallows in `assets/home/shallows-ocean-1.png` (stage 1 approved 2026-09-10) |
| `island-2-medium.png` | II (medium) | `assets/home/ocean-pixel-2.png` (B2, middle) | `07_12_22 PM (2)` | Home stage 2 (first try), on `assets/home/shallows-ocean-2.png` |
| `island-3-large.png` | III (large) | `assets/home/ocean-pixel-3.png` (B3, farthest) | `07_12_22 PM (3)` | not used |

Removed from the app on 2026-09-10: Home now uses a background with the island painted in
(`assets/home/island-ocean-1.png`). The former stage table is kept outside the repo.
Re-added the same day: the small island is drawn on top again laid exactly over the island painted
into the background (+6.4 % vertical stretch, +1.5 % size; rect in `src/screens/HomeScreen.tsx`).
