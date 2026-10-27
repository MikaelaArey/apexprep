// Settings: plan, reminders, study options, account and about.

import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, tint } from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXAMS } from '@/content/labels';
import type { Exam } from '@/content/types';
import { dayKey, parseDay } from '@/engine/time';
import { refreshReminders } from '@/lib/lifecycle';
import { requestPermission } from '@/lib/notifications';
import { isSyncConfigured } from '@/lib/supabase';
import { useStore } from '@/state/store';
import { useAccount } from '@/sync/account';
import { loadDemoHistory } from '@/dev/demo';
import { Icon } from '@/ui/Icon';
import { Card, Chip, Eyebrow, IconButton } from '@/ui/kit';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const GOALS = [5, 10, 20, 30];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Group({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ paddingHorizontal: space.xs }}>
        <Eyebrow>{title}</Eyebrow>
      </View>
      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        {children}
      </Card>
      {note ? (
        <T variant="footnote" color="textMuted" style={{ paddingHorizontal: space.xs }}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

function Row({
  label,
  children,
  last,
  onPress,
  testID,
  stacked,
}: {
  label: string;
  children?: ReactNode;
  last?: boolean;
  onPress?: () => void;
  testID?: string;
  stacked?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        gap: stacked ? space.sm : space.md,
        paddingVertical: space.sm,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: c.border,
        opacity: pressed && onPress ? 0.6 : 1,
      })}>
      <T variant="callout" style={stacked ? undefined : { flex: 1 }}>
        {label}
      </T>
      {children}
      {onPress ? <Icon name="chevron.right" size={12} color={c.textFaint} weight="semibold" /> : null}
    </Pressable>
  );
}

