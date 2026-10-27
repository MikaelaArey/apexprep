// First run: exam, test date, target, daily goal and a study cue. Forming an
// if-then plan ("When I'm on my commute, I'll do my Daily 5") is one of the
// best-supported habit techniques, so the cue step is part of setup.

import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXAMS } from '@/content/labels';
import type { Exam } from '@/content/types';
import { DEFAULT_SETTINGS } from '@/data/types';
import { dayKey } from '@/engine/time';
import { haptic } from '@/lib/haptics';
import { requestPermission } from '@/lib/notifications';
import { useStore } from '@/state/store';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, Card, Chip, IconButton } from '@/ui/kit';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const STEPS = 6;
const CUES = ['On my commute', 'With morning coffee', 'On my lunch break', 'Before bed'];
const GOALS = [
  { min: 5, label: '5 min', note: 'A Daily 5, every day' },
  { min: 10, label: '10 min', note: 'Daily 5 plus reviews' },
  { min: 20, label: '20 min', note: 'Steady progress' },
  { min: 30, label: '30 min', note: 'Serious push' },
];
const TARGETS: Record<Exam, number[]> = { LSAT: [160, 165, 170, 175], MCAT: [505, 510, 515, 520] };

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="headline">{title}</T>
        <T variant="subhead" color="textMuted" style={{ marginTop: 2 }}>
          {body}
        </T>
      </View>
    </View>
  );
}

