// The study session: runs the task list, then shows the summary.

import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { itemMap } from '@/content';
import type { Exam, SectionId } from '@/content/types';
import { buildDaily5 } from '@/engine/select';
import { climbSpec } from '@/state/actions';
import { useSelectContext, useXp } from '@/state/derived';
import { floorsByExam, useBadges } from '@/state/gamification';
import { useStore } from '@/state/store';
import { CardTask } from '@/session/CardTask';
import { Celebrations } from '@/session/Celebrations';
import { QuestionTask } from '@/session/QuestionTask';
import { Summary } from '@/session/Summary';
import { refreshReminders } from '@/lib/lifecycle';
import { syncNow } from '@/sync/sync';
import { useColors } from '@/ui/theme';

export default function SessionScreen() {
  const c = useColors();
  const session = useStore((s) => s.session);
  const summary = useStore((s) => s.lastSummary);
  const finishSession = useStore((s) => s.finishSession);
  const abandonSession = useStore((s) => s.abandonSession);
  const startSession = useStore((s) => s.startSession);
  const settingsExam = useStore((s) => s.settings.exam);
  const pure = useStore((s) => s.settings.pureStudy);
  const exam: Exam = session?.exam ?? summary?.exam ?? settingsExam;
  const ctx = useSelectContext(exam);
  const [seenPassages, setSeenPassages] = useState<ReadonlySet<string>>(new Set());

  // Badges and levels earned since this screen opened, for the summary.
  const badges = useBadges(exam);
  const [startKeys] = useState(() => new Set(badges.filter((b) => b.tier > 0).map((b) => b.key)));
  const earned = useMemo(() => badges.filter((b) => b.tier > 0 && !startKeys.has(b.key)), [badges, startKeys]);
  const xp = useXp();
  const [startLevel] = useState(xp.level);

  // After a Climb floor: the next floor if it was cleared, else the same one again.
  const nextFloor = useMemo(() => {
    if (!summary?.climb) return null;
    const section = summary.climb.key.split(':')[1] as SectionId;
    const floors = floorsByExam(summary.exam)[section] ?? [];
    const floor = floors[summary.climb.cleared ? summary.climb.floor + 1 : summary.climb.floor];
    return floor ? { section, floor } : null;
  }, [summary]);

  const finished = session !== null && session.index >= session.tasks.length;
  useEffect(() => {
    if (finished) {
      finishSession();
      refreshReminders();
      syncNow().catch(() => undefined);
    }
  }, [finished, finishSession]);

  if (!session) {
    if (summary) {
      const climbing = Boolean(summary.climb);
      return (
        <Summary
          summary={summary}
          earned={earned}
          levelUp={xp.level > startLevel ? xp.level : null}
          keepGoingLabel={climbing ? (nextFloor ? (summary.climb?.cleared ? `Next: Floor ${nextFloor.floor.index + 1}` : 'Try this floor again') : null) : 'Keep going · 5 more'}
          onKeepGoing={() => {
            if (climbing) {
              if (nextFloor) startSession(climbSpec(ctx, nextFloor.section, nextFloor.floor));
              return;
            }
            const ids = buildDaily5(ctx);
            if (ids.length) startSession({ kind: 'daily5', exam: ctx.exam, title: 'Daily 5', tasks: ids.map((itemId) => ({ kind: 'question', itemId })) });
          }}
        />
      );
    }
    return <Redirect href="/" />;
  }
  if (finished) return <View style={{ flex: 1, backgroundColor: c.bgGrouped }} />;

  const close = () => {
    const answered = session.results.length > 0 || session.current !== null;
    Alert.alert('End this session?', answered ? 'Your answers so far are saved.' : 'You haven’t answered anything yet.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End session',
        style: 'destructive',
        onPress: () => {
          if (session.current) useStore.getState().completeQuestion(0);
          if (useStore.getState().session?.results.length) {
            finishSession();
            refreshReminders();
          } else {
            abandonSession();
            router.back();
          }
        },
      },
    ]);
  };

  const task = session.tasks[session.index];
  return (
    <View style={{ flex: 1 }}>
      {task.kind === 'card' ? (
        <CardTask key={`${session.id}:${session.index}`} kpId={task.kpId} index={session.index} total={session.tasks.length} onClose={close} />
      ) : (
        <QuestionTask
          key={`${session.id}:${session.index}`}
          itemId={task.itemId}
          index={session.index}
          total={session.tasks.length}
          isReview={Boolean(task.reviewKp)}
          passageSeen={seenPassages.has(itemMap.get(task.itemId)?.passageId ?? '')}
          onPassageSeen={(id) => setSeenPassages((prev) => new Set([...prev, id]))}
          onClose={close}
        />
      )}
      {!pure ? <Celebrations exam={exam} /> : null}
    </View>
  );
}
