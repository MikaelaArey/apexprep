// Which exams a student is signed up for. They pick one at onboarding, can add the
// other in Profile, and switch between them there once they have both.

import type { Exam } from '@/content/types';
import { useStore } from './store';

export const ALL_EXAMS: Exam[] = ['LSAT', 'MCAT'];

export function addExam(exam: Exam, switchTo = false) {
  const { settings, updateSettings } = useStore.getState();
  const exams = settings.exams.includes(exam) ? settings.exams : [...settings.exams, exam];
  updateSettings({ exams, ...(switchTo ? { exam } : {}) });
}

export function switchExam(exam: Exam) {
  const { settings, updateSettings } = useStore.getState();
  if (settings.exams.includes(exam) && settings.exam !== exam) updateSettings({ exam });
}

/** Drops an exam from the list. The exam being studied right now can't be removed. */
export function removeExam(exam: Exam) {
  const { settings, updateSettings } = useStore.getState();
  if (exam === settings.exam || settings.exams.length < 2) return;
  updateSettings({ exams: settings.exams.filter((e) => e !== exam) });
}
