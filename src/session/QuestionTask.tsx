// One question: read (passages), answer, then the explanation.

import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { itemMap, passageMap } from '@/content';
import { SECTIONS, typeName } from '@/content/labels';
import type { Item, OptionId } from '@/content/types';
import type { Attempt, Confidence } from '@/data/types';
import { coachLine, reactTo, type CoachLine } from '@/engine/coach';
import { haptic } from '@/lib/haptics';
import { useSproutStage } from '@/state/gamification';
import { useStore } from '@/state/store';
import { Icon } from '@/ui/Icon';
import { Button, Chip, Eyebrow, Pill } from '@/ui/kit';
import { LevelMeter } from '@/ui/LevelMeter';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';
import { CoachToast } from './CoachToast';
import { Explanation, spokenExplanation } from './Explanation';
import { BottomBar, DataTable, OptionRow, PassageButton, PassageSheet, PassageText, SessionHeader, Timer, type OptionState } from './parts';

type Phase = 'read' | 'answer' | 'explain';

const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'sure', label: 'Sure' },
  { id: 'unsure', label: 'Unsure' },
  { id: 'guess', label: 'Guess' },
];

/** Wall-clock time, for timing answers in event handlers. */
const now = () => Date.now();

/** Combo count and Sprout's reaction to an answer, from this session's earlier answers. */
function reactionTo(result: Attempt, index: number, item: Item): { combo: number; line: CoachLine | null } {
  const { session, attempts } = useStore.getState();
  const prior = (session?.results ?? []).filter((r) => r.kind === 'question');
  let combo = 0;
  if (result.correct) {
    combo = 1;
    for (let i = prior.length - 1; i >= 0 && prior[i].correct; i--) combo += 1;
  }
  const event = reactTo({
    correct: result.correct,
    combo,
    index,
    boss: item.difficulty === 5,
    comeback: result.correct && attempts.some((a) => a.itemId === item.id && a.id !== result.id && !a.correct),
    missedLast: prior.length > 0 && prior[prior.length - 1].correct === false,
  });
  return { combo, line: event ? coachLine(event, result.id, item.exam, { n: combo }) : null };
}

