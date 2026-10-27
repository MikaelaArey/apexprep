import { ActionSheetIOS, Pressable } from 'react-native';
import type { Exam } from '@/content/types';
import { haptic } from '@/lib/haptics';
import { useExam } from '@/state/derived';
import { useStore } from '@/state/store';
import { Icon } from './Icon';
import { T } from './Text';
import { radius, useColors } from './theme';

const EXAMS: Exam[] = ['LSAT', 'MCAT'];

export function ExamSwitcher() {
  const c = useColors();
  const exam = useExam();
  const update = useStore((s) => s.updateSettings);
  const choose = () => {
    haptic.tap();
    ActionSheetIOS.showActionSheetWithOptions({ title: 'Studying for', options: [...EXAMS, 'Cancel'], cancelButtonIndex: EXAMS.length }, (i) => {
      if (i < EXAMS.length) update({ exam: EXAMS[i] });
    });
  };
  return (
    <Pressable
      testID="exam-switcher"
      accessibilityRole="button"
      accessibilityLabel={`Studying for ${exam}. Change exam`}
      onPress={choose}
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
      <Icon name="chevron.down" size={11} color={c.textMuted} weight="bold" />
    </Pressable>
  );
}
