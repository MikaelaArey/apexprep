// Quick Drill builder: choose sections, question types, difficulty and length.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { packFor } from '@/content';
import { EXAMS, SECTIONS, typeName } from '@/content/labels';
import type { SectionId } from '@/content/types';
import { drillPool, type DifficultyBand } from '@/engine/select';
import { startDrill } from '@/state/actions';
import { useExam, useSelectContext } from '@/state/derived';
import { Button, Chip, Eyebrow, IconButton } from '@/ui/kit';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const BANDS: { id: DifficultyBand; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'easy', label: 'Easier' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Harder' },
];
const LENGTHS = [5, 10, 15];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function Drill() {
  const c = useColors();
  const exam = useExam();
  const ctx = useSelectContext(exam);
  const [sections, setSections] = useState<SectionId[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyBand>('any');
  const [count, setCount] = useState(10);

  const availableTypes = useMemo(() => {
    const items = packFor(exam).items.filter((i) => sections.length === 0 || sections.includes(i.section));
    return [...new Set(items.map((i) => i.type))].sort((a, b) => typeName(a).localeCompare(typeName(b)));
  }, [exam, sections]);
  const activeTypes = types.filter((t) => availableTypes.includes(t));
  const pool = drillPool(ctx, { sections, types: activeTypes, difficulty });

  const start = () => {
    router.back();
    setTimeout(() => startDrill(ctx, { sections, types: activeTypes, difficulty, count }), 350);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.xl }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="title">Quick Drill</T>
            <IconButton testID="drill-close" icon="xmark" label="Close" onPress={() => router.back()} />
          </View>
          <T variant="subhead" color="textMuted" style={{ marginTop: 4 }}>
            Questions you haven’t seen come first, mixed across what you pick.
          </T>
        </View>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Sections</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="All" selected={sections.length === 0} onPress={() => setSections([])} />
            {EXAMS[exam].sections.map((s) => (
              <Chip key={s} testID={`drill-section-${s}`} label={SECTIONS[s].name} selected={sections.includes(s)} onPress={() => setSections(toggle(sections, s))} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Question types</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="All types" selected={activeTypes.length === 0} onPress={() => setTypes([])} />
            {availableTypes.map((t) => (
              <Chip key={t} testID={`drill-type-${t}`} label={typeName(t)} selected={activeTypes.includes(t)} onPress={() => setTypes(toggle(activeTypes, t))} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Difficulty</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {BANDS.map((b) => (
              <Chip key={b.id} label={b.label} selected={difficulty === b.id} onPress={() => setDifficulty(b.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Length</Eyebrow>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {LENGTHS.map((n) => (
              <Chip key={n} label={`${n} questions`} selected={count === n} onPress={() => setCount(n)} />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={{ padding: space.xl, paddingTop: space.md, gap: space.sm }}>
        <T variant="footnote" color="textMuted" align="center">
          {pool.length === 0 ? 'No questions match these filters yet.' : `${pool.length} question${pool.length === 1 ? '' : 's'} match`}
        </T>
        <Button testID="drill-start" title={`Start · ${Math.min(count, pool.length)} questions`} onPress={start} disabled={pool.length === 0} />
      </View>
    </View>
  );
}
