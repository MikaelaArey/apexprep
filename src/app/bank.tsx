// Question bank: every question in the current exam, ranked by difficulty within
// its section. Filter by section, level and status, then practice one question
// or the first ten on the list.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { packFor } from '@/content';
import { EXAMS, SECTIONS, typeName } from '@/content/labels';
import type { Difficulty, Item, SectionId } from '@/content/types';
import { LEVELS } from '@/engine/difficulty';
import { startBankQuestions } from '@/state/actions';
import { useExam, useExamAttempts, useSelectContext } from '@/state/derived';
import { Icon } from '@/ui/Icon';
import { Button, Chip, IconButton } from '@/ui/kit';
import { LevelMeter } from '@/ui/LevelMeter';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

type Status = 'all' | 'new' | 'missed' | 'correct';
const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'Not tried' },
  { id: 'missed', label: 'Missed' },
  { id: 'correct', label: 'Got right' },
];

function BankRow({ item, result, onPress }: { item: Item; result: boolean | undefined; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      testID={`bank-${item.id}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        alignItems: 'center',
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        backgroundColor: pressed ? c.cardPressed : c.card,
        borderBottomWidth: 0.5,
        borderBottomColor: c.border,
      })}>
      <View style={{ width: 52 }}>
        <T variant="caption" color="textFaint">
          {SECTIONS[item.section].short}
        </T>
        <T variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
          #{item.rank}
        </T>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <LevelMeter level={item.difficulty} compact />
          <T variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
            {typeName(item.type)}
          </T>
        </View>
        <T variant="subhead" numberOfLines={2}>
          {item.stimulus ?? item.prompt}
        </T>
      </View>
      <Icon
        name={result === undefined ? 'circle' : result ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
        size={18}
        color={result === undefined ? c.borderStrong : result ? c.success : c.danger}
      />
    </Pressable>
  );
}

export default function Bank() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const exam = useExam();
  const ctx = useSelectContext(exam);
  const attempts = useExamAttempts(exam);
  const items = packFor(exam).items;
  const [section, setSection] = useState<SectionId | 'all'>('all');
  const [level, setLevel] = useState<Difficulty | 0>(0);
  const [status, setStatus] = useState<Status>('all');
  const [hardestFirst, setHardestFirst] = useState(false);

  // Latest result per question.
  const latest = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const a of attempts) map.set(a.itemId, a.correct);
    return map;
  }, [attempts]);

  const sizes = useMemo(() => {
    const n: Partial<Record<SectionId, number>> = {};
    for (const i of items) n[i.section] = (n[i.section] ?? 0) + 1;
    return n;
  }, [items]);

  const list = useMemo(() => {
    const filtered = items.filter((i) => {
      if (section !== 'all' && i.section !== section) return false;
      if (level !== 0 && i.difficulty !== level) return false;
      const r = latest.get(i.id);
      if (status === 'new' && r !== undefined) return false;
      if (status === 'missed' && r !== false) return false;
      if (status === 'correct' && r !== true) return false;
      return true;
    });
    // Mixed sections sort by percentile so each section's ranking interleaves fairly.
    const key = (i: Item) => (section === 'all' ? i.rank / (sizes[i.section] ?? 1) : i.rank);
    return filtered.sort((a, b) => (hardestFirst ? key(b) - key(a) : key(a) - key(b)) || a.id.localeCompare(b.id));
  }, [items, section, level, status, latest, hardestFirst, sizes]);

  const practice = (ids: string[], title: string) => {
    if (ids.length) startBankQuestions(ctx, ids, title);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="title">Question bank</T>
          <IconButton testID="bank-close" icon="xmark" label="Close" onPress={() => router.back()} />
        </View>
        <T variant="subhead" color="textMuted">
          Ranked by difficulty within each section: #1 is the easiest. Levels run Warm-up, Easy, Medium, Hard and Boss (the hardest tenth).
        </T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Chip label="All" selected={section === 'all'} onPress={() => setSection('all')} />
        {EXAMS[exam].sections.map((s) => (
          <Chip key={s} testID={`bank-section-${s}`} label={SECTIONS[s].short} selected={section === s} onPress={() => setSection(s)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Chip label="Any level" selected={level === 0} onPress={() => setLevel(0)} />
        {([1, 2, 3, 4, 5] as Difficulty[]).map((l) => (
          <Chip key={l} testID={`bank-level-${l}`} label={LEVELS[l].name} icon={l === 5 ? 'crown.fill' : undefined} selected={level === l} onPress={() => setLevel(l)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
        {STATUSES.map((s) => (
          <Chip key={s.id} label={s.label} selected={status === s.id} onPress={() => setStatus(s.id)} />
        ))}
        <Chip
          testID="bank-sort"
          label={hardestFirst ? 'Hardest first' : 'Easiest first'}
          icon="arrow.up.arrow.down"
          selected={false}
          onPress={() => setHardestFirst(!hardestFirst)}
        />
      </ScrollView>
      <T variant="footnote" color="textMuted" style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        {list.length} question{list.length === 1 ? '' : 's'}
      </T>
      <FlatList
        testID="bank-list"
        data={list}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <BankRow item={item} result={latest.get(item.id)} onPress={() => practice([item.id], `${SECTIONS[item.section].short} #${item.rank}`)} />
        )}
        initialNumToRender={20}
        windowSize={8}
        ListEmptyComponent={
          <T variant="subhead" color="textMuted" align="center" style={{ padding: space.xxl }}>
            Nothing matches these filters yet.
          </T>
        }
      />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.bgGrouped }}>
        <Button
          testID="bank-practice"
          title={list.length ? `Practice the first ${Math.min(10, list.length)}` : 'Nothing to practice'}
          icon="play.fill"
          disabled={list.length === 0}
          onPress={() => practice(list.slice(0, 10).map((i) => i.id), 'Question bank')}
        />
      </View>
    </View>
  );
}
