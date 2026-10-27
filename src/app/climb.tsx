// The Climb: each section's questions from easiest to hardest, one floor at a
// time. Sprout stands on the floor you're up to; camps group every five floors,
// and the last floor of each camp is a checkpoint. Floors holding the section's
// hardest questions are boss floors.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SECTIONS } from '@/content/labels';
import type { SectionId } from '@/content/types';
import { campName, FLOOR_SIZE, neededToClear, PASS_RATE, type Floor } from '@/engine/climb';
import { LEVELS } from '@/engine/difficulty';
import { startClimb } from '@/state/actions';
import { useExam, useSelectContext } from '@/state/derived';
import { useClimb, useSproutStage } from '@/state/gamification';
import { useStore } from '@/state/store';
import { Icon } from '@/ui/Icon';
import { Button, Chip, IconButton, ProgressBar } from '@/ui/kit';
import { Sprout } from '@/ui/Sprout';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

function FloorRow({ floor, state, onPress, stage, onCurrentLayout }: { floor: Floor; state: 'cleared' | 'current' | 'locked'; onPress: () => void; stage: number; onCurrentLayout?: (y: number) => void }) {
  const c = useColors();
  const node = 44;
  const boss = floor.level === 5;
  const label = floor.summit ? 'Summit' : boss ? `Boss floor ${floor.index + 1}` : floor.checkpoint ? `Checkpoint ${floor.index + 1}` : `Floor ${floor.index + 1}`;
  return (
    <Pressable
      testID={`floor-${floor.index}`}
      onPress={onPress}
      onLayout={state === 'current' && onCurrentLayout ? (e) => onCurrentLayout(e.nativeEvent.layout.y) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${label}${floor.summit ? `, floor ${floor.index + 1}` : ''}, ${state === 'cleared' ? 'cleared' : state === 'current' ? 'up next' : 'locked'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 64, alignItems: 'center' }}>
        {state === 'current' ? (
          <Sprout size={58} mood="happy" stage={stage} />
        ) : (
          <View
            style={{
              width: node,
              height: node,
              borderRadius: node / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: state === 'cleared' ? c.primary : c.bgGrouped,
              borderWidth: boss || floor.checkpoint ? 2 : 1,
              borderColor: boss ? c.streak : state === 'cleared' ? c.primary : floor.checkpoint ? c.primary : c.borderStrong,
            }}>
            {state === 'cleared' ? (
              <Icon name="checkmark" size={18} color={c.onPrimary} weight="bold" />
            ) : floor.summit || floor.checkpoint || boss ? (
              <Icon name={floor.summit ? 'flag.checkered' : boss ? 'crown.fill' : 'flag.fill'} size={16} color={boss ? c.streak : c.primary} />
            ) : (
              <Icon name="lock.fill" size={14} color={c.textFaint} />
            )}
          </View>
        )}
      </View>
      <View
        style={{
          flex: 1,
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: state === 'current' ? c.primarySoft : c.card,
          borderWidth: state === 'current' ? 1.5 : 1,
          borderColor: state === 'current' ? c.primary : c.border,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="callout" weight="700" style={{ color: state === 'locked' ? c.textMuted : c.text }}>
            {label}
          </T>
          <T variant="caption" color="textFaint">
            {floor.index + 1}
          </T>
        </View>
        <T variant="footnote" color="textMuted">
          {floor.itemIds.length} questions · up to {LEVELS[floor.level].name}
          {state === 'current' ? ` · clear with ${neededToClear(floor)}` : ''}
        </T>
      </View>
    </Pressable>
  );
}

export default function Climb() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const exam = useExam();
  const ctx = useSelectContext(exam);
  const climb = useClimb(exam);
  const sprout = useSproutStage();
  const pure = useStore((s) => s.settings.pureStudy);
  const firstOpen = climb.find((x) => !x.progress.done && x.floors.length > 0)?.section ?? climb[0].section;
  const [section, setSection] = useState<SectionId>(firstOpen);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const current = climb.find((x) => x.section === section)!;
  const { floors, progress } = current;
  const next = floors[progress.current];

  const open = (floor: Floor) => {
    if (floor.index > progress.current) {
      Alert.alert('Locked', `Clear floor ${progress.current + 1} first. Each floor opens the next.`);
      return;
    }
    startClimb(ctx, section, floor);
  };

  // Floors run top (summit) to bottom (floor 1), grouped into camps of five.
  const rows: ({ kind: 'camp'; name: string; first: number } | { kind: 'floor'; floor: Floor })[] = [];
  for (let i = floors.length - 1; i >= 0; i--) {
    rows.push({ kind: 'floor', floor: floors[i] });
    if (i % 5 === 0) rows.push({ kind: 'camp', name: campName(i), first: i });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="title">The Climb</T>
          <IconButton testID="climb-close" icon="xmark" label="Close" onPress={() => router.back()} />
        </View>
        <T variant="subhead" color="textMuted">
          Every question in a section, easiest to hardest, {FLOOR_SIZE} to a floor{section === 'CARS' || section === 'RC' ? ' (one passage per floor here)' : ''}. Get {Math.round(PASS_RATE * 100)}% right to
          clear a floor and unlock the next.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {climb.map((x) => (
            <Chip
              key={x.section}
              testID={`climb-section-${x.section}`}
              label={`${SECTIONS[x.section].short} ${x.progress.cleared}/${x.progress.total}`}
              icon={x.progress.done ? 'flag.checkered' : undefined}
              selected={section === x.section}
              onPress={() => setSection(x.section)}
            />
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="footnote" weight="600">
              {progress.done ? 'Summit reached!' : `Floor ${progress.current + 1} of ${progress.total} · ${campName(progress.current)}`}
            </T>
            <T variant="footnote" color="textMuted">
              {Math.round((100 * progress.cleared) / Math.max(1, progress.total))}%
            </T>
          </View>
          <ProgressBar value={progress.cleared / Math.max(1, progress.total)} />
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}>
        <View style={{ position: 'absolute', left: space.lg + 31, top: space.lg, bottom: space.xxxl, width: 2, backgroundColor: c.border }} />
        {rows.map((row) =>
          row.kind === 'camp' ? (
            <View key={`camp-${row.first}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.sm, marginLeft: 76 }}>
              <Icon name="tent.fill" size={13} color={c.textMuted} />
              <T variant="caption" weight="700" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {row.name} · floors {row.first + 1}–{Math.min(row.first + 5, floors.length)}
              </T>
            </View>
          ) : (
            <FloorRow
              key={row.floor.index}
              floor={row.floor}
              stage={pure ? 0 : sprout.stage}
              state={row.floor.index < progress.current ? 'cleared' : row.floor.index === progress.current ? 'current' : 'locked'}
              onPress={() => open(row.floor)}
              onCurrentLayout={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 220), animated: false })}
            />
          ),
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.bgGrouped }}>
        {next ? (
          <Button testID="climb-start" title={`Start ${next.summit ? 'the Summit' : `Floor ${next.index + 1}`}`} icon="figure.hiking" onPress={() => open(next)} />
        ) : (
          <Button testID="climb-start" kind="secondary" title="Summit reached. Replay any floor." icon="flag.checkered" onPress={() => floors[0] && open(floors[0])} />
        )}
      </View>
    </View>
  );
}
