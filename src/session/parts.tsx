// Pieces of the study session screen: header, answer rows, data tables and the
// passage sheet.

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AnswerOption, DataTable as Table, Passage } from '@/content/types';
import { SECTIONS } from '@/content/labels';
import { haptic } from '@/lib/haptics';
import { clock } from '@/ui/format';
import { Icon } from '@/ui/Icon';
import { IconButton, Pill } from '@/ui/kit';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

export function SessionHeader({
  index,
  total,
  onClose,
  right,
}: {
  index: number;
  total: number;
  onClose: () => void;
  right?: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 4, paddingHorizontal: space.sm, backgroundColor: c.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48 }}>
        <IconButton testID="session-close" icon="xmark" label="Close session" onPress={onClose} />
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }} accessibilityLabel={`Question ${Math.min(index + 1, total)} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < index ? c.primary : i === index ? c.ink : c.border }}
            />
          ))}
        </View>
        <T variant="footnote" color="textMuted" style={{ fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' }}>
          {Math.min(index + 1, total)} of {total}
        </T>
        <View style={{ minWidth: 56, alignItems: 'flex-end', paddingRight: space.sm }}>{right}</View>
      </View>
    </View>
  );
}

/** Time since it mounted (remount with a new key to restart); isolated so only it re-renders every second. */
export function Timer({ running, target }: { running: boolean; target: number }) {
  const [start] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const elapsed = now - start;
  return (
    <T variant="footnote" weight="600" color={elapsed > target ? 'warning' : 'textMuted'} style={{ fontVariant: ['tabular-nums'] }}>
      {clock(elapsed)}
    </T>
  );
}

export type OptionState = 'idle' | 'selected' | 'struck' | 'correct' | 'wrong' | 'dim';

export function OptionRow({
  option,
  state,
  onPress,
  onLongPress,
}: {
  option: AnswerOption;
  state: OptionState;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useColors();
  const look = {
    idle: { border: c.border, bg: c.card, badgeBg: c.bgGrouped, badgeFg: c.textMuted },
    selected: { border: c.ink, bg: c.card, badgeBg: c.ink, badgeFg: c.bg },
    struck: { border: c.border, bg: c.bgGrouped, badgeBg: c.bgGrouped, badgeFg: c.textFaint },
    correct: { border: c.success, bg: c.successSoft, badgeBg: c.success, badgeFg: c.onPrimary },
    wrong: { border: c.danger, bg: c.dangerSoft, badgeBg: c.danger, badgeFg: '#FFFFFF' },
    dim: { border: c.border, bg: c.card, badgeBg: c.bgGrouped, badgeFg: c.textFaint },
  }[state];
  const revealed = state === 'correct' || state === 'wrong' || state === 'dim';
  const label =
    state === 'correct' ? 'Correct answer' : state === 'wrong' ? 'Your answer' : state === 'struck' ? 'Crossed out' : state === 'selected' ? 'Selected' : '';
  return (
    <Pressable
      testID={`option-${option.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: state === 'selected', disabled: revealed }}
      accessibilityLabel={`${option.id}. ${option.text}${label ? `. ${label}` : ''}`}
      accessibilityHint={revealed ? undefined : 'Double-tap to select. Long-press to cross out.'}
      disabled={revealed}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        padding: space.md,
        minHeight: 56,
        borderRadius: radius.md,
        borderWidth: state === 'selected' || state === 'correct' || state === 'wrong' ? 2 : 1,
        borderColor: look.border,
        backgroundColor: pressed && !revealed ? c.cardPressed : look.bg,
        alignItems: 'flex-start',
      })}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: look.badgeBg, alignItems: 'center', justifyContent: 'center', marginTop: -1 }}>
        {state === 'correct' ? (
          <Icon name="checkmark" size={14} color={look.badgeFg} weight="bold" />
        ) : state === 'wrong' ? (
          <Icon name="xmark" size={13} color={look.badgeFg} weight="bold" />
        ) : (
          <T variant="subhead" weight="700" style={{ color: look.badgeFg }}>
            {option.id}
          </T>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T
          variant="callout"
          style={[
            { color: state === 'struck' || state === 'dim' ? c.textFaint : c.text },
            state === 'struck' && { textDecorationLine: 'line-through' },
          ]}>
          {option.text}
        </T>
        {state === 'correct' || state === 'wrong' ? (
          <T variant="caption" weight="700" color={state === 'correct' ? 'success' : 'danger'}>
            {label}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

export function DataTable({ table }: { table: Table }) {
  const c = useColors();
  return (
    <View style={{ marginVertical: space.md }}>
      {table.caption ? (
        <T variant="footnote" weight="600" color="textMuted" style={{ marginBottom: 6 }}>
          {table.caption}
        </T>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong, borderRadius: radius.sm, overflow: 'hidden' }}>
          {[table.columns, ...table.rows].map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', backgroundColor: r === 0 ? c.bgGrouped : r % 2 ? c.card : c.bg }}>
              {row.map((cell, i) => (
                <View
                  key={i}
                  style={{
                    width: i === 0 ? 92 : 128,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderLeftWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderColor: c.border,
                  }}>
                  <T variant="footnote" weight={r === 0 ? '700' : '400'} style={{ fontVariant: ['tabular-nums'] }}>
                    {cell}
                  </T>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function PassageText({ passage }: { passage: Passage }) {
  return (
    <View style={{ gap: space.lg }}>
      {passage.paragraphs.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
          <T variant="caption" color="textFaint" style={{ width: 14, marginTop: 5 }}>
            {i + 1}
          </T>
          <T variant="reading" style={{ flex: 1 }}>
            {p}
          </T>
        </View>
      ))}
      {passage.table ? <DataTable table={passage.table} /> : null}
    </View>
  );
}

export function PassageSheet({ passage, visible, onClose }: { passage: Passage; visible: boolean; onClose: () => void }) {
  const c = useColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: space.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Pill label={`${SECTIONS[passage.section].short} passage`} tone="primary" />
            <T variant="title">{passage.title}</T>
          </View>
          <IconButton testID="passage-close" icon="xmark" label="Close passage" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
          <PassageText passage={passage} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export function PassageButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      testID="open-passage"
      accessibilityRole="button"
      accessibilityLabel="Show passage"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
      <Icon name="doc.text" size={15} color={c.primary} />
      <T variant="footnote" weight="700" color="primary">
        Passage
      </T>
    </Pressable>
  );
}

export function BottomBar({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: Math.max(insets.bottom, space.md) + 4,
        backgroundColor: c.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.border,
        gap: space.md,
      }}>
      {children}
    </View>
  );
}
