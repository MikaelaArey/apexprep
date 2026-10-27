import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { itemMap } from '@/content';
import { EXAMS, MISS_REASONS, SECTIONS, typeName } from '@/content/labels';
import { LEVELS } from '@/engine/difficulty';
import { tierFor, TIER_LABEL } from '@/engine/mastery';
import { SCORE_RULES, scoreTrend } from '@/engine/scores';
import { computeStats } from '@/engine/stats';
import { dayKey, lastNDays, weekday } from '@/engine/time';
import { levelTitle } from '@/engine/xp';
import { startDrill } from '@/state/actions';
import { useActivity, useExam, useExamAttempts, useNow, useRatings, useSelectContext, useStreak, useXp } from '@/state/derived';
import { useBadges } from '@/state/gamification';
import { useStore } from '@/state/store';
import { ScoreChart } from '@/ui/ScoreChart';
import { ExamBadge } from '@/ui/ExamBadge';
import { clock, pct } from '@/ui/format';
import { Button, Card, Empty, Eyebrow, ListRow, ProgressBar, SectionTitle, StatTile } from '@/ui/kit';
import { TabScreen } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';
import { MIN_PER_DAY } from '@/engine/streak';

const CONFIDENCE_LABEL = { sure: 'Sure', unsure: 'Unsure', guess: 'Guess' } as const;

function BarRow({ label, value, max, right, color }: { label: string; value: number; max: number; right: string; color?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="subhead">{label}</T>
        <T variant="subhead" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
          {right}
        </T>
      </View>
      <ProgressBar value={max ? value / max : 0} color={color} />
    </View>
  );
}

