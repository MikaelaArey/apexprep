import { mergeSettings, MemoryRepo } from '@/data/repo';
import { addExam, removeExam, switchExam } from '@/state/exams';
import { useStore } from '@/state/store';

describe('enrolled exams', () => {
  it('enrolls older installs in the exam they were using', () => {
    expect(mergeSettings({ exam: 'MCAT' }).exams).toEqual(['MCAT']);
    expect(mergeSettings(null).exams).toEqual(['LSAT']);
  });

  it('keeps the current exam inside the enrolled list', () => {
    const s = mergeSettings({ exam: 'MCAT', exams: ['LSAT'] });
    expect(s.exam).toBe('LSAT');
    expect(mergeSettings({ exam: 'LSAT', exams: ['LSAT', 'MCAT', 'LSAT'] }).exams).toEqual(['LSAT', 'MCAT']);
  });

  describe('add, switch and remove', () => {
    beforeEach(async () => {
      await useStore.getState().init(new MemoryRepo());
      useStore.getState().updateSettings({ onboarded: true, exam: 'LSAT', exams: ['LSAT'] });
    });

    it('only switches to an exam the student signed up for', () => {
      switchExam('MCAT');
      expect(useStore.getState().settings.exam).toBe('LSAT');
      addExam('MCAT');
      expect(useStore.getState().settings.exams).toEqual(['LSAT', 'MCAT']);
      expect(useStore.getState().settings.exam).toBe('LSAT');
      switchExam('MCAT');
      expect(useStore.getState().settings.exam).toBe('MCAT');
    });

    it('can add and switch in one step', () => {
      addExam('MCAT', true);
      expect(useStore.getState().settings).toMatchObject({ exam: 'MCAT', exams: ['LSAT', 'MCAT'] });
    });

    it('never removes the exam being studied or the last exam', () => {
      removeExam('LSAT');
      expect(useStore.getState().settings.exams).toEqual(['LSAT']);
      addExam('MCAT');
      removeExam('LSAT');
      expect(useStore.getState().settings.exams).toEqual(['LSAT', 'MCAT']);
      removeExam('MCAT');
      expect(useStore.getState().settings.exams).toEqual(['LSAT']);
    });
  });
});
