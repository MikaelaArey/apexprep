// Sprout pops up in the corner after some answers with a quick line, then
// slides away on its own (or when tapped).

import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { SlideInRight, SlideOutRight } from 'react-native-reanimated';
import type { CoachLine } from '@/engine/coach';
import { SpeechBubble } from '@/ui/SproutSays';
import { Sprout } from '@/ui/Sprout';
import { space } from '@/ui/theme';

const SHOW_MS = 4500;

export function CoachToast({ line, stage, bottom }: { line: CoachLine; stage: number; bottom: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <Animated.View
      testID="coach-toast"
      entering={SlideInRight.springify().damping(16)}
      exiting={SlideOutRight}
      style={{ position: 'absolute', right: space.md, left: space.xxxl, bottom: bottom + space.sm, alignItems: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sprout says: ${line.text}. Tap to dismiss.`}
        onPress={() => setVisible(false)}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <SpeechBubble text={line.text} tail="right" />
        <Sprout size={58} mood={line.mood} stage={stage} bounceKey={1} />
      </Pressable>
    </Animated.View>
  );
}
