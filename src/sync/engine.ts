// Offline-first sync with Supabase. This file has no app wiring, so it can be
// tested against a real (local) database; ./sync.ts connects it to the app.
//
// Push: every local row not yet uploaded. Event ids are made on the device
// (UUIDv7), so retries can't create duplicates.
// Pull: rows changed on the server since the last cursor, merged locally:
// events are a union; concept cards and settings keep the newer copy.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repo } from '@/data/repo';
import type { Attempt, CardRow, Review, Settings, XpEvent } from '@/data/types';

export type SyncResult =
  | { ok: true; pushed: number; pulled: number }
  | { ok: false; reason: 'not_configured' | 'no_account' | 'offline' | 'error'; message?: string };

export interface SyncDeps {
  client: SupabaseClient;
  repo: Repo;
  meta: () => Record<string, unknown>;
  setMeta: (key: string, value: unknown) => void;
  /** Re-read local data after a pull changed it. */
  reload: () => Promise<void>;
  /** Wait for queued local writes before reading what's unsynced. */
  flush: () => Promise<unknown>;
}

const BATCH = 200;
const PULL_LIMIT = 1000;

type Table = 'attempts' | 'reviews' | 'xp_events' | 'cards' | 'profiles';
export type Cursor = Record<Table, string>;
const EPOCH = '1970-01-01T00:00:00Z';
export const freshCursor = (): Cursor => ({ attempts: EPOCH, reviews: EPOCH, xp_events: EPOCH, cards: EPOCH, profiles: EPOCH });

/** The signed-in user, or a new anonymous one so progress is backed up from day one. */
export async function ensureUser(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await client.auth.signInAnonymously();
  if (error) throw Object.assign(new Error(error.message), { noAnonymous: true });
  return anon.user?.id ?? null;
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) out.push(rows.slice(i, i + BATCH));
  return out;
}

async function push(client: SupabaseClient, repo: Repo, userId: string): Promise<number> {
  let pushed = 0;
  // unsynced() returns at most 500 rows per table, so loop until it's empty.
  for (let round = 0; round < 50; round++) {
    const pending = await repo.unsynced();
    const total = pending.attempts.length + pending.reviews.length + pending.xpEvents.length + pending.cards.length + (pending.settings ? 1 : 0);
    if (total === 0) break;

    for (const rows of chunks(pending.attempts)) {
      const { error } = await client.from('attempts').upsert(
        rows.map((a) => ({ user_id: userId, id: a.id, data: a, item_id: a.itemId, exam: a.exam, correct: a.correct, at: new Date(a.at).toISOString() })),
        { onConflict: 'user_id,id' },
      );
      if (error) throw error;
      await repo.markSynced('attempts', rows.map((r) => r.id));
    }
    for (const rows of chunks(pending.reviews)) {
      const { error } = await client
        .from('reviews')
        .upsert(rows.map((r) => ({ user_id: userId, id: r.id, data: r, at: new Date(r.at).toISOString() })), { onConflict: 'user_id,id', ignoreDuplicates: true });
      if (error) throw error;
      await repo.markSynced('reviews', rows.map((r) => r.id));
    }
    for (const rows of chunks(pending.xpEvents)) {
      const { error } = await client
        .from('xp_events')
        .upsert(rows.map((e) => ({ user_id: userId, id: e.id, data: e, at: new Date(e.at).toISOString() })), { onConflict: 'user_id,id', ignoreDuplicates: true });
      if (error) throw error;
      await repo.markSynced('xp_events', rows.map((e) => e.id));
    }
    for (const rows of chunks(pending.cards)) {
      const { error } = await client
        .from('cards')
        .upsert(rows.map((c) => ({ user_id: userId, kp_id: c.kpId, data: c, client_updated_at: c.updatedAt })), { onConflict: 'user_id,kp_id' });
      if (error) throw error;
      await repo.markSynced('cards', rows.map((c) => c.kpId));
    }
    if (pending.settings) {
      const { error } = await client
        .from('profiles')
        .upsert({ user_id: userId, settings: pending.settings.value, client_updated_at: pending.settings.updatedAt }, { onConflict: 'user_id' });
      if (error) throw error;
      await repo.markSynced('settings', []);
    }
    pushed += total;
  }
  return pushed;
}

async function pullTable<T>(client: SupabaseClient, table: Table, since: string, select: string) {
  const rows: (T & { updated_at: string })[] = [];
  let cursor = since;
  for (;;) {
    const { data, error } = await client.from(table).select(select).gt('updated_at', cursor).order('updated_at').limit(PULL_LIMIT);
    if (error) throw error;
    const page = (data ?? []) as unknown as (T & { updated_at: string })[];
    rows.push(...page);
    if (page.length) cursor = page[page.length - 1].updated_at;
    if (page.length < PULL_LIMIT) break;
  }
  return { rows, cursor };
}

async function pull(client: SupabaseClient, repo: Repo, cursor: Cursor): Promise<{ pulled: number; cursor: Cursor }> {
  const attempts = await pullTable<{ data: Attempt }>(client, 'attempts', cursor.attempts, 'data, updated_at');
  const reviews = await pullTable<{ data: Review }>(client, 'reviews', cursor.reviews, 'data, updated_at');
  const xp = await pullTable<{ data: XpEvent }>(client, 'xp_events', cursor.xp_events, 'data, updated_at');
  const cards = await pullTable<{ data: CardRow }>(client, 'cards', cursor.cards, 'data, updated_at');
  const profiles = await pullTable<{ settings: Settings; client_updated_at: number }>(client, 'profiles', cursor.profiles, 'settings, client_updated_at, updated_at');
  const profile = profiles.rows[0];
  await repo.mergeRemote({
    attempts: attempts.rows.map((r) => r.data),
    reviews: reviews.rows.map((r) => r.data),
    xpEvents: xp.rows.map((r) => r.data),
    cards: cards.rows.map((r) => r.data),
    settings:
      profile && Object.keys(profile.settings ?? {}).length ? { value: profile.settings, updatedAt: Number(profile.client_updated_at) } : undefined,
  });
  return {
    pulled: attempts.rows.length + reviews.rows.length + xp.rows.length + cards.rows.length + profiles.rows.length,
    cursor: { attempts: attempts.cursor, reviews: reviews.cursor, xp_events: xp.cursor, cards: cards.cursor, profiles: profiles.cursor },
  };
}

export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  let userId: string | null;
  try {
    userId = await ensureUser(deps.client);
  } catch (e) {
    const noAnonymous = (e as { noAnonymous?: boolean }).noAnonymous;
    return { ok: false, reason: noAnonymous ? 'no_account' : 'offline', message: (e as Error).message };
  }
  if (!userId) return { ok: false, reason: 'no_account' };

  try {
    await deps.flush();
    const meta = deps.meta();
    let cursor = (meta.syncCursor as Cursor | undefined) ?? freshCursor();
    if (meta.syncUserId !== userId) {
      // A different account on this device: upload everything to it and pull all of its data.
      await deps.repo.markAllUnsynced();
      cursor = freshCursor();
    }
    const pushed = await push(deps.client, deps.repo, userId);
    const result = await pull(deps.client, deps.repo, cursor);
    deps.setMeta('syncUserId', userId);
    deps.setMeta('syncCursor', result.cursor);
    deps.setMeta('lastSyncAt', Date.now());
    if (result.pulled > 0) await deps.reload();
    return { ok: true, pushed, pulled: result.pulled };
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    const offline = /network|abort|timed? ?out|fetch/i.test(message);
    return { ok: false, reason: offline ? 'offline' : 'error', message };
  }
}
