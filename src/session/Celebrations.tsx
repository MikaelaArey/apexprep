// Badge and level-up toasts during a session, with a burst of confetti. Each new
// badge is shown once, then recorded as celebrated on this device.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Exam } from '@/content/types';
import { tierLabel, type BadgeState } from '@/engine/badges';
import { haptic } from '@/lib/haptics';
import { useXp } from '@/state/derived';
import { useNewBadges, useSproutStage } from '@/state/gamification';
import { BadgeMedal } from '@/ui/BadgeMedal';
import { Confetti } from '@/ui/Confetti';
import { Sprout } from '@/ui/Sprout';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const SHOW_MS = 3200;

export function Celebrations({ exam }: { exam: Exam }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { fresh, acknowledge } = useNewBadges(exam);
  const xp = useXp();
  const sprout = useSproutStage();
  // The last level already celebrated; starts at the level the session began with.
  const [levelAck, setLevelAck] = useState(xp.level);

  // One toast at a time: the oldest uncelebrated badge first, then a level-up.
  const badge: BadgeState | null = fresh[0] ?? null;
  const levelUp = !badge && xp.level > levelAck ? xp.level : null;
  const key = badge ? badge.key : levelUp ? `level-${levelUp}` : null;

  useEffect(() => {
    if (!key) return;
    haptic.success();
    const t = setTimeout(() => {
      if (key.startsWith('level-')) setLevelAck(Number(key.slice(6)));
      else acknowledge([key]);
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [key, acknowledge]);

  if (!key) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <Confetti key={`confetti-${key}`} />
      <Animated.View
        key={`toast-${key}`}
        testID="celebration-toast"
        entering={ZoomIn.springify().damping(13)}
        exiting={FadeOut.duration(250)}
        style={{
          position: 'absolute',
          top: insets.top + 60,
          left: space.lg,
          right: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.md,
          borderRadius: radius.lg,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
        }}>
        {badge ? <BadgeMedal badge={badge} size={48} /> : <Sprout size={52} mood="cheer" stage={sprout.stage} bounceKey={levelUp ?? 0} />}
        <View style={{ flex: 1 }}>
          <T variant="caption" weight="700" color="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {badge ? 'Badge unlocked' : 'Level up'}
          </T>
          <T variant="headline">{badge ? tierLabel(badge) : `Level ${levelUp}`}</T>
          <T variant="footnote" color="textMuted">
            {badge
              ? badge.next === null
                ? 'Maxed out. Legendary!'
                : `Next: ${badge.def.goal(badge.next).toLowerCase()}`
              : `Sprout the ${sprout.name} is growing with you!`}
          </T>
        </View>
      </Animated.View>
    </View>
  );
}
