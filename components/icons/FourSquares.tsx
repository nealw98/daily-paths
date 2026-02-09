import Svg, { Rect } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function FourSquares({ size = 24, color = "#2C5F5D", strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Top-left */}
      <Rect
        x={5} y={5} width={9} height={9} rx={2.5}
        stroke={color} strokeWidth={strokeWidth} fill="none"
      />
      {/* Top-right */}
      <Rect
        x={18} y={5} width={9} height={9} rx={2.5}
        stroke={color} strokeWidth={strokeWidth} fill="none"
      />
      {/* Bottom-left */}
      <Rect
        x={5} y={18} width={9} height={9} rx={2.5}
        stroke={color} strokeWidth={strokeWidth} fill="none"
      />
      {/* Bottom-right */}
      <Rect
        x={18} y={18} width={9} height={9} rx={2.5}
        stroke={color} strokeWidth={strokeWidth} fill="none"
      />
    </Svg>
  );
}
