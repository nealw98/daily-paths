import Svg, { Path, Circle } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Nautilus({ size = 24, color = "#2C5F5D", strokeWidth = 1.4 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Spiral shell */}
      <Path
        d="M15 15.5a1.5 1.5 0 0 1 1.5 1.5 3 3 0 0 1-3 3 5 5 0 0 1-5-5 7.5 7.5 0 0 1 7.5-7.5 10.5 10.5 0 0 1 10.5 10.5c0 7-5.5 10-10.5 10"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center dot */}
      <Circle
        cx={15}
        cy={15.5}
        r={0.6}
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
