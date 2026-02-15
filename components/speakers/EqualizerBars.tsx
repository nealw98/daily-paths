import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

interface EqualizerBarsProps {
  isPlaying: boolean;
  color: string;
  barCount?: number;
  height?: number;
}

/**
 * Animated equalizer bars that bounce when audio is playing.
 * Bars animate at staggered speeds for an organic feel.
 */
export const EqualizerBars: React.FC<EqualizerBarsProps> = ({
  isPlaying,
  color,
  barCount = 4,
  height = 20,
}) => {
  const animations = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(4))
  ).current;

  const animationRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isPlaying) {
      // Start bouncing animations with staggered timing
      const durations = [400, 550, 450, 600, 500];
      const targets = [height * 0.9, height * 0.6, height, height * 0.7, height * 0.8];

      animationRefs.current = animations.map((anim, i) => {
        const duration = durations[i % durations.length];
        const target = targets[i % targets.length];

        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: target,
              duration,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4,
              duration: duration * 0.8,
              useNativeDriver: false,
            }),
          ])
        );
      });

      animationRefs.current.forEach((a) => a.start());
    } else {
      // Stop animations and settle to resting height
      animationRefs.current.forEach((a) => a.stop());
      animations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 4,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      animationRefs.current.forEach((a) => a.stop());
    };
  }, [isPlaying, animations, height]);

  return (
    <View style={[styles.container, { height }]}>
      {animations.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: anim,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
