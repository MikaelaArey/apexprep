// The layered explanation shown after every answer: verdict, one-liner, why your
// answer was wrong, why the right one is right, the other choices, and the
// takeaway (which goes to spaced review).

import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { kpMap } from '@/content';
import { MISS_REASONS, TRAPS } from '@/content/labels';
import type { Item } from '@/content/types';
import type { Attempt, MissReason } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { fetchAnswerCounts } from '@/sync/account';
import { clock } from '@/ui/format';
import { Icon } from '@/ui/Icon';
import { Button, Card, Chip, Eyebrow, Pill } from '@/ui/kit';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const PEER_MIN = 30;

function Verdict({ item, attempt }: { item: Item; attempt: Attempt }) {
  const c = useColors();
  const right = item.options.find((o) => o.correct)!;
  const ok = attempt.correct;
  return (
    <View
      testID={ok ? 'verdict-correct' : 'verdict-wrong'}
      accessibilityRole="summary"
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, borderRadius: radius.lg, backgroundColor: ok ? c.successSoft : c.dangerSoft }}>
      <Icon name={ok ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={30} color={ok ? c.success : c.danger} />
      <View style={{ flex: 1 }}>
        <T variant="headline" color={ok ? 'success' : 'danger'}>
          {ok ? 'Correct' : 'Not quite'}
        </T>
        <T variant="footnote" color="textMuted">
          {ok ? `${right.id} is right` : `You chose ${attempt.selected} · Answer is ${right.id}`} · {clock(attempt.ms)} (target {clock(item.targetSec * 1000)})
        </T>
      </View>
    </View>
  );
}

function PeerStats({ item }: { item: Item }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    fetchAnswerCounts(item.id).then((c) => live && setCounts(c));
    return () => {
      live = false;
    };
  }, [item.id]);
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  if (!counts || total < PEER_MIN) return null;
  return (
    <T variant="footnote" color="textMuted" style={{ marginTop: space.sm }}>
      How everyone answered: {item.options.map((o) => `${o.id} ${Math.round((100 * (counts[o.id] ?? 0)) / total)}%`).join(' · ')} ({total})
    </T>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={{ marginTop: space.xl, marginBottom: space.sm }}>
      <Eyebrow>{children}</Eyebrow>
    </View>
  );
}

export function Explanation({ item, attempt, cardsAdded }: { item: Item; attempt: Attempt; cardsAdded: string[] }) {
  const c = useColors();
  const cards = useStore((s) => s.cards);
  const addToReview = useStore((s) => s.addToReview);
  const setMissReason = useStore((s) => s.setMissReason);
  const liveAttempt = useStore((s) => s.attempts.find((a) => a.id === attempt.id)) ?? attempt;
  const [showOthers, setShowOthers] = useState(false);
  const right = item.options.find((o) => o.correct)!;
  const chosen = item.options.find((o) => o.id === attempt.selected)!;
  const others = item.options.filter((o) => o.id !== right.id && o.id !== chosen.id);
  const kps = item.knowledgePoints;
  const inDeck = kps.some((k) => cards[k]);
  const justAdded = cardsAdded.length > 0;

  return (
    <View testID="explanation">
      <Verdict item={item} attempt={attempt} />
      <PeerStats item={item} />

      <SectionLabel>In one line</SectionLabel>
      <T variant="headline" weight="600">
        {item.tldr}
      </T>

      {!attempt.correct ? (
        <>
          <SectionLabel>{`Why ${chosen.id} is wrong`}</SectionLabel>
          <Card style={{ borderColor: c.danger, gap: space.sm }}>
            {chosen.trap ? <Pill label={TRAPS[chosen.trap]?.name ?? chosen.trap} tone="danger" icon="exclamationmark.triangle.fill" /> : null}
            <T variant="callout">{chosen.why}</T>
            {chosen.trap ? (
              <T variant="footnote" color="textMuted">
                {TRAPS[chosen.trap]?.desc}
              </T>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionLabel>{`Why ${right.id} is right`}</SectionLabel>
      <Card style={{ gap: space.lg }}>
        {item.steps.map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="caption" weight="700" color="primary">
                {i + 1}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="subhead" weight="700">
                {step.label}
              </T>
              <T variant="callout" style={{ marginTop: 2 }}>
                {step.body}
              </T>
            </View>
          </View>
        ))}
        <View style={{ borderTopWidth: 0.5, borderTopColor: c.border, paddingTop: space.md }}>
          <T variant="callout">
            <T variant="callout" weight="700">
              {right.id}.{' '}
            </T>
            {right.why}
          </T>
        </View>
      </Card>

      <Pressable
        testID="toggle-others"
        accessibilityRole="button"
        accessibilityState={{ expanded: showOthers }}
        onPress={() => {
          haptic.tap();
          setShowOthers((v) => !v);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, paddingVertical: space.sm }}>
        <Eyebrow>{attempt.correct ? 'Why the others are wrong' : 'The other choices'}</Eyebrow>
        <Icon name={showOthers ? 'chevron.up' : 'chevron.down'} size={13} color={c.textMuted} weight="bold" />
      </Pressable>
      {showOthers ? (
        <Card style={{ gap: space.lg }}>
          {(attempt.correct ? item.options.filter((o) => !o.correct) : others).map((o) => (
            <View key={o.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <T variant="subhead" weight="700">
                  {o.id}
                </T>
                {o.trap ? <Pill label={TRAPS[o.trap]?.name ?? o.trap} /> : null}
              </View>
              <T variant="footnote" color="textMuted">
                {o.text}
              </T>
              <T variant="callout">{o.why}</T>
            </View>
          ))}
        </Card>
      ) : null}

      <SectionLabel>Takeaway</SectionLabel>
      <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft, gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Icon name="lightbulb.fill" size={18} color={c.primary} />
          <T variant="callout" weight="600" style={{ flex: 1 }}>
            {item.takeaway}
          </T>
        </View>
        {justAdded || inDeck ? (
          <View testID="in-review" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="checkmark.circle.fill" size={15} color={c.primary} />
            <T variant="footnote" weight="600" color="primary">
              {justAdded ? `Added to Review: ${kpMap.get(cardsAdded[0])?.title ?? 'concept'}` : 'In your Review deck'}
            </T>
          </View>
        ) : (
          <Button testID="add-to-review" kind="secondary" size="md" icon="plus" title="Add to Review" onPress={() => kps.forEach(addToReview)} />
        )}
      </View>

      {!attempt.correct ? (
        <>
          <SectionLabel>Why did you miss it?</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(Object.keys(MISS_REASONS) as MissReason[]).map((reason) => (
              <Chip
                key={reason}
                testID={`miss-${reason}`}
                label={MISS_REASONS[reason]}
                selected={liveAttempt.missReason === reason}
                onPress={() => setMissReason(attempt.id, liveAttempt.missReason === reason ? null : reason)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Text for "Listen": the explanation layers read aloud. */
export function spokenExplanation(item: Item, attempt: Attempt): string {
  const right = item.options.find((o) => o.correct)!;
  const chosen = item.options.find((o) => o.id === attempt.selected)!;
  const parts = [
    attempt.correct ? 'Correct.' : `Not quite. You chose ${chosen.id}. The answer is ${right.id}.`,
    item.tldr,
    ...(attempt.correct ? [] : [`Why ${chosen.id} is wrong: ${chosen.why}`]),
    ...item.steps.map((s) => `${s.label}. ${s.body}`),
    `Takeaway: ${item.takeaway}`,
  ];
  return parts.join(' ');
}
