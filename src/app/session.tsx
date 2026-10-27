// The study session: runs the task list, then shows the summary.

import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { itemMap } from '@/content';
import { buildDaily5 } from '@/engine/select';
import { useSelectContext } from '@/state/derived';
import { useStore } from '@/state/store';
import { CardTask } from '@/session/CardTask';
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
  const ctx = useSelectContext(session?.exam ?? summary?.exam ?? 'LSAT');
  const [seenPassages, setSeenPassages] = useState<ReadonlySet<string>>(new Set());

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
      return (
        <Summary
          summary={summary}
          onKeepGoing={() => {
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
  if (task.kind === 'card') {
    return <CardTask key={`${session.id}:${session.index}`} kpId={task.kpId} index={session.index} total={session.tasks.length} onClose={close} />;
  }
  return (
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
  );
}
