// A badge's medal: icon in a disc, with a ring colored by tier. Locked badges
// are gray with a lock.

import { View } from 'react-native';
import type { BadgeState } from '@/engine/badges';
import { Icon, type IconName } from './Icon';
import { useColors } from './theme';

export const BADGE_ICONS: Record<string, IconName> = {
  correct: 'brain.head.profile',
  answered: 'checkmark.seal.fill',
  level: 'leaf.fill',
  combo: 'flame.fill',
  boss: 'crown.fill',
  hard: 'bolt.fill',
  perfect: 'star.circle.fill',
  sharp: 'scope',
  comeback: 'arrow.uturn.backward.circle.fill',
  'section-CP': 'atom',
  'section-BB': 'allergens',
  'section-PS': 'person.2.fill',
  'section-CARS': 'book.fill',
  'section-LR': 'checklist',
  'section-RC': 'text.book.closed.fill',
  explorer: 'map.fill',
  'explorer-lsat': 'map.fill',
  passages: 'doc.text.fill',
  streak: 'calendar',
  reflect: 'lightbulb.fill',
  cards: 'rectangle.stack.fill',
  weekend: 'sun.max.fill',
  night: 'moon.stars.fill',
  early: 'sunrise.fill',
  climb: 'mountain.2.fill',
  summit: 'flag.checkered',
  logged: 'chart.line.uptrend.xyaxis',
  pb: 'trophy.fill',
  goal: 'medal.fill',
};

const TIER_COLORS = ['#B87333', '#9AA6AF', '#D9A520', '#5FB3B3', '#6C8CF5', '#B05CE6'];

export function tierColor(b: BadgeState): string {
  if (b.tier === 0) return '#C7D2CD';
  if (b.def.tiers.length === 1) return '#D9A520';
  return TIER_COLORS[Math.min(TIER_COLORS.length - 1, b.tier - 1)];
}

export function BadgeMedal({ badge, size = 56 }: { badge: BadgeState; size?: number }) {
  const c = useColors();
  const locked = badge.tier === 0;
  const ring = tierColor(badge);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(3, size / 14),
        borderColor: ring,
        backgroundColor: locked ? c.bgGrouped : c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={BADGE_ICONS[badge.def.id] ?? 'star.fill'} size={size * 0.42} color={locked ? c.textFaint : c.primary} />
      {locked ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: size * 0.18,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="lock.fill" size={size * 0.17} color={c.textFaint} />
        </View>
      ) : null}
    </View>
  );
}
