import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { packFor } from '@/content';
import { EXAMS, SECTIONS } from '@/content/labels';
import { passageProgress } from '@/engine/select';
import { startDaily5, startDrill, startPassage } from '@/state/actions';
import { useExam, useExamAttempts, useSelectContext } from '@/state/derived';
import { ExamBadge } from '@/ui/ExamBadge';
import { Icon, type IconName } from '@/ui/Icon';
import { Card, Eyebrow, ListRow, Pill, ProgressBar, SectionTitle } from '@/ui/kit';
import { TabScreen } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

function ModeCard({
  icon,
  title,
  body,
  meta,
  onPress,
  testID,
  primary,
}: {
  icon: IconName;
  title: string;
  body: string;
  meta: string;
  onPress: () => void;
  testID?: string;
  primary?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
      <Card style={[{ flex: 1, minHeight: 150, justifyContent: 'space-between' }, primary && { backgroundColor: c.primary, borderColor: c.primary }]}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primary ? 'rgba(255,255,255,0.18)' : c.primarySoft,
          }}>
          <Icon name={icon} size={18} color={primary ? c.onPrimary : c.primary} />
        </View>
        <View style={{ marginTop: space.md }}>
          <T variant="headline" color={primary ? 'onPrimary' : 'text'}>
            {title}
          </T>
          <T variant="footnote" color={primary ? 'onPrimary' : 'textMuted'} style={{ marginTop: 2, opacity: primary ? 0.85 : 1 }}>
            {body}
          </T>
          <T variant="caption" color={primary ? 'onPrimary' : 'textFaint'} style={{ marginTop: 6, opacity: primary ? 0.85 : 1 }}>
            {meta}
          </T>
        </View>
      </Card>
    </Pressable>
  );
}

export default function Practice() {
  const c = useColors();
  const exam = useExam();
  const ctx = useSelectContext(exam);
  const attempts = useExamAttempts(exam);
  const pack = packFor(exam);
  const passages = useMemo(() => passageProgress(ctx), [ctx]);
  const seen = useMemo(() => new Set(attempts.map((a) => a.itemId)), [attempts]);

  return (
    <TabScreen title="Practice" right={<ExamBadge />}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <ModeCard
          testID="mode-daily5"
          primary
          icon="bolt.fill"
          title="Daily 5"
          body="Reviews, your weak spot and something new."
          meta="2–3 min"
          onPress={() => startDaily5(ctx)}
        />
        <ModeCard
          testID="mode-drill"
          icon="slider.horizontal.3"
          title="Quick Drill"
          body="Pick a section, question type and length."
          meta="5–15 min"
          onPress={() => router.push('/drill')}
        />
      </View>

      <SectionTitle title="Passages" />
      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        {passages.map((p, i) => (
          <Pressable
            key={p.passage.id}
            testID={`passage-${p.passage.id}`}
            onPress={() => startPassage(ctx, p.passage.id)}
            style={({ pressed }) => ({
              paddingVertical: space.md,
              gap: 6,
              opacity: pressed ? 0.6 : 1,
              borderBottomWidth: i === passages.length - 1 ? 0 : 0.5,
              borderBottomColor: c.border,
            })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Pill label={SECTIONS[p.passage.section].short} tone="primary" />
              {p.passage.mini ? <Pill label="Mini" /> : null}
              <T variant="footnote" color="textMuted" style={{ marginLeft: 'auto' }}>
                {p.answered}/{p.total} answered
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T variant="callout" weight="600" style={{ flex: 1 }}>
                {p.passage.title}
              </T>
              <Icon name="chevron.right" size={12} color={c.textFaint} weight="semibold" />
            </View>
            <ProgressBar value={p.answered / p.total} height={4} />
          </Pressable>
        ))}
      </Card>

      <SectionTitle title="By section" />
      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        {EXAMS[exam].sections.map((section, i, all) => {
          const items = pack.items.filter((it) => it.section === section);
          const done = items.filter((it) => seen.has(it.id)).length;
          return (
            <ListRow
              key={section}
              testID={`section-${section}`}
              icon="square.stack.3d.up"
              title={SECTIONS[section].name}
              subtitle={`${done} of ${items.length} questions answered`}
              onPress={() => startDrill(ctx, { sections: [section], types: [], difficulty: 'any', count: 10 })}
              last={i === all.length - 1}
            />
          );
        })}
      </Card>

      <View style={{ marginTop: space.xxl, paddingHorizontal: space.xs }}>
        <Eyebrow>About the questions</Eyebrow>
        <T variant="footnote" color="textMuted" style={{ marginTop: 6 }}>
          ApexPrep’s questions are original practice items written to match the {exam}’s format. They are not official{' '}
          {exam === 'LSAT' ? 'LSAC' : 'AAMC'} questions.
        </T>
      </View>
    </TabScreen>
  );
}
