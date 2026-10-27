// Log or edit a test score. MCAT scores are entered by section (118–132 each)
// and the total adds itself up; you can also enter just a total.

import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SECTIONS } from '@/content/labels';
import type { SectionId } from '@/content/types';
import type { ScoreEntry } from '@/data/types';
import { uuidv7 } from '@/engine/ids';
import { SCORE_RULES, scoreTrend, totalFromSections, validateScore } from '@/engine/scores';
import { dayKey, parseDay } from '@/engine/time';
import { useExam } from '@/state/derived';
import { useStore } from '@/state/store';
import { Button, Card, Chip, Eyebrow, IconButton } from '@/ui/kit';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

function Stepper({ label, value, min, max, onChange, testID }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52 }}>
      <T variant="callout" style={{ flex: 1 }}>
        {label}
      </T>
      <IconButton testID={testID ? `${testID}-minus` : undefined} icon="minus" label={`Lower ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
      <T testID={testID ? `${testID}-value` : undefined} variant="headline" style={{ minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
      <IconButton testID={testID ? `${testID}-plus` : undefined} icon="plus" label={`Raise ${label}`} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}

export default function ScoreEdit() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const exam = useExam();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const scores = useStore((s) => s.settings.scores);
  const saveScore = useStore((s) => s.saveScore);
  const deleteScore = useStore((s) => s.deleteScore);
  const setMeta = useStore((s) => s.setMeta);
  const target = useStore((s) => s.settings.plans[exam].target);
  const existing = id ? scores.find((e) => e.id === id) : undefined;
  const rules = SCORE_RULES[exam];
  const mid = rules.section ? Math.round((rules.section.min + rules.section.max) / 2) : 0;

  const [kind, setKind] = useState<ScoreEntry['kind']>(existing?.kind ?? 'practice');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [date, setDate] = useState(() => (existing ? parseDay(existing.date) : new Date()));
  const [sections, setSections] = useState<Partial<Record<SectionId, number>>>(
    () => existing?.sections ?? Object.fromEntries(rules.sections.map((s) => [s, mid])),
  );
  const [totalOnly, setTotalOnly] = useState(rules.sections.length === 0 || (existing ? !existing.sections : false));
  const [total, setTotal] = useState(existing?.total ?? Math.round((rules.total.min + rules.total.max) / 2));

  const shownTotal = totalOnly ? total : (totalFromSections(exam, sections) ?? total);

  const save = () => {
    const entry: ScoreEntry = {
      id: existing?.id ?? uuidv7(),
      exam,
      date: dayKey(date.getTime()),
      kind,
      label: label.trim(),
      total: shownTotal,
      sections: totalOnly ? null : sections,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    const error = validateScore(entry, dayKey(Date.now()));
    if (error) {
      Alert.alert('Check this score', error);
      return;
    }
    const before = scoreTrend(scores.filter((e) => e.id !== entry.id), exam, target);
    saveScore(entry);
    if (before.best && entry.total > before.best.total) setMeta('scoreCelebrate', { id: entry.id, change: entry.total - before.best.total });
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete this score?', 'It will be removed from your score history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (existing) deleteScore(existing.id);
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <T variant="title">{existing ? 'Edit score' : 'Log a score'}</T>
        <IconButton testID="score-edit-close" icon="xmark" label="Cancel" onPress={() => router.back()} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: insets.bottom + 140 }}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>Test</Eyebrow>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip testID="score-kind-practice" label="Practice test" selected={kind === 'practice'} onPress={() => setKind('practice')} />
            <Chip testID="score-kind-official" label={`Official ${exam}`} selected={kind === 'official'} onPress={() => setKind('official')} />
          </View>
          <TextInput
            testID="score-label"
            value={label}
            onChangeText={setLabel}
            placeholder={exam === 'MCAT' ? 'Name (optional), e.g. AAMC Full-Length 1' : 'Name (optional), e.g. PrepTest 140'}
            placeholderTextColor={c.textFaint}
            maxLength={60}
            style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: space.md, fontSize: 16, color: c.text }}
          />
        </View>

        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52 }}>
            <T variant="callout" style={{ flex: 1 }}>
              Date taken
            </T>
            <Host matchContents>
              <DatePicker
                selection={date}
                range={{ end: new Date() }}
                displayedComponents={['date']}
                onDateChange={setDate}
                modifiers={[datePickerStyle('compact'), tint(c.primary)]}
              />
            </Host>
          </View>
        </Card>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Score</Eyebrow>
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {rules.sections.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 0.5, borderBottomColor: c.border }}>
                <T variant="callout" style={{ flex: 1 }}>
                  I only know my total
                </T>
                <Switch testID="score-total-only" value={totalOnly} onValueChange={setTotalOnly} trackColor={{ true: c.primary }} />
              </View>
            ) : null}
            {totalOnly || !rules.section
              ? (
                  <Stepper testID="score-total" label={`Total (${rules.total.min}–${rules.total.max})`} value={total} min={rules.total.min} max={rules.total.max} onChange={setTotal} />
                )
              : rules.sections.map((s) => (
                  <Stepper
                    key={s}
                    testID={`score-${s}`}
                    label={SECTIONS[s].name}
                    value={sections[s] ?? mid}
                    min={rules.section!.min}
                    max={rules.section!.max}
                    onChange={(v) => setSections({ ...sections, [s]: v })}
                  />
                ))}
          </Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space.xs }}>
            <T variant="footnote" color="textMuted">
              {totalOnly ? 'Total score' : 'Total (sum of sections)'}
            </T>
            <T testID="score-total-display" variant="title" style={{ fontVariant: ['tabular-nums'] }}>
              {shownTotal}
            </T>
          </View>
        </View>
        {existing ? <Button testID="score-delete" kind="danger" title="Delete score" icon="trash" onPress={remove} /> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.bgGrouped }}>
        <Button testID="score-save" title="Save score" icon="checkmark" onPress={save} />
      </View>
    </View>
  );
}