function ExamCard({ exam, selected, onPress }: { exam: Exam; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const info = EXAMS[exam];
  return (
    <Pressable testID={`pick-${exam}`} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <Card style={[{ gap: 6 }, selected && { borderColor: c.primary, borderWidth: 2, backgroundColor: c.primarySoft }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="title">{info.name}</T>
          <Icon name={selected ? 'checkmark.circle.fill' : 'circle'} size={22} color={selected ? c.primary : c.borderStrong} />
        </View>
        <T variant="subhead" color="textMuted">
          {info.full}
        </T>
        <T variant="footnote" color="textMuted">
          {exam === 'LSAT'
            ? 'Logical Reasoning and Reading Comprehension, as on today’s test.'
            : 'Chem/Phys, CARS, Bio/Biochem and Psych/Soc.'}
        </T>
      </Card>
    </Pressable>
  );
}

export default function Onboarding() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const updateSettings = useStore((s) => s.updateSettings);
  const [step, setStep] = useState(0);
  const [exam, setExam] = useState<Exam>('LSAT');
  const [testDate, setTestDate] = useState<Date | null>(null);
  const [target, setTarget] = useState<Record<Exam, number>>({ LSAT: 165, MCAT: 510 });
  const [goal, setGoal] = useState(10);
  const [cue, setCue] = useState(CUES[0]);
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const info = EXAMS[exam];

  const finish = async (reminders: boolean) => {
    const granted = reminders ? await requestPermission() : false;
    updateSettings({
      onboarded: true,
      exam,
      plans: {
        ...DEFAULT_SETTINGS.plans,
        [exam]: { testDate: testDate ? dayKey(testDate.getTime()) : null, target: target[exam] },
        [exam === 'LSAT' ? 'MCAT' : 'LSAT']: DEFAULT_SETTINGS.plans[exam === 'LSAT' ? 'MCAT' : 'LSAT'],
      },
      dailyGoalMin: goal,
      cue,
      reminder: { enabled: granted, hour: time.getHours(), minute: time.getMinutes() },
    });
  };

  const next = () => {
    haptic.tap();
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const timeLabel = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  let body: React.ReactNode;
  let footer: React.ReactNode = <Button testID="onboarding-next" title="Continue" onPress={next} />;

  if (step === 0) {
    body = (
      <View style={{ gap: space.xxl }}>
        <View style={{ gap: space.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mountain.2.fill" size={28} color={c.onPrimary} />
          </View>
          <T variant="largeTitle" style={{ marginTop: space.lg }}>
            ApexPrep
          </T>
          <T variant="title" weight="600" color="textMuted">
            MCAT and LSAT practice built for two-minute gaps.
          </T>
        </View>
        <View style={{ gap: space.xl }}>
          <Feature icon="bolt.fill" title="A Daily 5 in about 3 minutes" body="Reviews, your weakest skill and something new, picked for you." />
          <Feature icon="text.magnifyingglass" title="Every answer explained" body="Why the right answer works, and the exact trap behind each wrong one." />
          <Feature icon="calendar.badge.clock" title="Review that knows your test date" body="Missed ideas come back on a schedule timed to your exam day." />
        </View>
      </View>
    );
    footer = <Button testID="onboarding-start" title="Get started" onPress={next} />;
  } else if (step === 1) {
    body = (
      <View style={{ gap: space.lg }}>
        <T variant="largeTitle">What are you studying for?</T>
        <T variant="subhead" color="textMuted">
          You can switch exams any time.
        </T>
        <ExamCard exam="LSAT" selected={exam === 'LSAT'} onPress={() => setExam('LSAT')} />
        <ExamCard exam="MCAT" selected={exam === 'MCAT'} onPress={() => setExam('MCAT')} />
      </View>
    );
  } else if (step === 2) {
    body = (
      <View style={{ gap: space.lg }}>
        <T variant="largeTitle">When is your {info.name}?</T>
        <T variant="subhead" color="textMuted">
          Review is scheduled so everything comes back before test day.
        </T>
        <Card padded={false} style={{ padding: space.sm }}>
          <Host matchContents>
            <DatePicker
              selection={testDate ?? tomorrow}
              range={{ start: tomorrow }}
              displayedComponents={['date']}
              onDateChange={(d) => setTestDate(d)}
              modifiers={[datePickerStyle('graphical'), tint(c.primary)]}
            />
          </Host>
        </Card>
        <T variant="callout" weight="600" align="center">
          {testDate ? testDate.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'No date picked yet'}
        </T>
      </View>
    );
    footer = (
      <View style={{ gap: space.md }}>
        <Button testID="onboarding-next" title="Continue" onPress={next} disabled={!testDate} />
        <Button
          testID="no-test-date"
          kind="ghost"
          title="I haven’t booked it yet"
          onPress={() => {
            setTestDate(null);
            next();
          }}
        />
      </View>
    );
  } else if (step === 3) {
    const t = target[exam];
    const set = (v: number) => setTarget({ ...target, [exam]: Math.max(info.score.min, Math.min(info.score.max, v)) });
    body = (
      <View style={{ gap: space.lg }}>
        <T variant="largeTitle">What score are you aiming for?</T>
        <T variant="subhead" color="textMuted">
          {info.name} scores run from {info.score.min} to {info.score.max}.
        </T>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.xl }}>
          <IconButton testID="target-down" icon="minus" label="Lower target" onPress={() => set(t - 1)} />
          <T variant="largeTitle" style={{ fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] }} testID="target-value">
            {t}
          </T>
          <IconButton testID="target-up" icon="plus" label="Raise target" onPress={() => set(t + 1)} />
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' }}>
          {TARGETS[exam].map((v) => (
            <Chip key={v} label={String(v)} selected={t === v} onPress={() => set(v)} />
          ))}
        </View>
      </View>
    );
  } else if (step === 4) {
    body = (
      <View style={{ gap: space.lg }}>
        <T variant="largeTitle">How much time a day?</T>
        <T variant="subhead" color="textMuted">
          Small and steady beats long and rare. You can change this later.
        </T>
        {GOALS.map((g) => (
          <Pressable key={g.min} testID={`goal-${g.min}`} onPress={() => setGoal(g.min)}>
            <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, goal === g.min && { borderColor: c.primary, borderWidth: 2, backgroundColor: c.primarySoft }]}>
              <View style={{ flex: 1 }}>
                <T variant="headline">{g.label}</T>
                <T variant="subhead" color="textMuted">
                  {g.note}
                </T>
              </View>
              <Icon name={goal === g.min ? 'checkmark.circle.fill' : 'circle'} size={22} color={goal === g.min ? c.primary : c.borderStrong} />
            </Card>
          </Pressable>
        ))}
      </View>
    );
  } else {
    body = (
      <View style={{ gap: space.lg }}>
        <T variant="largeTitle">When will you study?</T>
        <T variant="subhead" color="textMuted">
          Tie practice to something you already do every day.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CUES.map((x) => (
            <Chip key={x} label={x} selected={cue === x} onPress={() => setCue(x)} />
          ))}
        </View>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="headline">Around</T>
          <Host matchContents>
            <DatePicker
              selection={time}
              displayedComponents={['hourAndMinute']}
              onDateChange={(d) => setTime(d)}
              modifiers={[datePickerStyle('compact'), tint(c.primary)]}
            />
          </Host>
        </Card>
        <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft }}>
          <T variant="callout" weight="600" color="primary">
            “{cue} at about {timeLabel}, I’ll do my Daily 5.”
          </T>
        </View>
        <T variant="footnote" color="textMuted">
          ApexPrep can remind you once a day at that time, and never more than that.
        </T>
      </View>
    );
    footer = (
      <View style={{ gap: space.md }}>
        <Button testID="enable-reminders" title="Remind me at this time" icon="bell.fill" onPress={() => finish(true)} />
        <Button testID="skip-reminders" kind="ghost" title="Not now" onPress={() => finish(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped, paddingTop: insets.top }}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm }}>
        {step > 0 ? <IconButton testID="onboarding-back" icon="chevron.left" label="Back" onPress={back} /> : <View style={{ width: 40 }} />}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.primary : c.borderStrong }} />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}>{body}</ScrollView>
      <View style={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.md, paddingTop: space.sm }}>{footer}</View>
    </View>
  );
}

