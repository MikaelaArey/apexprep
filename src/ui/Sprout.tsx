// Sprout, the study buddy: a small green seedling drawn from plain views and
// animated with Reanimated. It floats, blinks and sways its leaves; it bounces
// when it has something to say; and it grows accessories as you level up
// (Seedling → Sprout → Bloom → Scholar → Sage).

import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Mood } from '@/engine/coach';
import { Icon } from './Icon';

const BODY = '#38BF89';
const BODY_DARK = '#2BA374';
const BELLY = '#8FE3BF';
const LEAF_DARK = '#1F8A5F';
const LEAF = '#46C98F';
const INK = '#13261E';
const CHEEK = '#FF8FA3';
const GOLD = '#FFC94A';

const box = (x: number, y: number, w: number, h: number, extra: ViewStyle = {}): ViewStyle => ({
  position: 'absolute',
  left: x,
  top: y,
  width: w,
  height: h,
  ...extra,
});

function Eye({ x, mood }: { x: number; mood: Mood }) {
  if (mood === 'sleep') return <View style={box(x + 1, 52, 14, 3, { borderRadius: 2, backgroundColor: INK })} />;
  if (mood === 'cheer') {
    // Happy closed eyes: little upturned arcs.
    return (
      <View
        style={box(x, 47, 16, 9, {
          borderTopWidth: 3.5,
          borderLeftWidth: 3.5,
          borderRightWidth: 3.5,
          borderColor: INK,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
        })}
      />
    );
  }
  const look = mood === 'think' ? { dx: 1.5, dy: 2 } : { dx: 4, dy: 6 };
  return (
    <View style={box(x, 42, 16, 19, { borderRadius: 9, backgroundColor: '#FFFFFF' })}>
      <View style={box(look.dx, look.dy, 9, 10, { borderRadius: 5, backgroundColor: INK })}>
        <View style={box(1.5, 1.5, 3.5, 3.5, { borderRadius: 2, backgroundColor: '#FFFFFF' })} />
      </View>
    </View>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'cheer':
      return (
        <View
          style={box(42, 64, 16, 12, {
            backgroundColor: INK,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            borderBottomLeftRadius: 9,
            borderBottomRightRadius: 9,
            overflow: 'hidden',
          })}>
          <View style={box(3, 7, 10, 6, { borderRadius: 4, backgroundColor: CHEEK })} />
        </View>
      );
    case 'think':
      return <View style={box(47, 67, 6, 6, { borderRadius: 3, backgroundColor: INK })} />;
    case 'sleep':
      return <View style={box(45, 69, 10, 3, { borderRadius: 2, backgroundColor: INK })} />;
    default:
      return (
        <View
          style={box(mood === 'encourage' ? 44 : 43, 65, mood === 'encourage' ? 12 : 14, mood === 'encourage' ? 6 : 8, {
            borderWidth: 3,
            borderTopWidth: 0,
            borderColor: INK,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          })}
        />
      );
  }
}

function Flower({ x, y }: { x: number; y: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <View style={box(x, y, 18, 18)}>
      {petals.map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <View key={deg} style={box(5 + Math.cos(r) * 5.5, 5 + Math.sin(r) * 5.5, 8, 8, { borderRadius: 4, backgroundColor: '#FFB4C4' })} />;
      })}
      <View style={box(5.5, 5.5, 7, 7, { borderRadius: 4, backgroundColor: GOLD })} />
    </View>
  );
}

function Cap() {
  return (
    <View style={box(26, 4, 48, 30)}>
      <View style={box(11, 13, 26, 12, { borderRadius: 3, backgroundColor: '#1D2B26' })} />
      <View style={box(7, 0, 34, 34, { backgroundColor: '#24352E', transform: [{ scaleY: 0.38 }, { rotate: '45deg' }] })} />
      <View style={box(23, 12, 3, 3, { borderRadius: 2, backgroundColor: GOLD })} />
      <View style={box(38, 13, 2, 13, { backgroundColor: GOLD })} />
      <View style={box(36, 25, 6, 6, { borderRadius: 3, backgroundColor: GOLD })} />
    </View>
  );
}

const MOOD_LABEL: Record<Mood, string> = {
  happy: 'smiling',
  cheer: 'cheering',
  think: 'thinking',
  encourage: 'smiling kindly',
  sleep: 'napping',
};

