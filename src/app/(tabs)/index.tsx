import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { EXAMS, SECTIONS, typeName } from '@/content/labels';
import type { Exam } from '@/content/types';
import { masteryScore, sectionKey, tierFor, TIER_LABEL } from '@/engine/mastery';
import { nextPassage, weakestTypes } from '@/engine/select';
import { READINESS_MIN } from '@/engine/stats';
import { resumeSession, startDaily5, startDrill, startPassage, startReview } from '@/state/actions';
import { useDaysToTest, useDueCards, useExam, useExamAttempts, useSelectContext, useStreak, useToday } from '@/state/derived';
import { useStore } from '@/state/store';
import { useAccount } from '@/sync/account';
import { ExamBadge } from '@/ui/ExamBadge';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, Card, Eyebrow, IconButton, Pill, ProgressBar } from '@/ui/kit';
import { TabScreen } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

function StreakButton() {
  const c = useColors();
  const streak = useStreak();
  return (
    <Pressable
      testID="streak-button"
      accessibilityRole="button"
      accessibilityLabel={`${streak.current}-day streak`}
      onPress={() => router.push('/streak')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 34, opacity: pressed ? 0.6 : 1 })}>
      <Icon name="flame.fill" size={18} color={streak.todayDone ? c.streak : c.textFaint} />
      <T variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {streak.current}
      </T>
    </Pressable>
  );
}

function PlanRow({
  icon,
  title,
  detail,
  done,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  detail: string;
  done?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={done ? 'checkmark.circle.fill' : icon} size={22} color={done ? c.success : c.textMuted} />
      <T variant="callout" weight="600" style={{ flex: 1, color: done ? c.textMuted : c.text }}>
        {title}
      </T>
      <T variant="footnote" color="textMuted">
        {detail}
      </T>
      {onPress && !done ? <Icon name="chevron.right" size={12} color={c.textFaint} weight="semibold" /> : null}
    </Pressable>
  );
}

