// End-of-session closure: what you did, what it earned, and when to come back.
// Sprout sums up the session, and big moments (a cleared Climb floor, new badges,
// a level-up) get their own cards and a burst of confetti.

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { itemMap } from '@/content';
import { typeName } from '@/content/labels';
import { tierLabel, type BadgeState } from '@/engine/badges';
import { campName, floorXp } from '@/engine/climb';
import { coachLine, finishEvent } from '@/engine/coach';
import { MIN_PER_DAY } from '@/engine/streak';
import { useStreak } from '@/state/derived';
import { useSproutStage } from '@/state/gamification';
import type { SessionSummary } from '@/state/session-types';
import { useStore } from '@/state/store';
import { BadgeMedal } from '@/ui/BadgeMedal';
import { Confetti } from '@/ui/Confetti';
import { minutes, nextReviewLabel } from '@/ui/format';
import { Icon } from '@/ui/Icon';
import { Button, Card, Divider, Eyebrow, ProgressBar } from '@/ui/kit';
import { LevelMeter } from '@/ui/LevelMeter';
import { SproutSays } from '@/ui/SproutSays';
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

export function Summary({
  summary,
  earned,
  levelUp,
  keepGoingLabel,
  onKeepGoing,
}: {
  summary: SessionSummary;
  earned: BadgeState[];
  levelUp: number | null;
  keepGoingLabel: string | null;
  onKeepGoing: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const streak = useStreak();
  const pure = useStore((s) => s.settings.pureStudy);
  const coach = useStore((s) => s.settings.coach);
  const attempts = useStore((s) => s.attempts);
  const sprout = useSproutStage();
  const results = attempts.filter((a) => a.sessionId === summary.sessionId);
  const [now] = useState(Date.now);
  const needed = Math.max(0, MIN_PER_DAY - streak.todayCount);
  const climb = summary.climb;

  const line = climb
    ? coachLine(climb.cleared ? 'floorCleared' : 'floorMissed', summary.sessionId, summary.exam, { needed: climb.needed })
    : coachLine(finishEvent(summary.correct, summary.questions), summary.sessionId, summary.exam, { correct: summary.correct, total: summary.questions });
  const party = !pure && (Boolean(climb?.firstClear) || earned.length > 0 || levelUp !== null || (summary.questions >= 5 && summary.correct === summary.questions));
  const showSprout = !pure && coach;

  return (
    <View testID="summary" style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingHorizontal: space.lg, paddingBottom: space.xl }}>
        {showSprout ? (
          <View style={{ gap: space.md }}>
            <T variant="title">{summary.title} complete</T>
            <SproutSays testID="summary-sprout" line={line} stage={sprout.stage} size={76} bounceKey={1} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="checkmark" size={30} color={c.primary} weight="bold" />
            </View>
            <T variant="title" align="center">
              {summary.title} complete
            </T>
          </View>
        )}

        <Card style={{ flexDirection: 'row', marginTop: space.xl, paddingVertical: space.xl }}>
          {summary.questions > 0 ? <Metric value={`${summary.correct}/${summary.questions}`} label="Correct" /> : null}
          {summary.cardsReviewed > 0 ? <Metric value={String(summary.cardsReviewed)} label="Cards" /> : null}
          <Metric value={minutes(summary.ms)} label="Time" />
          {!pure ? <Metric value={`+${summary.xp}`} label="XP" /> : null}
        </Card>

        {climb ? (
          <Card testID="climb-result" style={{ marginTop: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Icon name={climb.cleared ? 'flag.checkered' : 'mountain.2.fill'} size={22} color={climb.cleared ? c.success : c.textMuted} />
              <View style={{ flex: 1 }}>
                <T variant="headline">{climb.cleared ? `Floor ${climb.floor + 1} cleared!` : `Floor ${climb.floor + 1}: not yet`}</T>
                <T variant="footnote" color="textMuted">
                  {campName(climb.floor)} ·{' '}
                  {climb.cleared
                    ? climb.firstClear
                      ? `Next floor unlocked${pure ? '' : ` · +${floorXp(climb)} XP`}`
                      : 'Already cleared before. Nice repeat!'
                    : `You need ${climb.needed} of ${summary.questions} to clear it.`}
                </T>
              </View>
            </View>
            <ProgressBar value={summary.questions ? summary.correct / summary.questions : 0} color={climb.cleared ? c.success : c.warning} />
          </Card>
        ) : null}

        {!pure && (earned.length > 0 || levelUp !== null) ? (
          <Card testID="earned" style={{ marginTop: space.lg, gap: space.md }}>
            <Eyebrow>New this session</Eyebrow>
            {levelUp !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="leaf.fill" size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="callout" weight="600">
                    Level {levelUp}
                  </T>
                  <T variant="footnote" color="textMuted">
                    Sprout the {sprout.name} grew with you.
                  </T>
                </View>
              </View>
            ) : null}
            {earned.map((b) => (
              <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <BadgeMedal badge={b} size={44} />
                <View style={{ flex: 1 }}>
                  <T variant="callout" weight="600">
                    {tierLabel(b)}
                  </T>
                  <T variant="footnote" color="textMuted">
                    {b.next === null ? 'Maxed out!' : `Next tier: ${b.def.goal(b.next).toLowerCase()}`}
                  </T>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

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
            {results.map((a, i) => {
              const item = itemMap.get(a.itemId);
              return (
                <View key={a.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 }}>
                    <Icon name={a.correct ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={18} color={a.correct ? c.success : c.danger} />
                    <T variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
                      {typeName(item?.type ?? '')}
                    </T>
                    {item ? <LevelMeter level={item.difficulty} compact showName={false} /> : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
      <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.bgGrouped }}>
        <Button testID="summary-done" title="Done" onPress={() => router.back()} />
        {keepGoingLabel ? <Button testID="summary-more" kind="secondary" title={keepGoingLabel} onPress={onKeepGoing} /> : null}
      </View>
      {party ? <Confetti key={summary.sessionId} /> : null}
    </View>
  );
}
