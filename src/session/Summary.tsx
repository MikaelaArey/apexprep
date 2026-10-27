// End-of-session closure: what you did, what it earned, and when to come back.

import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { itemMap } from '@/content';
import { typeName } from '@/content/labels';
import { MIN_PER_DAY } from '@/engine/streak';
import { useStreak } from '@/state/derived';
import type { SessionSummary } from '@/state/session-types';
import { useStore } from '@/state/store';
import { minutes, nextReviewLabel } from '@/ui/format';
import { Icon } from '@/ui/Icon';
import { Button, Card, Divider } from '@/ui/kit';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T variant="stat" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
      <T variant="caption" color="textMuted">
        {label}
      </T>
    </View>
  );
}

export function Summary({ summary, onKeepGoing }: { summary: SessionSummary; onKeepGoing: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const streak = useStreak();
  const pure = useStore((s) => s.settings.pureStudy);
  const attempts = useStore((s) => s.attempts);
  const results = attempts.filter((a) => a.sessionId === summary.sessionId);
  const now = Date.now();
  const needed = Math.max(0, MIN_PER_DAY - streak.todayCount);

  return (
    <View testID="summary" style={{ flex: 1, backgroundColor: c.bgGrouped, paddingTop: insets.top + space.xxl, paddingHorizontal: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkmark" size={30} color={c.primary} weight="bold" />
        </View>
        <T variant="title" align="center">
          {summary.title} complete
        </T>
      </View>

      <Card style={{ flexDirection: 'row', marginTop: space.xxl, paddingVertical: space.xl }}>
        {summary.questions > 0 ? <Metric value={`${summary.correct}/${summary.questions}`} label="Correct" /> : null}
        {summary.cardsReviewed > 0 ? <Metric value={String(summary.cardsReviewed)} label="Cards" /> : null}
        <Metric value={minutes(summary.ms)} label="Time" />
        {!pure ? <Metric value={`+${summary.xp}`} label="XP" /> : null}
      </Card>

      <Card style={{ marginTop: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Icon name="flame.fill" size={20} color={streak.todayDone ? c.streak : c.textFaint} />
          <T variant="callout" style={{ flex: 1 }}>
            {summary.streakRepaired
              ? `Streak repaired: ${streak.current} days and counting.`
              : streak.todayDone
                ? `Today counts. Your streak is ${streak.current} day${streak.current === 1 ? '' : 's'}.`
                : `${needed} more question${needed === 1 ? '' : 's'} today to keep your streak.`}
          </T>
        </View>
        {summary.dailyGoalReached ? (
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Icon name="target" size={20} color={c.primary} />
            <T variant="callout" style={{ flex: 1 }}>
              Daily goal reached{pure ? '.' : ' · +25 XP'}
            </T>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Icon name="arrow.triangle.2.circlepath" size={20} color={c.textMuted} />
          <T variant="callout" style={{ flex: 1 }}>
            {summary.cardsAdded > 0
              ? `${summary.cardsAdded} concept${summary.cardsAdded === 1 ? '' : 's'} added to Review.`
              : 'No new concepts to review.'}
            {summary.nextReviewAt ? ` Next review ${nextReviewLabel(summary.nextReviewAt, now)}.` : ''}
          </T>
        </View>
      </Card>

      {results.length > 0 ? (
        <Card style={{ marginTop: space.lg }} padded={false}>
          {results.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 }}>
                <Icon name={a.correct ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={18} color={a.correct ? c.success : c.danger} />
                <T variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
                  {typeName(itemMap.get(a.itemId)?.type ?? '')}
                </T>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ flex: 1 }} />
      <View style={{ gap: space.md, paddingBottom: insets.bottom + space.md }}>
        <Button testID="summary-done" title="Done" onPress={() => router.back()} />
        <Button testID="summary-more" kind="secondary" title="Keep going · 5 more" onPress={onKeepGoing} />
      </View>
    </View>
  );
}
