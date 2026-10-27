// One question: read (passages), answer, then the explanation.

import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { itemMap, passageMap } from '@/content';
import { SECTIONS, typeName } from '@/content/labels';
import type { OptionId } from '@/content/types';
import type { Attempt, Confidence } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { Button, Chip, Eyebrow, Pill } from '@/ui/kit';
import { T } from '@/ui/Text';
import { space, useColors } from '@/ui/theme';
import { Explanation, spokenExplanation } from './Explanation';
import { BottomBar, DataTable, OptionRow, PassageButton, PassageSheet, PassageText, SessionHeader, Timer, type OptionState } from './parts';

type Phase = 'read' | 'answer' | 'explain';

const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'sure', label: 'Sure' },
  { id: 'unsure', label: 'Unsure' },
  { id: 'guess', label: 'Guess' },
];

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
  const answerQuestion = useStore((s) => s.answerQuestion);
  const completeQuestion = useStore((s) => s.completeQuestion);
  const pending = useStore((s) => s.session?.current);

  const [phase, setPhase] = useState<Phase>(passage && !passageSeen ? 'read' : 'answer');
  const [selected, setSelected] = useState<OptionId | null>(null);
  const [firstPick, setFirstPick] = useState<OptionId | null>(null);
  const [struck, setStruck] = useState<Set<OptionId>>(new Set());
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [cardsAdded, setCardsAdded] = useState<string[]>([]);
  const [showPassage, setShowPassage] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const startedAt = useRef(Date.now());
  const revealedAt = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollOnLayout = useRef(false);

  // Resume an answered-but-not-finished question after an app restart.
  useEffect(() => {
    if (!pending || attempt) return;
    const existing = useStore.getState().attempts.find((a) => a.id === pending.attemptId && a.itemId === itemId);
    if (existing) {
      setAttempt(existing);
      setSelected(existing.selected);
      setCardsAdded(pending.cardsAdded);
      setPhase('explain');
      revealedAt.current = Date.now();
    }
  }, [pending, attempt, itemId]);

  useEffect(() => () => void Speech.stop(), []);

  const startAnswering = () => {
    if (passage) onPassageSeen(passage.id);
    startedAt.current = Date.now();
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
      ms: Date.now() - startedAt.current,
    });
    if (result.correct) haptic.success();
    else haptic.error();
    setAttempt(result);
    setCardsAdded(useStore.getState().session?.current?.cardsAdded ?? []);
    revealedAt.current = Date.now();
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
      <Timer start={startedAt.current} running target={item.targetSec * 1000} />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <Eyebrow>
            {SECTIONS[item.section].short} · {typeName(item.type)}
            {isReview ? ' · Review' : ''}
          </Eyebrow>
          {passage && phase === 'answer' ? <PassageButton onPress={() => setShowPassage(true)} /> : null}
        </View>
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
      {passage ? <PassageSheet passage={passage} visible={showPassage} onClose={() => setShowPassage(false)} /> : null}
    </View>
  );
}