function Calendar() {
  const c = useColors();
  const activity = useActivity();
  const now = useNow();
  const today = dayKey(now);
  // Four full weeks ending this week, Monday first.
  const offset = (weekday(today) + 6) % 7;
  const days = lastNDays(today, 28 - (6 - offset));
  const cells = [...days, ...Array(6 - offset).fill(null)];
  const studied = days.filter((d) => (activity.get(d) ?? 0) >= MIN_PER_DAY).length;
  return (
    <Card testID="calendar">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
        <Eyebrow>Study days</Eyebrow>
        <T variant="footnote" color="textMuted">
          {studied} of the last 4 weeks
        </T>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <T key={i} variant="caption" color="textFaint" style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </T>
          ))}
        </View>
        {[0, 1, 2, 3].map((week) => (
          <View key={week} style={{ flexDirection: 'row', gap: 6 }}>
            {cells.slice(week * 7, week * 7 + 7).map((d, i) => {
              const n = d ? (activity.get(d) ?? 0) : 0;
              const full = n >= MIN_PER_DAY;
              return (
                <View
                  key={i}
                  accessibilityLabel={d ? `${d}: ${n} answered` : undefined}
                  style={{
                    flex: 1,
                    height: 28,
                    borderRadius: 7,
                    backgroundColor: !d ? 'transparent' : full ? c.primary : n > 0 ? c.primarySoft : c.bgGrouped,
                    borderWidth: d === today ? 1.5 : 0,
                    borderColor: c.ink,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}

function ScoresCard() {
  const exam = useExam();
  const scores = useStore((s) => s.settings.scores);
  const target = useStore((s) => s.settings.plans[exam].target);
  const trend = scoreTrend(scores, exam, target);
  const rules = SCORE_RULES[exam];
  return (
    <Card testID="scores-card" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow>Practice test scores</Eyebrow>
        <T variant="footnote" color="textMuted">
          Goal {target}
        </T>
      </View>
      {trend.entries.length > 0 ? (
        <ScoreChart entries={trend.entries} target={target} min={rules.total.min} max={rules.total.max} />
      ) : (
        <T variant="subhead" color="textMuted">
          Log your full-length practice tests to see your trend against your goal.
        </T>
      )}
      <Button
        testID="stats-scores"
        kind="secondary"
        size="md"
        title={trend.entries.length ? 'Score history' : 'Log a score'}
        icon={trend.entries.length ? 'chart.line.uptrend.xyaxis' : 'plus'}
        onPress={() => router.push(trend.entries.length ? '/scores' : '/score-edit')}
      />
    </Card>
  );
}

export default function Stats() {
  const c = useColors();
  const exam = useExam();
  const attempts = useExamAttempts(exam);
  const ratings = useRatings();
  const ctx = useSelectContext(exam);
  const streak = useStreak();
  const xp = useXp();
  const pure = useStore((s) => s.settings.pureStudy);
  const now = useNow();
  const stats = useMemo(() => computeStats(attempts, EXAMS[exam].sections, itemMap, ratings, now), [attempts, exam, ratings, now]);
  const badges = useBadges(exam);
  const byLevel = useMemo(() => {
    const rows = ([1, 2, 3, 4, 5] as const).map((level) => ({ level, n: 0, correct: 0 }));
    for (const a of attempts) {
      const d = itemMap.get(a.itemId)?.difficulty;
      if (!d) continue;
      rows[d - 1].n += 1;
      if (a.correct) rows[d - 1].correct += 1;
    }
    return rows;
  }, [attempts]);

  if (stats.total === 0) {
    return (
      <TabScreen title="Stats" right={<ExamBadge />}>
        <Card>
          <Empty icon="chart.bar" title="No stats yet" body="Answer a few questions and your accuracy, weak spots and pacing will show up here." />
        </Card>
        <View style={{ height: space.lg }} />
        <ScoresCard />
      </TabScreen>
    );
  }

  const maxReason = Math.max(1, ...stats.missReasons.map((r) => r.count));

  return (
    <TabScreen title="Stats" right={<ExamBadge />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <StatTile label="Answered" value={String(stats.total)} sub={`${pct(stats.correct, stats.total)} correct`} />
        <StatTile label="Streak" value={`${streak.current}d`} sub={`Best ${streak.best} days`} />
        {!pure ? <StatTile label="Level" value={String(xp.level)} sub={`${levelTitle(xp.level)} · ${xp.total} XP`} /> : null}
      </View>

      <SectionTitle title="Practice tests" />
      <ScoresCard />

      <SectionTitle title="By difficulty" />
      <Card testID="by-level" style={{ gap: space.md }}>
        {byLevel.map((r) => (
          <BarRow
            key={r.level}
            label={LEVELS[r.level].name}
            value={r.correct}
            max={r.n}
            right={r.n ? `${pct(r.correct, r.n)} of ${r.n}` : 'Not tried'}
            color={r.level === 5 ? c.streak : r.level === 4 ? c.warning : c.primary}
          />
        ))}
        <Button testID="stats-bank" kind="ghost" size="md" title="Browse the ranked question bank" icon="list.number" onPress={() => router.push('/bank')} />
      </Card>

      {!pure ? (
        <Card padded={false} style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
          <ListRow
            testID="stats-badges"
            icon="trophy.fill"
            title="Badges"
            subtitle={`${badges.filter((b) => b.tier > 0).length} of ${badges.length} earned`}
            onPress={() => router.push('/badges')}
            last
          />
        </Card>
      ) : null}

      <SectionTitle title="Biggest weak spots" />
      <Card testID="leaks">
        {stats.leaks.length === 0 ? (
          <T variant="subhead" color="textMuted">
            Answer at least two questions of a type to see where points are slipping.
          </T>
        ) : (
          <View style={{ gap: space.lg }}>
            {stats.leaks.map((leak, i) => (
              <View key={`${leak.section}:${leak.type}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <T variant="title" color="textFaint" style={{ width: 22 }}>
                  {i + 1}
                </T>
                <View style={{ flex: 1 }}>
                  <T variant="callout" weight="600">
                    {typeName(leak.type)}
                  </T>
                  <T variant="footnote" color="textMuted">
                    {SECTIONS[leak.section].short} · {Math.round(leak.accuracy * 100)}% of {leak.n} · mastery {leak.mastery}
                  </T>
                </View>
                <Button
                  testID={`drill-leak-${i}`}
                  kind="secondary"
                  size="md"
                  title="Drill"
                  onPress={() => startDrill(ctx, { sections: [leak.section], types: [leak.type], difficulty: 'any', count: 5 }, typeName(leak.type))}
                  style={{ paddingHorizontal: space.lg }}
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      <SectionTitle title="By section" />
      <Card style={{ gap: space.lg }}>
        {stats.sections.map((s) => {
          const tier = tierFor(s.mastery ?? 0, s.ratedN);
          return (
            <View key={s.section} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="subhead" weight="600">
                  {SECTIONS[s.section].name}
                </T>
                <T variant="footnote" color="textMuted">
                  {s.n === 0 ? 'Not started' : `${pct(s.correct, s.n)} · ${tier === 'new' ? `${s.n} answered` : `${TIER_LABEL[tier]} (${s.mastery})`}`}
                </T>
              </View>
              <ProgressBar value={s.n ? s.correct / s.n : 0} />
              {s.n > 0 ? (
                <T variant="caption" color={s.avgMs > s.targetMs * 1.15 ? 'warning' : 'textFaint'}>
                  Pace {clock(s.avgMs)} per question · target {clock(s.targetMs)}
                </T>
              ) : null}
            </View>
          );
        })}
      </Card>

      <SectionTitle title="Why you miss" />
      <Card style={{ gap: space.md }}>
        {stats.missReasons.length === 0 ? (
          <T variant="subhead" color="textMuted">
            After a miss, tap a reason (“Misread,” “Ran out of time”…) and the pattern shows up here.
          </T>
        ) : (
          stats.missReasons.map((r) => (
            <BarRow key={r.reason} label={MISS_REASONS[r.reason]} value={r.count} max={maxReason} right={String(r.count)} color={c.danger} />
          ))
        )}
        {stats.misses > 0 ? (
          <T variant="caption" color="textFaint">
            {stats.missesExplained} of {stats.misses} misses tagged
          </T>
        ) : null}
      </Card>

      {stats.calibration.length > 0 ? (
        <>
          <SectionTitle title="Calibration" />
          <Card style={{ gap: space.md }}>
            <T variant="subhead" color="textMuted">
              How often each confidence level is right. “Sure” should be close to 100%.
            </T>
            {stats.calibration.map((cal) => (
              <BarRow
                key={cal.confidence}
                label={CONFIDENCE_LABEL[cal.confidence]}
                value={cal.correct}
                max={cal.n}
                right={`${pct(cal.correct, cal.n)} of ${cal.n}`}
                color={cal.confidence === 'sure' ? c.success : c.textMuted}
              />
            ))}
          </Card>
        </>
      ) : null}

      <View style={{ height: space.lg }} />
      <Calendar />

      <SectionTitle title="Question types" />
      <Card padded={false} style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
        {stats.types.map((t, i) => (
          <View
            key={`${t.section}:${t.type}`}
            style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: i === stats.types.length - 1 ? 0 : 0.5, borderBottomColor: c.border }}>
            <T variant="subhead" style={{ flex: 1 }}>
              {typeName(t.type)}
            </T>
            <T variant="subhead" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
              {t.correct}/{t.n}
            </T>
          </View>
        ))}
      </Card>

      <Button testID="stats-settings" kind="ghost" title="Settings" icon="gearshape" onPress={() => router.push('/settings')} style={{ marginTop: space.xl }} />
    </TabScreen>
  );
}
