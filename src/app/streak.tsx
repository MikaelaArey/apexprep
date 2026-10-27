// Streak details: freezes, the weekly rest day, and repairs.

import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { FREEZE_EVERY, MAX_FREEZES, MIN_PER_DAY, REPAIR_MIN } from '@/engine/streak';
import { parseDay } from '@/engine/time';
import { useStreak } from '@/state/derived';
import { useStore } from '@/state/store';
import { Icon } from '@/ui/Icon';
import { Card, Chip, Eyebrow, IconButton } from '@/ui/kit';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Streak() {
  const c = useColors();
  const streak = useStreak();
  const restDay = useStore((s) => s.settings.restDay);
  const update = useStore((s) => s.updateSettings);
  const fmt = (day: string) => parseDay(day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxxl }}>
      <View style={{ alignItems: 'flex-end', marginBottom: -space.xl }}>
        <IconButton testID="streak-close" icon="xmark" label="Close" onPress={() => router.back()} />
      </View>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Icon name="flame.fill" size={44} color={streak.current > 0 ? c.streak : c.textFaint} />
        <T variant="largeTitle" testID="streak-count">
          {streak.current} day{streak.current === 1 ? '' : 's'}
        </T>
        <T variant="subhead" color="textMuted" align="center">
          {streak.todayDone
            ? 'Today counts.'
            : streak.isRestDay
              ? 'Today is your rest day. Your streak is safe.'
              : `Answer ${Math.max(0, MIN_PER_DAY - streak.todayCount)} more today to keep it going.`}{' '}
          Best: {streak.best} days.
        </T>
      </View>

      {streak.repairable ? (
        <Card style={{ borderColor: c.warning, gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Icon name="bandage.fill" size={18} color={c.warning} />
            <T variant="headline">Repair your {streak.repairable.previous}-day streak</T>
          </View>
          <T variant="subhead" color="textMuted">
            It broke on {fmt(streak.repairable.missedDays[0])}. Answer {REPAIR_MIN} questions in one day by {fmt(streak.repairable.deadline)} and the
            missed {streak.repairable.missedDays.length === 1 ? 'day is' : 'days are'} covered. Today: {streak.todayCount} of {REPAIR_MIN}.
          </T>
        </Card>
      ) : null}

      <Card style={{ gap: space.md }}>
        <Eyebrow>Streak freezes</Eyebrow>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {Array.from({ length: MAX_FREEZES }, (_, i) => (
            <View
              key={i}
              style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i < streak.freezes ? c.primarySoft : c.bgGrouped }}>
              <Icon name="snowflake" size={20} color={i < streak.freezes ? c.primary : c.textFaint} />
            </View>
          ))}
        </View>
        <T variant="subhead" color="textMuted">
          Every {FREEZE_EVERY} study days earns a freeze (up to {MAX_FREEZES}). A freeze covers a missed day automatically.
          {streak.frozenDays.length ? ` Used so far: ${streak.frozenDays.length}.` : ''}
        </T>
      </Card>

      <Card style={{ gap: space.md }}>
        <Eyebrow>Weekly rest day</Eyebrow>
        <T variant="subhead" color="textMuted">
          Prep is a marathon. A planned rest day keeps your streak without counting toward it.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip testID="rest-none" label="None" selected={restDay === null} onPress={() => update({ restDay: null })} />
          {DAYS.map((d, i) => (
            <Chip key={d} testID={`rest-${i}`} label={d} selected={restDay === i} onPress={() => update({ restDay: i })} />
          ))}
        </View>
      </Card>

      <T variant="footnote" color="textMuted" align="center">
        A study day is any day with at least {MIN_PER_DAY} questions or review cards.
      </T>
    </ScrollView>
  );
}
