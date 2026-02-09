import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function LeafOnWater({ size = 24, color = "#2C5F5D", strokeWidth = 1.6 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M12 10c4-3 10-3 13 0-3 4-8 6-13 4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M12 10c4 1 7 1 10 0"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.5}
      />
      <Path
        d="M12 10c-1 2-2 4-2 6"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M6 20c3-1.5 6 0 10-1s7-1.5 10 0"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M4 24c4-1.5 7 0 12-1s8-1.5 12 0"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.5}
      />
      <Path
        d="M6 28c3-1 5 0 10-1s7-1 10 0"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.25}
      />
    </Svg>
  );
}
