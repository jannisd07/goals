/**
 * Paper theme — the light mode used by Stats, Friends and Settings.
 *
 * These three screens are reading and configuration surfaces, not part of the
 * island fiction, so they drop the ocean backdrop entirely and sit on an opaque
 * page instead.
 *
 * Three decisions carry the look:
 *
 * 1. The page is a warm off-white, not the usual cold blue-grey. A hint of
 *    yellow in the neutrals reads as paper rather than as a default UI kit.
 * 2. Cards are separated by a hairline, not by a drop shadow. Rows of floating
 *    shadowed panels are what makes a screen look generated; a single flat
 *    plane with quiet divisions reads as something a person laid out.
 * 3. Green appears only where it carries meaning — a filled bar, a chosen
 *    option, the primary action. Everything else is neutral.
 *
 * `accent` (#2E9E4F) is the island green from the home screen and is used for
 * fills, rings and bars. It only reaches 3.4:1 on white, so green *text* uses
 * `accentInk` (#1F7A3C, 5.4:1) instead. Fill and label are deliberately two
 * different greens.
 */
export const PAPER = {
  /** Page behind everything. Opaque, so the shared ocean backdrop never shows. */
  page: "#F5F5F2",
  /** Card and row surface. */
  surface: "#FFFFFF",
  /** Recessed areas: progress tracks, calendar cells, inactive wells. */
  sunken: "#ECECE7",
  /** Hairline between and around surfaces. */
  line: "#E5E4DF",
  /** Slightly stronger hairline for the few places that need to separate. */
  lineStrong: "#D5D4CD",

  /** Headings, values, anything that must be read first. */
  ink: "#191A17",
  /** Body copy and metadata. 5.4:1 on white. */
  inkMuted: "#6B6B64",
  /** Captions and disabled states. Never used for anything load-bearing. */
  inkFaint: "#9A9A92",

  /** Bars, rings, filled controls. Matches the island green on Home. */
  accent: "#2E9E4F",
  /** Green for text on white, where the fill green is too light. */
  accentInk: "#1F7A3C",
  /** Tinted background for a selected row. */
  accentWash: "#EBF4ED",

  /** Destructive labels. Muted brick, not a pure red. */
  danger: "#A93B2C",

  /**
   * Labels and small controls that lie **on the island** rather than on paper.
   *
   * The island is sky, water and grass by turns, so nothing on it can rely on a
   * fixed background. A dark, see-through scrim with white on it stays readable
   * over all three, and lets the picture through — a solid card there would hide
   * the thing it is talking about. This is not glass: no blur, no light edge, no
   * white tint (CLAUDE.md §2).
   */
  onIslandScrim: "rgba(16,24,32,0.42)",
  /** The deeper one, for a dialog that has to take the island's place. */
  onIslandVeil: "rgba(16,20,24,0.45)",
  /** Text and hairlines on that scrim. */
  onIslandInk: "#FFFFFF",
  onIslandTrack: "rgba(255,255,255,0.28)",
  /**
   * The open sea, as it is painted around the island in every stage picture.
   * Used where a screen waits for an island to arrive: the wait is then the
   * same picture minus the island, not a different screen.
   */
  openSea: "#329AB9",

  radiusSm: 8,
  radius: 12,
  radiusLg: 16,
  hitTarget: 44,

  /** Standard page inset. */
  gutter: 20,
} as const;