export default function Settings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const resetProgress = useStore((s) => s.resetProgress);
  const lastSyncAt = useStore((s) => s.meta.lastSyncAt as number | undefined);
  const account = useAccount();
  const [scheduled, setScheduled] = useState<number | null>(null);
  useEffect(() => {
    if (__DEV__) Notifications.getAllScheduledNotificationsAsync().then((n) => setScheduled(n.length)).catch(() => setScheduled(null));
  }, [settings.reminder]);
  const exam = settings.exam;
  const plan = settings.plans[exam];
  const info = EXAMS[exam];

  const setPlan = (patch: Partial<typeof plan>) => {
    update({ plans: { ...settings.plans, [exam]: { ...plan, ...patch } } });
    setTimeout(refreshReminders, 0);
  };
  const setReminder = async (enabled: boolean) => {
    if (enabled && !(await requestPermission())) {
      Alert.alert('Notifications are off', 'Turn on notifications for ApexPrep in the Settings app to get reminders.');
      return;
    }
    update({ reminder: { ...settings.reminder, enabled } });
    setTimeout(refreshReminders, 0);
  };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const reminderTime = new Date();
  reminderTime.setHours(settings.reminder.hour, settings.reminder.minute, 0, 0);

  const accountLabel =
    account.status === 'member'
      ? account.email ?? (account.provider === 'apple' ? 'Signed in with Apple' : 'Signed in')
      : account.status === 'guest'
        ? 'Guest (not signed in)'
        : account.status === 'unavailable'
          ? 'Not set up'
          : 'Not signed in';

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <T variant="title">Settings</T>
        <IconButton testID="settings-close" icon="xmark" label="Close settings" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xxl, paddingBottom: insets.bottom + space.xxxl }}>
        <Group title="Exam and plan">
          <Row label="Studying for">
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {(['LSAT', 'MCAT'] as Exam[]).map((e) => (
                <Chip key={e} testID={`settings-exam-${e}`} label={e} selected={exam === e} onPress={() => update({ exam: e })} />
              ))}
            </View>
          </Row>
          <Row label="Test date">
            {plan.testDate ? (
              <Host matchContents>
                <DatePicker
                  selection={parseDay(plan.testDate)}
                  range={{ start: tomorrow }}
                  displayedComponents={['date']}
                  onDateChange={(d) => setPlan({ testDate: dayKey(d.getTime()) })}
                  modifiers={[datePickerStyle('compact'), tint(c.primary)]}
                />
              </Host>
            ) : (
              <Chip label="Set date" selected={false} onPress={() => setPlan({ testDate: dayKey(tomorrow.getTime() + 60 * 86400000) })} />
            )}
          </Row>
          {plan.testDate ? <Row label="Clear test date" onPress={() => setPlan({ testDate: null })} /> : null}
          <Row label={`Target score (${info.score.min}–${info.score.max})`} last>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <IconButton icon="minus" label="Lower target" onPress={() => setPlan({ target: Math.max(info.score.min, plan.target - 1) })} />
              <T variant="headline" style={{ minWidth: 40, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                {plan.target}
              </T>
              <IconButton icon="plus" label="Raise target" onPress={() => setPlan({ target: Math.min(info.score.max, plan.target + 1) })} />
            </View>
          </Row>
        </Group>

        <Group title="Daily habit" note="Reminders back off if you stop opening the app, and stop after two weeks.">
          <Row label="Daily goal" stacked>
            <View style={{ flexDirection: 'row', gap: space.sm, paddingBottom: space.xs }}>
              {GOALS.map((g) => (
                <Chip key={g} testID={`goal-${g}`} label={`${g} min`} selected={settings.dailyGoalMin === g} onPress={() => update({ dailyGoalMin: g })} />
              ))}
            </View>
          </Row>
          <Row label="Daily reminder">
            <Switch testID="reminder-switch" value={settings.reminder.enabled} onValueChange={setReminder} trackColor={{ true: c.primary }} />
          </Row>
          {settings.reminder.enabled ? (
            <Row label="Reminder time">
              <Host matchContents>
                <DatePicker
                  selection={reminderTime}
                  displayedComponents={['hourAndMinute']}
                  onDateChange={(d) => {
                    update({ reminder: { ...settings.reminder, hour: d.getHours(), minute: d.getMinutes() } });
                    setTimeout(refreshReminders, 0);
                  }}
                  modifiers={[datePickerStyle('compact'), tint(c.primary)]}
                />
              </Host>
            </Row>
          ) : null}
          <Row label="Rest day" last onPress={() => router.push('/streak')}>
            <T variant="callout" color="textMuted">
              {settings.restDay === null ? 'None' : DAYS[settings.restDay]}
            </T>
          </Row>
        </Group>

        <Group title="Studying" note="Pure Study hides XP, levels and celebrations, and keeps everything else.">
          <Row label="Ask how sure I am">
            <Switch testID="confidence-switch" value={settings.confidence} onValueChange={(v) => update({ confidence: v })} trackColor={{ true: c.primary }} />
          </Row>
          <Row label="Pure Study">
            <Switch testID="pure-switch" value={settings.pureStudy} onValueChange={(v) => update({ pureStudy: v })} trackColor={{ true: c.primary }} />
          </Row>
          <Row label="Haptics" last>
            <Switch value={settings.haptics} onValueChange={(v) => update({ haptics: v })} trackColor={{ true: c.primary }} />
          </Row>
        </Group>

        <Group title="Account">
          <Row testID="account-row" label="Account" onPress={() => router.push('/account')}>
            <T variant="callout" color="textMuted" numberOfLines={1} style={{ maxWidth: 190 }}>
              {accountLabel}
            </T>
          </Row>
          <Row label="Last backup" last>
            <T variant="callout" color="textMuted">
              {!isSyncConfigured ? 'Off in this build' : lastSyncAt ? new Date(lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'}
            </T>
          </Row>
        </Group>

        <Group
          title="About"
          note={`ApexPrep’s questions are original practice items, not official test content. MCAT® is a registered trademark of the AAMC and LSAT® is a registered trademark of LSAC; neither is affiliated with or endorses ApexPrep.`}>
          <Row label="Version" last>
            <T variant="callout" color="textMuted">
              {Constants.expoConfig?.version ?? '0.1.0'}
            </T>
          </Row>
        </Group>

        {__DEV__ ? (
          <Group title="Developer" note="Only in development builds.">
            <Row testID="dev-scheduled" label="Scheduled reminders">
              <T variant="callout" color="textMuted">
                {scheduled ?? '—'}
              </T>
            </Row>
            <Row
              testID="dev-demo"
              label="Load 3 weeks of demo history"
              onPress={async () => {
                await loadDemoHistory(exam);
                router.back();
              }}
            />
            <Row testID="dev-onboarding" label="Show onboarding again" onPress={() => update({ onboarded: false })} />
            <Row
              testID="dev-reset"
              label="Erase all progress"
              last
              onPress={() =>
                Alert.alert('Erase all progress?', 'This deletes every answer, card and setting on this device.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Erase', style: 'destructive', onPress: () => resetProgress() },
                ])
              }
            />
          </Group>
        ) : null}
      </ScrollView>
    </View>
  );
}
