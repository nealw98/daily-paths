import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Book({ size = 24, color = "#2D4C47", strokeWidth = 1.7 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M4 7c4.5-1.1 8.5-.3 12 2.2V26c-3.5-2.5-7.5-3.3-12-2.2V7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M28 7c-4.5-1.1-8.5-.3-12 2.2V26c3.5-2.5 7.5-3.3 12-2.2V7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
