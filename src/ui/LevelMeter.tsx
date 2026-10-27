// Difficulty display: a five-step meter plus the level's name. Boss questions
// get a crown so they stand out.

import { View } from 'react-native';
import type { Difficulty } from '@/content/types';
import { LEVELS } from '@/engine/difficulty';
import { Icon } from './Icon';
import { T } from './Text';
import { useColors } from './theme';

export function LevelMeter({ level, showName = true, compact = false }: { level: Difficulty; showName?: boolean; compact?: boolean }) {
  const c = useColors();
  const boss = level === 5;
  const color = boss ? c.streak : level >= 4 ? c.warning : c.primary;
  return (
    <View
      accessible
      accessibilityLabel={`Difficulty: ${LEVELS[level].name}, level ${level} of 5`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {boss ? <Icon name="crown.fill" size={compact ? 11 : 13} color={c.streak} /> : null}
      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View
            key={n}
            style={{
              width: compact ? 3 : 4,
              height: (compact ? 4 : 5) + n * (compact ? 1.5 : 2),
              borderRadius: 2,
              backgroundColor: n <= level ? color : c.border,
            }}
          />
        ))}
      </View>
      {showName ? (
        <T variant="caption" weight="700" style={{ color: boss ? c.streak : c.textMuted }}>
          {LEVELS[level].name}
        </T>
      ) : null}
    </View>
  );
}
