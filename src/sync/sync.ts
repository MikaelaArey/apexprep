// Connects the sync engine to the app: the Supabase client, the local database
// and the store.

import { supabase } from '@/lib/supabase';
import { flushWrites, getRepo, useStore } from '@/state/store';
import { runSync, type SyncResult } from './engine';

export type { SyncResult } from './engine';

let running: Promise<SyncResult> | null = null;

async function run(): Promise<SyncResult> {
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const repo = getRepo();
  if (!repo) return { ok: false, reason: 'error', message: 'storage not ready' };
  return runSync({
    client: supabase,
    repo,
    meta: () => useStore.getState().meta,
    setMeta: (key, value) => useStore.getState().setMeta(key, value),
    reload: () => useStore.getState().reload(),
    flush: flushWrites,
  });
}

/** Runs one sync pass; concurrent callers share the same pass. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = run().finally(() => (running = null));
  return running;
}
