// Badges: every achievement for the current exam, with progress toward its next
// tier, plus how Sprout is growing.

import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BadgeGroup, BadgeState } from '@/engine/badges';
import { STAGES } from '@/engine/coach';
import { useExam } from '@/state/derived';
import { useBadges, useSproutStage } from '@/state/gamification';
import { BadgeMedal, tierColor } from '@/ui/BadgeMedal';
import { Card, Eyebrow, IconButton, ProgressBar } from '@/ui/kit';
import { Sprout } from '@/ui/Sprout';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';

const GROUPS: BadgeGroup[] = ['Milestones', 'Skill', 'Sections', 'Habits', 'Climb', 'Scores'];

function BadgeTile({ badge }: { badge: BadgeState }) {
  const c = useColors();
  const explain = () => {
    const tiers = badge.def.tiers.length > 1 ? `\n\nTiers: ${badge.def.tiers.join(' · ')}` : '';
    Alert.alert(
      badge.def.title,
      badge.next === null ? `Maxed out! You've earned every tier.${tiers}` : `${badge.def.goal(badge.next)}.\n\nProgress: ${badge.value} of ${badge.next}.${tiers}`,
    );
  };
  return (
    <Pressable
      testID={`badge-${badge.def.id}`}
      onPress={explain}
      accessibilityRole="button"
      accessibilityLabel={`${badge.def.title}${badge.tierName ? `, ${badge.tierName}` : ''}${badge.tier === 0 ? ', locked' : ''}`}
      style={({ pressed }) => ({ width: '31%', alignItems: 'center', gap: 6, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
      <BadgeMedal badge={badge} size={58} />
      <T variant="caption" weight="700" align="center" numberOfLines={2} style={{ color: badge.tier ? c.text : c.textMuted }}>
        {badge.def.title}
      </T>
      {badge.tierName ? (
        <T variant="caption" weight="700" style={{ color: tierColor(badge), marginTop: -4 }}>
          {badge.tierName}
        </T>
      ) : null}
      {badge.next !== null ? (
        <View style={{ width: '80%', gap: 2 }}>
          <ProgressBar value={badge.progress} height={4} />
          <T variant="caption" color="textFaint" align="center" style={{ fontVariant: ['tabular-nums'] }}>
            {Math.min(badge.value, badge.next)}/{badge.next}
          </T>
        </View>
      ) : (
        <T variant="caption" color="success" weight="700">
          Complete
        </T>
      )}
    </Pressable>
  );
}

export default function Badges() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const exam = useExam();
  const badges = useBadges(exam);
  const sprout = useSproutStage();
  const earned = badges.filter((b) => b.tier > 0).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <View>
          <T variant="title">Badges</T>
          <T variant="footnote" color="textMuted">
            {earned} of {badges.length} earned · {exam}
          </T>
        </View>
        <IconButton testID="badges-close" icon="xmark" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: insets.bottom + space.xxxl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Sprout size={84} mood="cheer" stage={sprout.stage} bounceKey={1} />
          <View style={{ flex: 1, gap: 6 }}>
            <Eyebrow>Sprout · {sprout.name}</Eyebrow>
            <T variant="headline">Level {sprout.level}</T>
            <ProgressBar value={sprout.xp.into / sprout.xp.span} />
            <T variant="footnote" color="textMuted">
              {sprout.next ? `Grows into a ${sprout.next.name} at level ${sprout.next.level}.` : 'Fully grown. A true Sage!'}
            </T>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              {STAGES.map((st, i) => (
                <View key={st.name} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= sprout.stage ? c.primary : c.border }} />
              ))}
            </View>
          </View>
        </Card>

        {GROUPS.map((group) => {
          const list = badges.filter((b) => b.def.group === group);
          if (list.length === 0) return null;
          return (
            <View key={group} style={{ gap: space.sm }}>
              <Eyebrow>{group}</Eyebrow>
              <Card style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md }}>
                {list.map((b) => (
                  <BadgeTile key={b.def.id} badge={b} />
                ))}
              </Card>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
