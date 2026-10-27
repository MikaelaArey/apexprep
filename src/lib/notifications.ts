// Local reminders. At most one study reminder a day (plus a streak warning on
// the evening a streak is at risk), and they back off when ignored: reminders
// are pre-scheduled for days 0–3, 5, 7, 9 and 14 and rescheduled every time the
// app opens, so someone who stops opening the app stops hearing from it.

import * as Notifications from 'expo-notifications';
import type { Exam } from '@/content/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const BACKOFF_DAYS = [0, 1, 2, 3, 5, 7, 9, 14];
const COUNTDOWN_DAYS = [30, 14, 7, 1];

export async function hasPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function requestPermission(): Promise<boolean> {
  if (await hasPermission()) return true;
  const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return res.granted;
}

export interface ReminderPlan {
  enabled: boolean;
  hour: number;
  minute: number;
  exam: Exam;
  todayDone: boolean;
  streak: number;
  atRisk: boolean;
  weakest: string | null;
  dueCount: number;
  daysToTest: number | null;
}

function at(dayOffset: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function schedule(date: Date, title: string, body: string) {
  if (date.getTime() <= Date.now() + 60_000) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

export function reminderCopy(plan: ReminderPlan, dayOffset: number): { title: string; body: string } {
  if (dayOffset <= 1) {
    const focus = plan.weakest ? `Today's focus: ${plan.weakest}.` : 'Five questions, one quick win.';
    const due = plan.dueCount > 0 ? ` ${plan.dueCount} review${plan.dueCount === 1 ? ' is' : 's are'} due.` : '';
    return { title: 'Daily 5 · 3 min', body: focus + due };
  }
  return { title: 'Your plan is waiting', body: 'Pick up where you left off with a 3-minute Daily 5.' };
}

export async function scheduleReminders(plan: ReminderPlan): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!plan.enabled || !(await hasPermission())) return;

  for (const offset of BACKOFF_DAYS) {
    if (offset === 0 && plan.todayDone) continue;
    const { title, body } = reminderCopy(plan, offset);
    await schedule(at(offset, plan.hour, plan.minute), title, body);
  }

  if (plan.atRisk && plan.streak >= 3) {
    // 8:30 PM, or 90 minutes after an evening reminder.
    const warn = plan.hour >= 19 ? at(0, Math.min(22, plan.hour + 1), 30) : at(0, 20, 30);
    await schedule(warn, `Keep your ${plan.streak}-day streak`, 'One quick set of 5 questions keeps it going.');
  }

  if (plan.daysToTest !== null) {
    for (const d of COUNTDOWN_DAYS) {
      const offset = plan.daysToTest - d;
      if (offset < 1) continue;
      const body = d === 1 ? 'Rest up. A light review is plenty today.' : "Open ApexPrep for today's plan.";
      await schedule(at(offset, plan.hour, plan.minute), `${d} day${d === 1 ? '' : 's'} to your ${plan.exam}`, body);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: { title: 'Your week in review', body: 'See your wins, your weak spots and next week’s plan.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
  });
}
