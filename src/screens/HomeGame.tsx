// The fun layer on Home: Sprout's greeting, the badges you're closest to, and
// shortcuts to the Climb, badges and score history.

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SECTIONS } from '@/content/labels';
import type { Exam } from '@/content/types';
import { nextUp, tierLabel } from '@/engine/badges';
import { coachLine, type CoachLine } from '@/engine/coach';
import { scoreTrend } from '@/engine/scores';
import { useStreak, useToday } from '@/state/derived';
import { useBadges, useClimb, useSproutStage } from '@/state/gamification';
import { useStore } from '@/state/store';
import { BadgeMedal } from '@/ui/BadgeMedal';
import { Icon, type IconName } from '@/ui/Icon';
import { Card, Eyebrow, ProgressBar } from '@/ui/kit';
import { SproutSays } from '@/ui/SproutSays';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

export function SproutGreeting({ exam, due, hasSession }: { exam: Exam; due: number; hasSession: boolean }) {
  const today = useToday(exam);
  const streak = useStreak();
  const sprout = useSproutStage();
  let line: CoachLine;
  if (hasSession) line = { text: 'Let’s finish what we started!', mood: 'happy', event: 'greet' };
  else if (today.goalMet) line = { text: 'Daily goal done! Extra credit, anyone?', mood: 'cheer', event: 'greet' };
  else if (streak.current >= 3 && !streak.todayDone) line = { text: `${streak.current} days strong! One session keeps it going.`, mood: 'cheer', event: 'greet' };
  else if (due > 0 && today.daily5Done) line = { text: `${due} review${due === 1 ? '' : 's'} ready. Let’s keep them fresh!`, mood: 'think', event: 'greet' };
  else line = coachLine(today.answered > 0 ? 'tip' : 'greet', today.day, exam);
  return (
    <Card testID="sprout-card" style={{ gap: space.md }}>
      <SproutSays line={line} stage={sprout.stage} size={70} />
      <Pressable onPress={() => router.push('/badges')} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="footnote" weight="700">
            Sprout · {sprout.name} · Level {sprout.level}
          </T>
          <T variant="footnote" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {sprout.xp.into}/{sprout.xp.span} XP
          </T>
        </View>
        <ProgressBar value={sprout.xp.into / sprout.xp.span} />
        {sprout.next ? (
          <T variant="caption" color="textFaint">
            Grows into a {sprout.next.name} at level {sprout.next.level}
          </T>
        ) : null}
      </Pressable>
    </Card>
  );
}

export function NextBadges({ exam }: { exam: Exam }) {
  const badges = useBadges(exam);
  const list = nextUp(badges, 2);
  const earned = badges.filter((b) => b.tier > 0).length;
  if (list.length === 0) return null;
  return (
    <Pressable testID="next-badges" onPress={() => router.push('/badges')}>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Eyebrow>Almost there</Eyebrow>
          <T variant="footnote" color="textMuted">
            {earned} of {badges.length} badges ›
          </T>
        </View>
        {list.map((b) => (
          <View key={b.def.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <BadgeMedal badge={b} size={42} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="subhead" weight="700" numberOfLines={1} style={{ flex: 1 }}>
                  {b.tier > 0 ? `${tierLabel(b)} → next tier` : b.def.title}
                </T>
                <T variant="footnote" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
                  {b.value}/{b.next}
                </T>
              </View>
              <ProgressBar value={b.progress} height={5} />
              <T variant="caption" color="textMuted" numberOfLines={1}>
                {b.next !== null ? b.def.goal(b.next) : ''}
              </T>
            </View>
          </View>
        ))}
      </Card>
    </Pressable>
  );
}

function Tile({ icon, title, detail, onPress, testID, accent }: { icon: IconName; title: string; detail: string; onPress: () => void; testID: string; accent?: boolean }) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
      <Card style={[{ flex: 1, gap: 6, padding: space.md }, accent && { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
        <Icon name={icon} size={20} color={c.primary} />
        <T variant="subhead" weight="700">
          {title}
        </T>
        <T variant="caption" color="textMuted" numberOfLines={2}>
          {detail}
        </T>
      </Card>
    </Pressable>
  );
}

export function GameTiles({ exam }: { exam: Exam }) {
  const climb = useClimb(exam);
  const scores = useStore((s) => s.settings.scores);
  const target = useStore((s) => s.settings.plans[exam].target);
  const trend = scoreTrend(scores, exam, target);
  const active = [...climb].sort((a, b) => b.progress.cleared - a.progress.cleared).find((x) => !x.progress.done) ?? climb[0];
  const climbDetail = active.progress.cleared === 0 ? 'Start at the bottom' : `${SECTIONS[active.section].short} floor ${active.progress.current + 1} of ${active.progress.total}`;
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <Tile testID="tile-climb" icon="mountain.2.fill" title="The Climb" detail={climbDetail} onPress={() => router.push('/climb')} accent />
      <Tile testID="tile-bank" icon="list.number" title="Ranked bank" detail="Easiest to hardest" onPress={() => router.push('/bank')} />
      <Tile
        testID="tile-scores"
        icon="chart.line.uptrend.xyaxis"
        title="Scores"
        detail={trend.latest ? `Latest ${trend.latest.total} · goal ${target}` : 'Log a practice test'}
        onPress={() => router.push('/scores')}
      />
    </View>
  );
}
