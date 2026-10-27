import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { haptic } from '@/lib/haptics';
import { useExam } from '@/state/derived';
import { useStore } from '@/state/store';
import { Icon } from './Icon';
import { T } from './Text';
import { radius, useColors } from './theme';

/**
 * The exam being studied. Tapping it opens Profile, where students add a second
 * exam and switch between the two.
 */
export function ExamBadge() {
  const c = useColors();
  const exam = useExam();
  const both = useStore((s) => s.settings.exams.length > 1);
  return (
    <Pressable
      testID="exam-badge"
      accessibilityRole="button"
      accessibilityLabel={both ? `Studying for ${exam}. Open profile to switch exams` : `Studying for ${exam}. Open profile`}
      onPress={() => {
        haptic.tap();
        router.push('/settings');
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        height: 34,
        borderRadius: radius.pill,
        backgroundColor: pressed ? c.cardPressed : c.card,
        borderWidth: 1,
        borderColor: c.border,
      })}>
      <T variant="subhead" weight="700">
        {exam}
      </T>
      {both ? <Icon name="arrow.left.arrow.right" size={11} color={c.textMuted} weight="bold" /> : null}
    </Pressable>
  );
}
