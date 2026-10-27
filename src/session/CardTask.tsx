// A concept card in spaced review: recall the answer, reveal it, rate it.

import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { kpMap } from '@/content';
import { SECTIONS } from '@/content/labels';
import type { Rating } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { previewIntervals, daysUntil } from '@/engine/srs';
import { DAY_MS } from '@/engine/time';
import { useStore } from '@/state/store';
import { Button, Card, Eyebrow, Pill } from '@/ui/kit';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';
import { BottomBar, SessionHeader } from './parts';

const RATINGS: { rating: Rating; label: string }[] = [
  { rating: 1, label: 'Again' },
  { rating: 2, label: 'Hard' },
  { rating: 3, label: 'Good' },
  { rating: 4, label: 'Easy' },
];

function intervalLabel(due: number, now: number): string {
  const days = Math.max(1, Math.round((due - now) / DAY_MS));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export function CardTask({ kpId, index, total, onClose }: { kpId: string; index: number; total: number; onClose: () => void }) {
  const c = useColors();
  const kp = kpMap.get(kpId);
  const row = useStore((s) => s.cards[kpId]);
  const testDate = useStore((s) => (row ? s.settings.plans[row.exam].testDate : null));
  const rateCard = useStore((s) => s.rateCard);
  const [revealed, setRevealed] = useState(false);
  const started = useRef(Date.now());
  const now = Date.now();
  const preview = useMemo(
    () => (row ? previewIntervals(row.card, now, daysUntil(testDate, now)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, testDate, revealed],
  );

  if (!kp || !row) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SessionHeader index={index} total={total} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          <Pill label="Concept card" tone="primary" />
          <Pill label={SECTIONS[kp.section].short} />
        </View>
        <T variant="title" style={{ marginBottom: space.lg }}>
          {kp.title}
        </T>
        <Card style={{ minHeight: 140, justifyContent: 'center' }}>
          <T variant="body" weight="600">
            {kp.front}
          </T>
        </Card>
        {revealed ? (
          <View testID="card-back" style={{ marginTop: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft }}>
            <Eyebrow color="primary">Answer</Eyebrow>
            <T variant="body" style={{ marginTop: space.sm }}>
              {kp.back}
            </T>
          </View>
        ) : (
          <T variant="footnote" color="textMuted" align="center" style={{ marginTop: space.lg }}>
            Say or think the answer before you reveal it.
          </T>
        )}
      </ScrollView>
      <BottomBar>
        {revealed ? (
          <>
            <T variant="footnote" color="textMuted" align="center">
              How well did you remember it?
            </T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {RATINGS.map(({ rating, label }) => (
                <Pressable
                  key={rating}
                  testID={`rate-${rating}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}${preview ? `, next review in ${intervalLabel(preview[rating], now)}` : ''}`}
                  onPress={() => {
                    if (rating === 1) haptic.error();
                    else haptic.success();
                    rateCard(kpId, rating, Date.now() - started.current);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 58,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? c.cardPressed : rating === 1 ? c.dangerSoft : rating === 3 ? c.primarySoft : c.bgGrouped,
                    borderWidth: 1,
                    borderColor: rating === 1 ? c.danger : rating === 3 ? c.primary : c.border,
                  })}>
                  <T variant="subhead" weight="700" color={rating === 1 ? 'danger' : rating === 3 ? 'primary' : 'text'}>
                    {label}
                  </T>
                  {preview ? (
                    <T variant="caption" color="textMuted">
                      {intervalLabel(preview[rating], now)}
                    </T>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Button testID="reveal-card" title="Show answer" onPress={() => setRevealed(true)} />
        )}
      </BottomBar>
    </View>
  );
}
