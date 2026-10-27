// A one-shot confetti burst for big moments. Remount (new key) to fire again.
// Skipped entirely when the system's Reduce Motion setting is on.

import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = ['#0B7A55', '#3CC48E', '#8FE3BF', '#FFC94A', '#FF8A3D', '#FF8FA3', '#5B8DEF'];

function Piece({ x, drift, delay, color, spin, width, height, fall }: { x: number; drift: number; delay: number; color: string; spin: number; width: number; height: number; fall: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1700 + delay, easing: Easing.out(Easing.quad) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: x + drift * t.value },
      { translateY: -20 + fall * t.value - 120 * Math.sin(Math.PI * Math.min(1, t.value * 1.4)) * (t.value < 0.35 ? 1 : 0.6) },
      { rotate: `${spin * t.value}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, height, borderRadius: 2, backgroundColor: color }, style]} />;
}

export function Confetti({ count = 36 }: { count?: number }) {
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => {
    // Stable pseudo-random numbers from the piece index and a salt.
    const rand = (i: number, salt: number) => {
      const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      x: width * (0.15 + rand(i, 1) * 0.7),
      drift: (rand(i, 2) - 0.5) * width * 0.5,
      delay: Math.floor(rand(i, 3) * 250),
      color: COLORS[i % COLORS.length],
      spin: (rand(i, 4) - 0.5) * 900,
      width: 6 + rand(i, 5) * 5,
      height: 9 + rand(i, 6) * 7,
      fall: height * (0.45 + rand(i, 7) * 0.35),
    }));
  }, [count, width, height]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map(({ key, ...p }) => (
        <Piece key={key} {...p} />
      ))}
    </View>
  );
}
