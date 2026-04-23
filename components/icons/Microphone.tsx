import Svg, { Path, Rect, Line } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Microphone({ size = 24, color = "#2C5F5D", strokeWidth = 1.6 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Microphone body (rounded rectangle) */}
      <Rect
        x="11"
        y="4"
        width="10"
        height="16"
        rx="5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Base arc */}
      <Path
        d="M8 16c0 4.418 3.582 8 8 8s8-3.582 8-8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Stand */}
      <Line
        x1="16"
        y1="24"
        x2="16"
        y2="28"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Base */}
      <Line
        x1="12"
        y1="28"
        x2="20"
        y2="28"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
