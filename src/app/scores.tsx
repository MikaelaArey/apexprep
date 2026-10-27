// Score history: official and full-length practice scores the student logged,
// charted against their goal. A new personal best gets confetti and a cheer.

import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SECTIONS } from '@/content/labels';
import { coachLine } from '@/engine/coach';
import { SCORE_RULES, scoreTrend } from '@/engine/scores';
import { parseDay } from '@/engine/time';
import { useExam } from '@/state/derived';
import { useSproutStage } from '@/state/gamification';
import { useStore } from '@/state/store';
import { Confetti } from '@/ui/Confetti';
import { Icon } from '@/ui/Icon';
import { Button, Card, Eyebrow, IconButton, Pill } from '@/ui/kit';
import { ScoreChart } from '@/ui/ScoreChart';
import { SproutSays } from '@/ui/SproutSays';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const longDate = (day: string) => parseDay(day).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

function StatBox({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'muted' }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Eyebrow>{label}</Eyebrow>
      <T variant="title" color={tone === 'success' ? 'success' : 'text'} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
    </View>
  );
}

export default function Scores() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const exam = useExam();
  const scores = useStore((s) => s.settings.scores);
  const target = useStore((s) => s.settings.plans[exam].target);
  const pure = useStore((s) => s.settings.pureStudy);
  const celebrate = useStore((s) => s.meta.scoreCelebrate as { id: string; change: number } | null | undefined);
  const setMeta = useStore((s) => s.setMeta);
  const sprout = useSproutStage();
  const trend = scoreTrend(scores, exam, target);
  const rules = SCORE_RULES[exam];
  const pb = celebrate ? trend.entries.find((e) => e.id === celebrate.id) : undefined;

  // The cheer for a new personal best stays until the student leaves this screen.
  useEffect(() => () => setMeta('scoreCelebrate', null), [setMeta]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <View>
          <T variant="title">Score history</T>
          <T variant="footnote" color="textMuted">
            {exam} practice tests and official scores
          </T>
        </View>
        <IconButton testID="scores-close" icon="xmark" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + 120 }}>
        {pb && !pure ? (
          <SproutSays
            testID="score-pb"
            line={coachLine('personalBest', pb.id, exam, { score: pb.total, change: celebrate?.change ?? 0 })}
            stage={sprout.stage}
            bounceKey={1}
          />
        ) : null}
        {trend.entries.length === 0 ? (
          <Card style={{ gap: space.lg }}>
            {!pure ? (
              <SproutSays
                line={{ text: 'Log your practice test scores and I’ll chart your climb to the goal!', mood: 'happy', event: 'greet' }}
                stage={sprout.stage}
              />
            ) : (
              <T variant="subhead" color="textMuted">
                Log your practice test scores to chart your progress toward your goal.
              </T>
            )}
            <T variant="footnote" color="textMuted">
              {exam === 'MCAT'
                ? 'Add each full-length practice test (or your official MCAT) with its four section scores, 118–132 each.'
                : `Add each practice test or official score (${rules.total.min}–${rules.total.max}).`}
            </T>
          </Card>
        ) : (
          <Card style={{ gap: space.lg }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <StatBox label="Latest" value={String(trend.latest?.total ?? '—')} />
              <StatBox label="Best" value={String(trend.best?.total ?? '—')} tone={trend.best && trend.best.total >= target ? 'success' : undefined} />
              <StatBox label="Change" value={trend.change === null ? '—' : `${trend.change >= 0 ? '+' : '−'}${Math.abs(trend.change)}`} />
            </View>
            <ScoreChart entries={trend.entries} target={target} min={rules.total.min} max={rules.total.max} />
            <T variant="footnote" color="textMuted">
              {trend.toGoal === 0 ? 'You’ve hit your goal. Time to raise it?' : `${trend.toGoal} point${trend.toGoal === 1 ? '' : 's'} from your best to your goal of ${target}.`}
            </T>
          </Card>
        )}

        {[...trend.entries].reverse().map((e) => (
          <Pressable key={e.id} testID={`score-${e.id}`} onPress={() => router.push({ pathname: '/score-edit', params: { id: e.id } })}>
            <Card style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <T variant="callout" weight="700" numberOfLines={1}>
                    {e.label || (e.kind === 'official' ? `Official ${exam}` : 'Practice test')}
                  </T>
                  <T variant="footnote" color="textMuted">
                    {longDate(e.date)}
                  </T>
                </View>
                <T variant="stat" style={{ fontVariant: ['tabular-nums'] }}>
                  {e.total}
                </T>
                <Icon name="chevron.right" size={12} color={c.textFaint} weight="semibold" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Pill label={e.kind === 'official' ? 'Official' : 'Practice'} tone={e.kind === 'official' ? 'primary' : 'neutral'} />
                {e.sections
                  ? rules.sections
                      .filter((s) => e.sections?.[s] !== undefined)
                      .map((s) => (
                        <View key={s} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.bgGrouped }}>
                          <T variant="caption" weight="600" color="textMuted">
                            {SECTIONS[s].short} {e.sections?.[s]}
                          </T>
                        </View>
                      ))
                  : null}
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.bgGrouped }}>
        <Button testID="score-add" title="Log a score" icon="plus" onPress={() => router.push('/score-edit')} />
      </View>
      {pb && !pure ? <Confetti key={pb.id} /> : null}
    </View>
  );
}
