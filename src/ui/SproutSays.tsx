// Sprout with a speech bubble. Used on Home, in sessions and on the summary.

import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import type { CoachLine } from '@/engine/coach';
import { Sprout } from './Sprout';
import { T } from './Text';
import { radius, space, useColors } from './theme';

export function SpeechBubble({ text, tail = 'left' }: { text: string; tail?: 'left' | 'right' | 'bottom' }) {
  const c = useColors();
  return (
    <View style={{ flexShrink: 1 }}>
      <View
        style={{
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          paddingHorizontal: space.md,
          paddingVertical: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}>
        <T variant="subhead" weight="600">
          {text}
        </T>
      </View>
      <View
        style={[
          {
            position: 'absolute',
            width: 12,
            height: 12,
            backgroundColor: c.card,
            borderColor: c.border,
            transform: [{ rotate: '45deg' }],
          },
          tail === 'left'
            ? { left: -6, bottom: 14, borderLeftWidth: 1, borderBottomWidth: 1 }
            : tail === 'right'
              ? { right: -6, bottom: 14, borderRightWidth: 1, borderTopWidth: 1 }
              : { left: 26, bottom: -6, borderRightWidth: 1, borderBottomWidth: 1 },
        ]}
      />
    </View>
  );
}

export function SproutSays({
  line,
  stage,
  size = 64,
  bounceKey,
  testID,
}: {
  line: CoachLine;
  stage: number;
  size?: number;
  bounceKey?: number;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
      <Sprout size={size} mood={line.mood} stage={stage} bounceKey={bounceKey} />
      <Animated.View key={line.text} entering={ZoomIn.springify().damping(14)} exiting={FadeOut} style={{ flexShrink: 1, marginBottom: size * 0.35 }}>
        <Animated.View entering={FadeIn}>
          <SpeechBubble text={line.text} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
