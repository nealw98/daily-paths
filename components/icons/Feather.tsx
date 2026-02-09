import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Feather({ size = 24, color = "#2C5F5D", strokeWidth = 1.6 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M26 4c-8 2-12 8-14 16l-4 8 8-4c8-2 14-6 16-14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M12 20L26 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