function Readiness({ exam }: { exam: Exam }) {
  const c = useColors();
  const ctx = useSelectContext(exam);
  const attempts = useExamAttempts(exam);
  const sections = EXAMS[exam].sections;
  const counts = sections.map((s) => attempts.filter((a) => a.section === s).length);
  const unlocked = counts.every((n) => n >= READINESS_MIN);
  return (
    <Card testID="readiness-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>Readiness</Eyebrow>
        <Pill label={unlocked ? 'Estimating' : 'Calibrating'} tone="neutral" />
      </View>
      <T variant="footnote" color="textMuted" style={{ marginTop: 6, marginBottom: space.md }}>
        {unlocked
          ? 'Score ranges appear once there’s enough data to calibrate them honestly.'
          : `Projected scores unlock after ${READINESS_MIN} questions in each section. Until then, here’s your mastery.`}
      </T>
      <View style={{ gap: space.md }}>
        {sections.map((section, i) => {
          const r = ctx.ratings.get(sectionKey(exam, section));
          const score = r ? masteryScore(r, ctx.now) : null;
          const tier = tierFor(score ?? 0, r?.n ?? 0);
          return (
            <View key={section} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <T variant="subhead" weight="600">
                  {SECTIONS[section].name}
                </T>
                <T variant="footnote" color="textMuted">
                  {tier === 'new' ? `${counts[i]} answered` : `${score} · ${TIER_LABEL[tier]}`}
                </T>
              </View>
              <ProgressBar value={tier === 'new' ? counts[i] / READINESS_MIN : (score ?? 0) / 100} color={tier === 'new' ? c.borderStrong : c.primary} />
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export default function Home() {
  const c = useColors();
  const exam = useExam();
  const settings = useStore((s) => s.settings);
  const session = useStore((s) => s.session);
  const attemptsCount = useStore((s) => s.attempts.length);
  const ctx = useSelectContext(exam);
  const today = useToday(exam);
  const due = useDueCards(exam);
  const days = useDaysToTest(exam);
  const account = useAccount();
  const weak = useMemo(() => weakestTypes(ctx, 1)[0] ?? null, [ctx]);
  const passage = useMemo(() => nextPassage(ctx), [ctx]);
  const plan = settings.plans[exam];

  const reviewMin = Math.max(1, Math.round(due.length * 0.4));
  const activeSession = session && session.exam === exam ? session : null;

  let cta: { title: string; onPress: () => void; icon: IconName };
  if (activeSession) {
    const left = activeSession.tasks.length - activeSession.index;
    cta = { title: `Continue ${activeSession.title} · ${left} left`, onPress: resumeSession, icon: 'play.fill' };
  } else if (!today.daily5Done) {
    cta = { title: 'Start Daily 5 · 3 min', onPress: () => startDaily5(ctx), icon: 'bolt.fill' };
  } else if (due.length > 0) {
    cta = { title: `Review ${due.length} · ${reviewMin} min`, onPress: () => startReview(ctx), icon: 'arrow.triangle.2.circlepath' };
  } else {
    cta = { title: 'Keep going · 5 more', onPress: () => startDaily5(ctx), icon: 'bolt.fill' };
  }

  const countdown =
    days === null ? 'No test date yet' : days > 0 ? `Test in ${days} day${days === 1 ? '' : 's'}` : days === 0 ? 'Test day. Good luck!' : 'Test date passed';

  return (
    <TabScreen
      title="Today"
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <StreakButton />
          <ExamBadge />
          <IconButton testID="open-settings" icon="person.crop.circle" label="Profile and settings" onPress={() => router.push('/settings')} />
        </View>
      }
      footer={<Button testID="home-cta" title={cta.title} icon={cta.icon} onPress={cta.onPress} />}>
      <Pressable onPress={() => router.push('/settings')} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: -space.sm, marginBottom: space.lg }}>
        <Icon name="calendar" size={14} color={c.textMuted} />
        <T variant="subhead" color="textMuted">
          {countdown} · Goal {plan.target}
        </T>
      </Pressable>

      <Card testID="today-card">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm }}>
          <Eyebrow>Today’s plan</Eyebrow>
          <T variant="footnote" color={today.goalMet ? 'success' : 'textMuted'} weight="600">
            {today.minutes} of {today.goalMin} min
          </T>
        </View>
        <ProgressBar value={today.minutes / Math.max(1, today.goalMin)} color={today.goalMet ? c.success : c.primary} />
        <View style={{ marginTop: space.sm }}>
          <PlanRow
            testID="plan-daily5"
            icon="bolt"
            title="Daily 5"
            detail={today.daily5Done ? 'Done' : '3 min'}
            done={today.daily5Done}
            onPress={today.daily5Done ? undefined : () => startDaily5(ctx)}
          />
          <PlanRow
            testID="plan-review"
            icon="arrow.triangle.2.circlepath"
            title={due.length ? `${due.length} review${due.length === 1 ? '' : 's'} due` : 'No reviews due'}
            detail={due.length ? `${reviewMin} min` : 'Caught up'}
            done={due.length === 0 && attemptsCount > 0}
            onPress={due.length ? () => startReview(ctx) : undefined}
          />
          {weak ? (
            <PlanRow
              testID="plan-weak"
              icon="scope"
              title={`Weak spot: ${typeName(weak.type)}`}
              detail="5 questions"
              onPress={() => startDrill(ctx, { sections: [weak.section], types: [weak.type], difficulty: 'any', count: 5 }, typeName(weak.type))}
            />
          ) : null}
          {passage ? (
            <PlanRow
              testID="plan-passage"
              icon="doc.text"
              title={`Passage: ${passage.title}`}
              detail={`${passage.itemIds.length} questions`}
              onPress={() => startPassage(ctx, passage.id)}
            />
          ) : null}
        </View>
      </Card>

      <View style={{ height: space.lg }} />
      <Readiness exam={exam} />

      {(account.status === 'guest' || account.status === 'none') && attemptsCount >= 5 ? (
        <Pressable testID="backup-nudge" onPress={() => router.push('/account')} style={{ marginTop: space.lg }}>
          <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Icon name="icloud.and.arrow.up" size={22} color={c.primary} />
            <View style={{ flex: 1 }}>
              <T variant="callout" weight="600">
                Keep your progress safe
              </T>
              <T variant="footnote" color="textMuted">
                Sign in so your streak and reviews follow you to a new phone.
              </T>
            </View>
            <Icon name="chevron.right" size={12} color={c.textFaint} weight="semibold" />
          </Card>
        </Pressable>
      ) : null}
    </TabScreen>
  );
}