export function Sprout({
  size = 72,
  mood = 'happy',
  stage = 0,
  bounceKey = 0,
  testID,
}: {
  size?: number;
  mood?: Mood;
  /** 0 Seedling, 1 Sprout, 2 Bloom, 3 Scholar, 4 Sage. */
  stage?: number;
  /** Change this to make Sprout hop. */
  bounceKey?: number;
  testID?: string;
}) {
  const reduce = useReducedMotion();
  const float = useSharedValue(0);
  const blink = useSharedValue(1);
  const sway = useSharedValue(0);
  const hop = useSharedValue(0);
  const squash = useSharedValue(1);
  const wave = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    float.value = withRepeat(withSequence(withTiming(-3, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })), -1);
    blink.value = withRepeat(withSequence(withDelay(2600, withTiming(0.1, { duration: 80 })), withTiming(1, { duration: 120 })), -1);
    sway.value = withRepeat(withSequence(withTiming(6, { duration: 1700, easing: Easing.inOut(Easing.sin) }), withTiming(-6, { duration: 1700, easing: Easing.inOut(Easing.sin) })), -1, true);
    return () => {
      cancelAnimation(float);
      cancelAnimation(blink);
      cancelAnimation(sway);
    };
  }, [reduce, float, blink, sway]);

  useEffect(() => {
    if (reduce || bounceKey === 0) return;
    hop.value = withSequence(withTiming(-14, { duration: 150, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 7, stiffness: 180 }));
    squash.value = withSequence(withTiming(0.9, { duration: 90 }), withTiming(1.06, { duration: 140 }), withSpring(1, { damping: 8 }));
  }, [bounceKey, reduce, hop, squash]);

  useEffect(() => {
    if (reduce || mood !== 'cheer') {
      wave.value = withTiming(0, { duration: 200 });
      return;
    }
    wave.value = withRepeat(withSequence(withTiming(1, { duration: 220 }), withTiming(0.4, { duration: 220 })), 6, true);
  }, [mood, reduce, wave]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value + hop.value }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const leavesStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }] }));
  const leftArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${-20 - wave.value * 70}deg` }] }));
  const rightArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${20 + wave.value * 70}deg` }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + (float.value + hop.value) / 40 }], opacity: 0.12 + (float.value + hop.value) / 200 }));

  const scale = size / 100;
  const leafScale = stage === 0 ? 0.72 : 1;

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={`Sprout, your study buddy, ${MOOD_LABEL[mood]}`}
      style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: 100, height: 100, transform: [{ scale }], transformOrigin: 'top left' }}>
        <Animated.View style={[box(24, 91, 52, 7, { borderRadius: 4, backgroundColor: '#000000' }), shadowStyle]} />
        <Animated.View style={[box(0, 0, 100, 100), bodyStyle, { transformOrigin: 'bottom' }]}>
          {stage < 3 ? (
            <Animated.View style={[box(20, 0, 60, 30), leavesStyle, { transformOrigin: '50% 100%' }]}>
              <View style={box(28.5, 10, 3, 20, { borderRadius: 2, backgroundColor: LEAF_DARK })} />
              <View style={box(9, 9, 22 * leafScale, 12 * leafScale, { borderRadius: 10, backgroundColor: LEAF_DARK, transform: [{ rotate: '-28deg' }] })} />
              <View style={box(31, 5, 22 * leafScale, 12 * leafScale, { borderRadius: 10, backgroundColor: LEAF, transform: [{ rotate: '24deg' }] })} />
              {stage === 2 ? <Flower x={21} y={-2} /> : null}
            </Animated.View>
          ) : null}
          <Animated.View style={[box(5, 58, 17, 11, { borderRadius: 6, backgroundColor: BODY_DARK }), leftArm, { transformOrigin: '100% 50%' }]} />
          <Animated.View style={[box(78, 58, 17, 11, { borderRadius: 6, backgroundColor: BODY_DARK }), rightArm, { transformOrigin: '0% 50%' }]} />
          <View
            style={box(14, 26, 72, 66, {
              backgroundColor: BODY,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
            })}
          />
          <View style={box(30, 60, 40, 28, { borderRadius: 20, backgroundColor: BELLY })} />
          {stage >= 3 ? <Cap /> : null}
          <Animated.View style={[box(0, 0, 100, 100), eyesStyle, { transformOrigin: '50% 52%' }]}>
            <Eye x={31} mood={mood} />
            <Eye x={53} mood={mood} />
          </Animated.View>
          <View style={box(22, 63, 11, 7, { borderRadius: 4, backgroundColor: CHEEK, opacity: 0.55 })} />
          <View style={box(67, 63, 11, 7, { borderRadius: 4, backgroundColor: CHEEK, opacity: 0.55 })} />
          <Mouth mood={mood} />
          {stage >= 4 ? (
            <View style={box(43, 76, 14, 14)}>
              <Icon name="star.fill" size={14} color={GOLD} />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
