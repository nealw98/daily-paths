import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function MoonOnWater({ size = 24, color = "#5B6E8A", strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M14 5a5.5 5.5 0 0 0 8.5 6.5 7 7 0 1 1-8.5-6.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M8 25c3-1.5 5.5 0 8.5-1s5-1.5 7.5 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.5}
      />
      <Path
        d="M6 28.5c4-1.5 6 0 10-1s6-1.5 10 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.3}
      />
    </Svg>
  );
}
