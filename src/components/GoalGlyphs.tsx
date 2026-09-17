/**
 * One glyph per setup category, so a goal shows what the user actually picked
 * instead of a generic placeholder. Falls back to a sensible default per goal
 * type when a category is missing or unknown.
 */

import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

interface GlyphProps {
  size?: number;
  color?: string;
}

const DEFAULT_SIZE = 27;

function Laptop({ size = DEFAULT_SIZE, color = "#0E3A1E" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.6 4.6h14.8c.9 0 1.6.7 1.6 1.6v8.5H3V6.2c0-.9.7-1.6 1.6-1.6Z" fill={color} />
      <Rect x="5.1" y="6.5" width="13.8" height="6.4" rx="0.8" fill="#FFFFFF" />
      <Path
        d="M1.6 16.4h20.8c.4 0 .7.4.6.8l-.3 1.1c-.2.7-.8 1.1-1.5 1.1H2.8c-.7 0-1.3-.4-1.5-1.1l-.3-1.1c-.1-.4.2-.8.6-.8Z"
        fill={color}
      />
    </Svg>
  );
}

function GradCap({ size = DEFAULT_SIZE, color = "#0E3A1E" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.4 23 8.6l-11 5.2L1 8.6l11-5.2Z" fill={color} />
      <Path
        d="M5.6 11.2v4.6c0 1.9 2.9 3.4 6.4 3.4s6.4-1.5 6.4-3.4v-4.6L12 14.4l-6.4-3.2Z"
        fill={color}
        opacity={0.75}
      />
      <Rect x="20.4" y="9" width="1.5" height="6.4" rx="0.75" fill={color} />
    </Svg>
  );
}

function OpenBook({ size = DEFAULT_SIZE, color = "#0E3A1E" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M11.2 6.4C9.4 5 6.9 4.4 3.4 4.4c-.8 0-1.4.6-1.4 1.4v11c0 .8.6 1.4 1.4 1.4 3 0 5.3.5 6.9 1.6.5.4 1.2 0 1.2-.6V6.9c0-.2-.1-.4-.3-.5Z" fill={color} />
      <Path d="M12.8 6.4c1.8-1.4 4.3-2 7.8-2 .8 0 1.4.6 1.4 1.4v11c0 .8-.6 1.4-1.4 1.4-3 0-5.3.5-6.9 1.6-.5.4-1.2 0-1.2-.6V6.9c0-.2.1-.4.3-.5Z" fill={color} opacity={0.72} />
    </Svg>
  );
}

function Pen({ size = DEFAULT_SIZE, color = "#0E3A1E" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15.6 3.6 20.4 8.4 9.6 19.2l-6 1.2 1.2-6L15.6 3.6Z" fill={color} />
      <Path d="M4.8 14.4 9.6 19.2l-6 1.2 1.2-6Z" fill="#FFFFFF" opacity={0.35} />
    </Svg>
  );
}

function CodeBrackets({ size = DEFAULT_SIZE, color = "#0E3A1E" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8.4 6.2 3 12l5.4 5.8M15.6 6.2 21 12l-5.4 5.8"
        stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <Path d="M13.4 4.4 10.6 19.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function Lotus({ size = DEFAULT_SIZE, color = "#0E3A1E" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="5.8" r="2.6" fill={color} />
      <Path d="M12 9.4c3.4 0 6.2 2.2 6.2 4.4 0 .7-.6 1.2-1.3 1.2H7.1c-.7 0-1.3-.5-1.3-1.2 0-2.2 2.8-4.4 6.2-4.4Z" fill={color} />
      <Path d="M3.4 17.6c2.4 1.8 5.4 2.6 8.6 2.6s6.2-.8 8.6-2.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Dumbbell({ size = DEFAULT_SIZE, color = "#111827" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="0.8" y="8.4" width="3.4" height="7.2" rx="1.5" fill={color} />
      <Rect x="19.8" y="8.4" width="3.4" height="7.2" rx="1.5" fill={color} />
      <Rect x="4.4" y="5.6" width="4.4" height="12.8" rx="2" fill={color} />
      <Rect x="15.2" y="5.6" width="4.4" height="12.8" rx="2" fill={color} />
      <Rect x="8.4" y="10.1" width="7.2" height="3.8" rx="0.6" fill={color} />
    </Svg>
  );
}

