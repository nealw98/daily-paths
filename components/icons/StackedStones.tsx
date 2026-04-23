import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function StackedStones({ size = 24, color = "#2C5F5D", strokeWidth = 1.6 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d="M16 4 a2 2 0 1 1 0 4 a2 2 0 1 1 0-4" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M11.5 9 a4.5 2.5 0 1 1 9 0 a4.5 2.5 0 1 1-9 0" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M9.5 15 a6.5 3 0 1 1 13 0 a6.5 3 0 1 1-13 0" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M7 21.5 a9 3.5 0 1 1 18 0 a9 3.5 0 1 1-18 0" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}
