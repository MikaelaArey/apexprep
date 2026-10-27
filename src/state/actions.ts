// Starting study sessions from anywhere in the app.

import { router } from 'expo-router';
import { passageMap } from '@/content';
import { typeName, SECTIONS } from '@/content/labels';
import type { SectionId } from '@/content/types';
import { climbKey, type Floor } from '@/engine/climb';
import { buildDaily5, buildDrill, buildReviewQueue, passageItems, type DrillFilters, type SelectContext } from '@/engine/select';
import type { SessionTask } from './session-types';
import { useStore, type StartSpec } from './store';

function open(spec: StartSpec) {
  if (spec.tasks.length === 0) return false;
  useStore.getState().startSession(spec);
  router.push('/session');
  return true;
}

const questions = (ids: string[]): SessionTask[] => ids.map((itemId) => ({ kind: 'question', itemId }));

export function startDaily5(ctx: SelectContext) {
  return open({ kind: 'daily5', exam: ctx.exam, title: 'Daily 5', tasks: questions(buildDaily5(ctx)) });
}

export function startDrill(ctx: SelectContext, filters: DrillFilters, title?: string) {
  const label =
    title ??
    (filters.types.length === 1
      ? typeName(filters.types[0])
      : filters.sections.length === 1
        ? SECTIONS[filters.sections[0]].name
        : 'Quick Drill');
  return open({ kind: 'drill', exam: ctx.exam, title: label, tasks: questions(buildDrill(ctx, filters)) });
}

export function startPassage(ctx: SelectContext, passageId: string) {
  const passage = passageMap.get(passageId);
  return open({ kind: 'passage', exam: ctx.exam, title: passage?.title ?? 'Passage', tasks: questions(passageItems(ctx, passageId)) });
}

export function startReview(ctx: SelectContext) {
  const tasks: SessionTask[] = buildReviewQueue(ctx).map((t) =>
    t.kind === 'question' ? { kind: 'question', itemId: t.itemId!, reviewKp: t.kpId } : { kind: 'card', kpId: t.kpId },
  );
  return open({ kind: 'review', exam: ctx.exam, title: 'Review', tasks });
}

export function startRetry(ctx: SelectContext, itemIds: string[], title = 'Retry') {
  return open({ kind: 'retry', exam: ctx.exam, title, tasks: questions(itemIds) });
}

export function climbSpec(ctx: SelectContext, section: SectionId, floor: Floor): StartSpec {
  const title = floor.summit ? `${SECTIONS[section].short} Summit` : `${SECTIONS[section].short} Floor ${floor.index + 1}`;
  return {
    kind: 'climb',
    exam: ctx.exam,
    title,
    tasks: questions(floor.itemIds),
    climb: { key: climbKey(ctx.exam, section), floor: floor.index, checkpoint: floor.checkpoint },
  };
}

export function startClimb(ctx: SelectContext, section: SectionId, floor: Floor) {
  return open(climbSpec(ctx, section, floor));
}

/** One question, or a short run of questions, picked from the question bank. */
export function startBankQuestions(ctx: SelectContext, itemIds: string[], title: string) {
  return open({ kind: 'drill', exam: ctx.exam, title, tasks: questions(itemIds) });
}

export function resumeSession() {
  if (useStore.getState().session) router.push('/session');
}
