import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function SoftExhale({ size = 24, color = "#B8604A", strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M6 16c4-6 8-6 10-3s6 3 10-3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M6 22c3-4 6-4 8-2s5 2 8-2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.55}
      />
      <Path
        d="M8 27c2-3 4-3 6-1.5s4 1.5 6-1.5"
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