export function QuestionTask({
  itemId,
  index,
  total,
  passageSeen,
  onPassageSeen,
  onClose,
  isReview,
}: {
  itemId: string;
  index: number;
  total: number;
  passageSeen: boolean;
  onPassageSeen: (passageId: string) => void;
  onClose: () => void;
  isReview: boolean;
}) {
  const c = useColors();
  const item = itemMap.get(itemId)!;
  const passage = item.passageId ? passageMap.get(item.passageId) : undefined;
  const askConfidence = useStore((s) => s.settings.confidence);
  const coachOn = useStore((s) => s.settings.coach && !s.settings.pureStudy);
  const sprout = useSproutStage();
  const answerQuestion = useStore((s) => s.answerQuestion);
  const completeQuestion = useStore((s) => s.completeQuestion);

  // If the app closed after this question was answered but before moving on,
  // reopen it on its explanation.
  const [resumed] = useState(() => {
    const { session, attempts } = useStore.getState();
    const current = session?.current;
    const existing = current && attempts.find((a) => a.id === current.attemptId && a.itemId === itemId);
    return existing ? { attempt: existing, cardsAdded: current.cardsAdded } : null;
  });

  const [phase, setPhase] = useState<Phase>(resumed ? 'explain' : passage && !passageSeen ? 'read' : 'answer');
  const [selected, setSelected] = useState<OptionId | null>(resumed?.attempt.selected ?? null);
  const [firstPick, setFirstPick] = useState<OptionId | null>(null);
  const [struck, setStruck] = useState<Set<OptionId>>(new Set());
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(resumed?.attempt ?? null);
  const [cardsAdded, setCardsAdded] = useState<string[]>(resumed?.cardsAdded ?? []);
  const [showPassage, setShowPassage] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [coach, setCoach] = useState<CoachLine | null>(null);
  const [combo, setCombo] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const startedAt = useRef(0);
  const revealedAt = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollOnLayout = useRef(false);

  useEffect(() => {
    if (resumed) revealedAt.current = Date.now();
    return () => void Speech.stop();
  }, [resumed]);

  // The answer clock starts whenever the answering phase begins.
  useEffect(() => {
    if (phase === 'answer') startedAt.current = Date.now();
  }, [phase]);

  const startAnswering = () => {
    if (passage) onPassageSeen(passage.id);
    setTimerKey((k) => k + 1);
    setPhase('answer');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const pick = (id: OptionId) => {
    if (struck.has(id)) {
      const next = new Set(struck);
      next.delete(id);
      setStruck(next);
      return;
    }
    haptic.select();
    if (!firstPick) setFirstPick(id);
    setSelected(id);
  };

  const strike = (id: OptionId) => {
    haptic.tap();
    const next = new Set(struck);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (selected === id) setSelected(null);
    }
    setStruck(next);
  };

  const check = () => {
    if (!selected) return;
    const result = answerQuestion({
      itemId,
      selected,
      confidence: askConfidence ? confidence : null,
      eliminated: [...struck],
      changed: firstPick !== null && firstPick !== selected,
      ms: now() - startedAt.current,
    });
    if (result.correct) haptic.success();
    else haptic.error();
    const reaction = reactionTo(result, index, item);
    setCombo(reaction.combo);
    if (reaction.line && coachOn) setCoach(reaction.line);
    setAttempt(result);
    setCardsAdded(useStore.getState().session?.current?.cardsAdded ?? []);
    revealedAt.current = now();
    scrollOnLayout.current = true;
    setPhase('explain');
  };

  // Bring the verdict into view once the explanation has been laid out.
  const onExplanationLayout = (y: number) => {
    if (!scrollOnLayout.current) return;
    scrollOnLayout.current = false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - space.md), animated: true });
  };

  const next = () => {
    Speech.stop();
    completeQuestion(Date.now() - revealedAt.current);
  };

  const listen = () => {
    if (!attempt) return;
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(spokenExplanation(item, attempt), {
      language: 'en-US',
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const stateFor = (id: OptionId): OptionState => {
    if (phase === 'explain' && attempt) {
      const option = item.options.find((o) => o.id === id)!;
      if (option.correct) return 'correct';
      if (id === attempt.selected) return 'wrong';
      return 'dim';
    }
    if (struck.has(id)) return 'struck';
    return selected === id ? 'selected' : 'idle';
  };

  const headerRight =
    phase === 'answer' ? (
      <Timer key={timerKey} running target={item.targetSec * 1000} />
    ) : passage && phase === 'explain' ? (
      <PassageButton onPress={() => setShowPassage(true)} />
    ) : null;

  if (phase === 'read' && passage) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SessionHeader index={index} total={total} onClose={onClose} />
        <ScrollView testID="passage-read" contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
            <Pill label={`${SECTIONS[passage.section].short} passage`} tone="primary" />
            {passage.mini ? <Pill label="Mini" /> : null}
            <Pill label={`${passage.itemIds.length} questions`} />
          </View>
          <T variant="title" style={{ marginBottom: space.lg }}>
            {passage.title}
          </T>
          <PassageText passage={passage} />
        </ScrollView>
        <BottomBar>
          <Button testID="start-questions" title="Start questions" icon="arrow.right" onPress={startAnswering} />
        </BottomBar>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SessionHeader index={index} total={total} onClose={onClose} right={headerRight} />
      <ScrollView ref={scrollRef} testID="question-scroll" contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.md }}>
          <View style={{ flexShrink: 1 }}>
            <Eyebrow>
              {SECTIONS[item.section].short} · {typeName(item.type)}
              {isReview ? ' · Review' : ''}
            </Eyebrow>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {phase === 'explain' && combo >= 2 ? (
              <View
                testID="combo"
                accessibilityLabel={`${combo} correct in a row`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.warningSoft }}>
                <Icon name="flame.fill" size={12} color={c.streak} />
                <T variant="caption" weight="700" style={{ color: c.streak }}>
                  ×{combo}
                </T>
              </View>
            ) : null}
            <LevelMeter level={item.difficulty} compact />
          </View>
        </View>
        {passage && phase === 'answer' ? (
          <View style={{ alignItems: 'flex-end', marginTop: -space.xs, marginBottom: space.sm }}>
            <PassageButton onPress={() => setShowPassage(true)} />
          </View>
        ) : null}
        {__DEV__ && phase === 'answer' ? (
          // Development builds only: lets UI tests pick the right answer.
          <Pressable
            testID="dev-correct"
            accessibilityLabel="Developer: select the correct answer"
            onPress={() => setSelected(item.options.find((o) => o.correct)!.id)}
            style={{ position: 'absolute', top: 0, right: 0, width: 28, height: 28 }}
          />
        ) : null}
        {item.stimulus ? (
          <T variant="reading" style={{ marginBottom: space.lg }}>
            {item.stimulus}
          </T>
        ) : null}
        {item.table ? <DataTable table={item.table} /> : null}
        <T variant="headline" style={{ marginBottom: space.lg }}>
          {item.prompt}
        </T>
        <View style={{ gap: space.sm }}>
          {item.options.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              state={stateFor(o.id)}
              onPress={phase === 'answer' ? () => pick(o.id) : undefined}
              onLongPress={phase === 'answer' ? () => strike(o.id) : undefined}
            />
          ))}
        </View>
        {phase === 'answer' ? (
          <T variant="caption" color="textFaint" align="center" style={{ marginTop: space.md }}>
            Long-press a choice to cross it out
          </T>
        ) : null}
        {phase === 'explain' && attempt ? (
          <View style={{ marginTop: space.xxl }} onLayout={(e) => onExplanationLayout(e.nativeEvent.layout.y)}>
            <Explanation item={item} attempt={attempt} cardsAdded={cardsAdded} />
          </View>
        ) : null}
      </ScrollView>

      <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        <BottomBar>
        {phase === 'answer' ? (
          <>
            {askConfidence ? (
              <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }} accessibilityLabel="How sure are you?">
                {CONFIDENCE.map((x) => (
                  <Chip
                    key={x.id}
                    testID={`confidence-${x.id}`}
                    label={x.label}
                    selected={confidence === x.id}
                    onPress={() => setConfidence(confidence === x.id ? null : x.id)}
                  />
                ))}
              </View>
            ) : null}
            <Button testID="check" title="Check" onPress={check} disabled={!selected} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button
              testID="listen"
              kind="secondary"
              icon={speaking ? 'stop.fill' : 'speaker.wave.2.fill'}
              title={speaking ? 'Stop' : 'Listen'}
              onPress={listen}
              style={{ flex: 1 }}
            />
            <Button testID="next" title={index + 1 >= total ? 'Finish' : 'Next'} icon="arrow.right" onPress={next} style={{ flex: 1.6 }} />
          </View>
        )}
        </BottomBar>
      </View>
      {phase === 'explain' && coach ? <CoachToast line={coach} stage={sprout.stage} bottom={barHeight} /> : null}
      {passage ? <PassageSheet passage={passage} visible={showPassage} onClose={() => setShowPassage(false)} /> : null}
    </View>
  );
}
