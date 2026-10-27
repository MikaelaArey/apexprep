// Development only: resets the app to a known state for UI tests, e.g.
// exp://127.0.0.1:8081/--/dev-reset?onboarded=1&exam=LSAT&demo=1
// In release builds it just goes home.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { loadDemoHistory } from '@/dev/demo';
import { useStore } from '@/state/store';

export default function DevReset() {
  const { onboarded, exam, demo, exams } = useLocalSearchParams<{ onboarded?: string; exam?: string; demo?: string; exams?: string }>();
  useEffect(() => {
    const go = async () => {
      if (__DEV__) {
        const which = exam === 'MCAT' ? 'MCAT' : 'LSAT';
        const enrolled = (exams ?? which).split(',').filter((e): e is 'LSAT' | 'MCAT' => e === 'LSAT' || e === 'MCAT');
        await useStore
          .getState()
          .resetProgress(onboarded === '1' ? { onboarded: true, exam: which, exams: enrolled.includes(which) ? enrolled : [which, ...enrolled] } : undefined);
        if (demo === '1') await loadDemoHistory(which);
      }
      if (router.canGoBack()) router.back();
      else router.replace('/');
    };
    go();
  }, [onboarded, exam, demo, exams]);
  return null;
}
