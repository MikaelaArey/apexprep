// Column chart of logged test scores with a dashed goal line.

import { View } from 'react-native';
import type { ScoreEntry } from '@/data/types';
import { parseDay } from '@/engine/time';
import { T } from './Text';
import { space, useColors } from './theme';

const shortDate = (day: string) => parseDay(day).toLocaleDateString([], { month: 'short', day: 'numeric' });
const longDate = (day: string) => parseDay(day).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

export function ScoreChart({ entries, target, min, max }: { entries: ScoreEntry[]; target: number; min: number; max: number }) {
  const c = useColors();
  const shown = entries.slice(-8);
  const values = [...shown.map((e) => e.total), target];
  const lo = Math.max(min, Math.min(...values) - 6);
  const hi = Math.min(max, Math.max(...values) + 4);
  const height = 150;
  const y = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * height;
  return (
    <View accessibilityLabel={`Score chart: ${shown.map((e) => `${e.total} on ${longDate(e.date)}`).join(', ')}. Goal ${target}.`}>
      <View style={{ height: height + 22, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingTop: 22 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: y(target), borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: c.streak }}>
          <T variant="caption" weight="700" style={{ position: 'absolute', right: 0, top: -17, color: c.streak }}>
            Goal {target}
          </T>
        </View>
        {shown.map((e) => (
          <View key={e.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <T variant="caption" weight="700" style={{ marginBottom: 3, fontVariant: ['tabular-nums'] }}>
              {e.total}
            </T>
            <View
              style={{
                width: '70%',
                maxWidth: 34,
                height: Math.max(6, y(e.total)),
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                backgroundColor: e.kind === 'official' ? c.ink : e.total >= target ? c.success : c.primary,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 6 }}>
        {shown.map((e) => (
          <T key={e.id} variant="caption" color="textFaint" align="center" style={{ flex: 1 }} numberOfLines={1}>
            {shortDate(e.date)}
          </T>
        ))}
      </View>
    </View>
  );
}