function DeskLamp({ size = DEFAULT_SIZE, color = "#111827" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.6 3.2h6.2c.5 0 .9.3 1 .8l1.6 5.2c.2.6-.3 1.2-1 1.2h-8.2c-.7 0-1.2-.6-1-1.2l1.4-5.2c.1-.5.5-.8 1-.8Z" fill={color} />
      <Path d="M12.6 10.4v7.2" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Rect x="7.4" y="18.2" width="10.4" height="2.6" rx="1.3" fill={color} />
    </Svg>
  );
}

function Books({ size = DEFAULT_SIZE, color = "#111827" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="4.4" width="3.8" height="15.2" rx="1.1" fill={color} />
      <Rect x="8" y="6.6" width="3.8" height="13" rx="1.1" fill={color} opacity={0.72} />
      <Rect x="13" y="4.4" width="3.8" height="15.2" rx="1.1" fill={color} />
      <Path d="M18.2 7.4 21.6 8.2l-2.6 11.2-3.4-.8L18.2 7.4Z" fill={color} opacity={0.55} />
    </Svg>
  );
}

function Office({ size = DEFAULT_SIZE, color = "#111827" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.4" y="3.4" width="10.2" height="17.2" rx="1.4" fill={color} />
      <Rect x="14.6" y="9" width="6" height="11.6" rx="1.2" fill={color} opacity={0.7} />
      <Rect x="5.8" y="6" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
      <Rect x="9.2" y="6" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
      <Rect x="5.8" y="10" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
      <Rect x="9.2" y="10" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
      <Rect x="5.8" y="14" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
      <Rect x="16.4" y="12" width="2.2" height="2.2" rx="0.5" fill="#FFFFFF" />
    </Svg>
  );
}

function YogaMat({ size = DEFAULT_SIZE, color = "#111827" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="5" r="2.4" fill={color} />
      <Path d="M12 8.4c1 0 1.8.7 2 1.7l.7 3.5h-5.4l.7-3.5c.2-1 1-1.7 2-1.7Z" fill={color} />
      <Rect x="2.6" y="15.4" width="18.8" height="4.6" rx="2.3" fill={color} opacity={0.7} />
      <Circle cx="6.2" cy="17.7" r="1.4" fill="#FFFFFF" />
    </Svg>
  );
}

function Waves({ size = DEFAULT_SIZE, color = "#111827" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="16.4" cy="6" r="2.3" fill={color} />
      <Path d="M2.6 12.4c2-1.6 3.9-1.6 5.8 0l4.2-3.6 3.4 2.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M2.4 16.6c1.9-1.7 3.8-1.7 5.7 0s3.8 1.7 5.7 0 3.8-1.7 5.7 0" stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <Path d="M2.4 20.2c1.9-1.7 3.8-1.7 5.7 0s3.8 1.7 5.7 0 3.8-1.7 5.7 0" stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.5} />
    </Svg>
  );
}

const FOCUS_GLYPHS: Record<string, (p: GlyphProps) => React.JSX.Element> = {
  studying: GradCap,
  working: Laptop,
  reading: OpenBook,
  writing: Pen,
  coding: CodeBrackets,
  meditating: Lotus,
};

const CHECKIN_GLYPHS: Record<string, (p: GlyphProps) => React.JSX.Element> = {
  study_spot: DeskLamp,
  gym: Dumbbell,
  library: Books,
  office: Office,
  pilates: YogaMat,
  pool: Waves,
};

/** Picks the glyph for a goal's category, with a per-type fallback. */
export function GoalGlyph({
  category,
  type,
  size = DEFAULT_SIZE,
}: {
  category?: string | null;
  type: "focus" | "physical";
  size?: number;
}) {
  const table = type === "focus" ? FOCUS_GLYPHS : CHECKIN_GLYPHS;
  const Fallback = type === "focus" ? Laptop : Dumbbell;
  const Glyph = (category && table[category]) || Fallback;
  return <Glyph size={size} color={type === "focus" ? "#0E3A1E" : "#111827"} />;
}
