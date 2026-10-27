import { useMemo } from 'react';
import { View } from 'react-native';
import { itemMap, kpMap } from '@/content';
import { typeName } from '@/content/labels';
import { misconceptions } from '@/engine/select';
import { BUCKET_LABEL, bucketFor, type Bucket } from '@/engine/srs';
import { startRetry, startReview } from '@/state/actions';
import { useDueCards, useExam, useExamAttempts, useExamCards, useNow, useSelectContext } from '@/state/derived';
import { ExamSwitcher } from '@/ui/ExamSwitcher';
import { dueLabel } from '@/ui/format';
import { Button, Card, Empty, Eyebrow, ListRow, Pill, SectionTitle } from '@/ui/kit';
import { TabScreen } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const BUCKETS: Bucket[] = ['new', 'learning', 'reviewing', 'mastered'];

export default function Review() {
  const c = useColors();
  const exam = useExam();
  const ctx = useSelectContext(exam);
  const cards = useExamCards(exam);
  const due = useDueCards(exam);
  const attempts = useExamAttempts(exam);
  const now = useNow();
  const wrongButSure = useMemo(() => misconceptions(attempts), [attempts]);
  const counts = useMemo(() => {
    const m: Record<Bucket, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const card of cards) m[bucketFor(card.card)] += 1;
    return m;
  }, [cards]);
  const sorted = useMemo(() => [...cards].sort((a, b) => a.card.due - b.card.due), [cards]);
  const nextDue = sorted.find((card) => card.card.due > now);

  return (
    <TabScreen title="Review" right={<ExamSwitcher />}>
      <Card>
        <Eyebrow>Spaced review</Eyebrow>
        <T variant="title" style={{ marginTop: 6 }}>
          {due.length > 0 ? `${due.length} concept${due.length === 1 ? '' : 's'} due` : 'You’re caught up'}
        </T>
        <T variant="subhead" color="textMuted" style={{ marginTop: 4, marginBottom: space.lg }}>
          {due.length > 0
            ? 'Each one comes back as a fresh question when there is one, or as its concept card.'
            : nextDue
              ? `Next review: ${dueLabel(nextDue.card.due, now).toLowerCase()}.`
              : 'Concepts you miss, or answer unsure, land here automatically.'}
        </T>
        <Button testID="start-review" title={due.length ? `Start review · ${Math.max(1, Math.round(due.length * 0.4))} min` : 'Nothing due yet'} icon="arrow.triangle.2.circlepath" onPress={() => startReview(ctx)} disabled={due.length === 0} />
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        {BUCKETS.map((b) => (
          <Card key={b} style={{ flex: 1, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center' }} padded={false}>
            <T variant="title" style={{ fontVariant: ['tabular-nums'] }}>
              {counts[b]}
            </T>
            <T variant="caption" color="textMuted">
              {BUCKET_LABEL[b]}
            </T>
          </Card>
        ))}
      </View>

      {wrongButSure.length > 0 ? (
        <>
          <SectionTitle title="Confident mistakes" />
          <Card>
            <T variant="subhead" color="textMuted" style={{ marginBottom: space.sm }}>
              You marked these “Sure” and missed them. They’re the easiest mistakes to fix, so they come first.
            </T>
            {wrongButSure.slice(0, 5).map((a, i, all) => {
              const item = itemMap.get(a.itemId);
              return (
                <ListRow
                  key={a.id}
                  icon="exclamationmark.triangle"
                  iconColor={c.warning}
                  title={item ? typeName(item.type) : a.itemId}
                  subtitle={item?.stimulus?.slice(0, 70) ?? item?.prompt.slice(0, 70)}
                  last={i === all.length - 1}
                />
              );
            })}
            <Button
              testID="retry-misconceptions"
              kind="secondary"
              size="md"
              title={`Retry ${Math.min(10, wrongButSure.length)}`}
              onPress={() => startRetry(ctx, wrongButSure.slice(0, 10).map((a) => a.itemId), 'Confident mistakes')}
              style={{ marginTop: space.md }}
            />
          </Card>
        </>
      ) : null}

      <SectionTitle title="Your deck" />
      {sorted.length === 0 ? (
        <Card>
          <Empty icon="rectangle.stack" title="No concepts yet" body="Miss a question, or answer it unsure, and its key idea joins your deck." />
        </Card>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          {sorted.map((card, i) => {
            const kp = kpMap.get(card.kpId);
            const bucket = bucketFor(card.card);
            return (
              <ListRow
                key={card.kpId}
                title={kp?.title ?? card.kpId}
                subtitle={dueLabel(card.card.due, now)}
                right={<Pill label={BUCKET_LABEL[bucket]} tone={bucket === 'mastered' ? 'success' : bucket === 'learning' ? 'warning' : 'neutral'} />}
                last={i === sorted.length - 1}
              />
            );
          })}
        </Card>
      )}
    </TabScreen>
  );
}
