import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function HomeIcon({ size = 24, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GardenIcon({ size = 24, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={strokeWidth} opacity={0.35} />
      <Path
        d="M12 2V4M12 20V22M2 12H4M20 12H22"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function AnalyticsIcon({ size = 24, color = "#000000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="13" width="4" height="8" rx="1.25" fill={color} />
      <Rect x="10" y="8" width="4" height="13" rx="1.25" fill={color} />
      <Rect x="17" y="3" width="4" height="18" rx="1.25" fill={color} />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color = "#000000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65c.2-.15.25-.43.12-.65l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.5 7.5 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.61.25-1.18.58-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.65l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.65l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.51.4 1.08.73 1.69.98l.38 2.65A.5.5 0 0 0 10 22h4a.5.5 0 0 0 .49-.42l.38-2.65c.61-.25 1.18-.58 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.65l-2.11-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export function TimerIcon({ size = 16, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 9V13L15 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M9 2H15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function LocationIcon({ size = 16, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function PlusIcon({ size = 20, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12H19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 20, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 20, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = "#000000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 24, color = "#000000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="5" width="4" height="14" rx="1.5" fill={color} />
      <Rect x="14" y="5" width="4" height="14" rx="1.5" fill={color} />
    </Svg>
  );
}

export function StopIcon({ size = 24, color = "#000000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="6" width="12" height="12" rx="2" fill={color} />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function RefreshIcon({ size = 20, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 4V10H7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.51 15A9 9 0 1 0 5.64 5.64L1 10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FriendsIcon({ size = 20, color = "#000000" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.4" fill={color} />
      <Path
        d="M3 19.2C3 15.9 5.7 13.6 9 13.6C12.3 13.6 15 15.9 15 19.2C15 19.64 14.64 20 14.2 20H3.8C3.36 20 3 19.64 3 19.2Z"
        fill={color}
      />
      <Circle cx="16.5" cy="9" r="2.7" fill={color} opacity={0.55} />
      <Path
        d="M16.1 13.3C18.85 13.5 21 15.5 21 18.3C21 18.69 20.69 19 20.3 19H16.6C16.85 18.44 17 17.83 17 17.2C17 15.7 16.66 14.37 16.1 13.3Z"
        fill={color}
        opacity={0.55}
      />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = "#000000", strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21A2 2 0 0 1 10.27 21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
