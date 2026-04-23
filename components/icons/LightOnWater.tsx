import Svg, { Circle, Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function LightOnWater({ size = 24, color = "#2C5F5D", strokeWidth = 1.6 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={14} r={4} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M16 7V5" stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.6} />
      <Path d="M21.5 9l1.5-1.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" opacity={0.45} />
      <Path d="M10.5 9l-1.5-1.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" opacity={0.45} />
      <Path d="M23 14h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" opacity={0.35} />
      <Path d="M7 14h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" opacity={0.35} />
      <Path d="M3 20c4-1.5 7 0 13-1s9-1.5 13 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M4 24c4-1 7 0 12-1s8-1 12 0" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.4} />
      <Path d="M6 27.5c3-.8 5 0 10-.8s7-.8 10 0" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.2} />
    </Svg>
  );
}
