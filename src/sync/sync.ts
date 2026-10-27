// Offline-first sync with Supabase.
//
// Push: every local row that hasn't been uploaded yet. Event ids are made on the
// device (UUIDv7), so retries can't duplicate anything.
// Pull: rows changed on the server since the last cursor, merged locally
// (events are a union; concept cards and settings keep the newer copy).

import type { Attempt, CardRow, Review, Settings, XpEvent } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { flushWrites, getRepo, useStore } from '@/state/store';

export type SyncResult =
  | { ok: true; pushed: number; pulled: number }
  | { ok: false; reason: 'not_configured' | 'no_account' | 'offline' | 'error'; message?: string };

const BATCH = 200;
const PULL_LIMIT = 1000;
let running: Promise<SyncResult> | null = null;

type Cursor = Record<'attempts' | 'reviews' | 'xp_events' | 'cards' | 'profiles', string>;
const EPOCH = '1970-01-01T00:00:00Z';
const freshCursor = (): Cursor => ({ attempts: EPOCH, reviews: EPOCH, xp_events: EPOCH, cards: EPOCH, profiles: EPOCH });

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  // Start everyone with an anonymous account so progress is backed up from day one.
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw Object.assign(new Error(error.message), { anonymousDisabled: true });
  return anon.user?.id ?? null;
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) out.push(rows.slice(i, i + BATCH));
  return out;
}

async function push(userId: string): Promise<number> {
  const repo = getRepo()!;
  const db = supabase!;
  const pending = await repo.unsynced();
  let pushed = 0;

  for (const rows of chunks(pending.attempts)) {
    const { error } = await db.from('attempts').upsert(
      rows.map((a) => ({ user_id: userId, id: a.id, data: a, item_id: a.itemId, exam: a.exam, correct: a.correct, at: new Date(a.at).toISOString() })),
      { onConflict: 'user_id,id' },
    );
    if (error) throw error;
    await repo.markSynced('attempts', rows.map((r) => r.id));
    pushed += rows.length;
  }
  for (const rows of chunks(pending.reviews)) {
    const { error } = await db
      .from('reviews')
      .upsert(rows.map((r) => ({ user_id: userId, id: r.id, data: r, at: new Date(r.at).toISOString() })), { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw error;
    await repo.markSynced('reviews', rows.map((r) => r.id));
    pushed += rows.length;
  }
  for (const rows of chunks(pending.xpEvents)) {
    const { error } = await db
      .from('xp_events')
      .upsert(rows.map((e) => ({ user_id: userId, id: e.id, data: e, at: new Date(e.at).toISOString() })), { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw error;
    await repo.markSynced('xp_events', rows.map((e) => e.id));
    pushed += rows.length;
  }
  for (const rows of chunks(pending.cards)) {
    const { error } = await db
      .from('cards')
      .upsert(rows.map((c) => ({ user_id: userId, kp_id: c.kpId, data: c, client_updated_at: c.updatedAt })), { onConflict: 'user_id,kp_id' });
    if (error) throw error;
    await repo.markSynced('cards', rows.map((c) => c.kpId));
    pushed += rows.length;
  }
  if (pending.settings) {
    const { error } = await db
      .from('profiles')
      .upsert({ user_id: userId, settings: pending.settings.value, client_updated_at: pending.settings.updatedAt }, { onConflict: 'user_id' });
    if (error) throw error;
    await repo.markSynced('settings', []);
    pushed += 1;
  }
  return pushed;
}

async function pullTable<T>(table: keyof Cursor, since: string, select: string): Promise<{ rows: T[]; cursor: string }> {
  const { data, error } = await supabase!.from(table).select(select).gt('updated_at', since).order('updated_at').limit(PULL_LIMIT);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (T & { updated_at: string })[];
  return { rows, cursor: rows.length ? rows[rows.length - 1].updated_at : since };
}

async function pull(cursor: Cursor): Promise<{ pulled: number; cursor: Cursor }> {
  const repo = getRepo()!;
  const next = { ...cursor };
  const attempts = await pullTable<{ data: Attempt }>('attempts', cursor.attempts, 'data, updated_at');
  const reviews = await pullTable<{ data: Review }>('reviews', cursor.reviews, 'data, updated_at');
  const xp = await pullTable<{ data: XpEvent }>('xp_events', cursor.xp_events, 'data, updated_at');
  const cards = await pullTable<{ data: CardRow }>('cards', cursor.cards, 'data, updated_at');
  const profiles = await pullTable<{ settings: Settings; client_updated_at: number }>('profiles', cursor.profiles, 'settings, client_updated_at, updated_at');
  next.attempts = attempts.cursor;
  next.reviews = reviews.cursor;
  next.xp_events = xp.cursor;
  next.cards = cards.cursor;
  next.profiles = profiles.cursor;

  const profile = profiles.rows[0];
  await repo.mergeRemote({
    attempts: attempts.rows.map((r) => r.data),
    reviews: reviews.rows.map((r) => r.data),
    xpEvents: xp.rows.map((r) => r.data),
    cards: cards.rows.map((r) => r.data),
    settings: profile && Object.keys(profile.settings ?? {}).length ? { value: profile.settings, updatedAt: Number(profile.client_updated_at) } : undefined,
  });
  const pulled = attempts.rows.length + reviews.rows.length + xp.rows.length + cards.rows.length + profiles.rows.length;
  return { pulled, cursor: next };
}

async function run(): Promise<SyncResult> {
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const repo = getRepo();
  if (!repo) return { ok: false, reason: 'error', message: 'storage not ready' };
  let userId: string | null;
  try {
    userId = await currentUserId();
  } catch (e) {
    const anonymousDisabled = (e as { anonymousDisabled?: boolean }).anonymousDisabled;
    return { ok: false, reason: anonymousDisabled ? 'no_account' : 'offline', message: (e as Error).message };
  }
  if (!userId) return { ok: false, reason: 'no_account' };

  try {
    await flushWrites();
    const meta = useStore.getState().meta;
    let cursor = (meta.syncCursor as Cursor | undefined) ?? freshCursor();
    if (meta.syncUserId !== userId) {
      // A different account on this device: upload everything to it and pull all of its data.
      await repo.markAllUnsynced();
      cursor = freshCursor();
    }
    const pushed = await push(userId);
    const result = await pull(cursor);
    const store = useStore.getState();
    store.setMeta('syncUserId', userId);
    store.setMeta('syncCursor', result.cursor);
    store.setMeta('lastSyncAt', Date.now());
    if (result.pulled > 0) await store.reload();
    return { ok: true, pushed, pulled: result.pulled };
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    const offline = /network|abort|timed? ?out|fetch/i.test(message);
    return { ok: false, reason: offline ? 'offline' : 'error', message };
  }
}

/** Runs one sync pass; concurrent callers share the same pass. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = run().finally(() => (running = null));
  return running;
}
