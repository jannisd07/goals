/**
 * App theme. Only Home has a background image (it paints its own island art);
 * every other screen sits on the warm paper page from `theme/paper.ts`. Cards are
 * plain white, the single accent is the island green.
 */
export const NEU = {
  /** Paper page. Opaque on purpose: there is no shared backdrop any more. */
  bg: "#F5F5F2",
  bgSolid: "#F5F5F2",
  pageSolid: "#F5F5F2",
  card: "#FFFFFF",
  bgDark: "#2A2D32",
  accent: "#2E9E4F",
  accentRgb: "46, 158, 79",
  light: "#FFFFFF",
  dark: "#A3B1C6",
  lightDarkMode: "#34383E",
  darkDarkMode: "#1C1E21",
  textPrimary: "#0F1B2D",
  textSecondary: "#6B7280",
  track: "#DDE3EA",
  /** Text that sits directly on the backdrop image. */
  onImage: "#FFFFFF",
  onImageSoft: "rgba(255,255,255,0.92)",
  radiusSmall: 12,
  radius: 16,
  radiusLarge: 24,
  hitTarget: 44,
  raisedDistance: 8,
  raisedBlur: 12,
  insetDistance: 6,
  insetBlur: 12,
} as const;

export const NEU_FONTS = {
  body: "Outfit_500Medium",
  label: "Outfit_600SemiBold",
  heading: "Outfit_700Bold",
} as const;
