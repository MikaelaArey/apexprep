import * as Haptics from 'expo-haptics';
import { useStore } from '@/state/store';

const enabled = () => useStore.getState().settings.haptics;
const safe = (p: Promise<void>) => p.catch(() => undefined);

export const haptic = {
  select: () => enabled() && safe(Haptics.selectionAsync()),
  tap: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
