/**
 * @jest-environment node
 *
 * Runs the real sync engine against the local Supabase stand-in
 * (supabase/test/start-local.sh): Postgres with schema.sql applied, PostgREST,
 * and a minimal auth server. Run with `npm run test:sync`.
 */
import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '@/data/repo';
import { DEFAULT_SETTINGS, type Attempt, type CardRow, type Review } from '@/data/types';
import { uuidv7 } from '@/engine/ids';
import { newCard } from '@/engine/srs';
import { dayKey } from '@/engine/time';
import { runSync } from '@/sync/engine';

const URL = 'http://localhost:54321';
const SECRET = 'apexprep-local-test-secret-0123456789abcdef';

function anonKey(): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ role: 'anon', iss: 'local', iat: 1, exp: 4102444800 });
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}

function client(): SupabaseClient {
  return createClient(URL, anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A simulated phone: its own local database, metadata and Supabase session. */
function device(c: SupabaseClient = client()) {
  const repo = new MemoryRepo();
  const meta: Record<string, unknown> = {};
  let reloads = 0;
  const sync = () =>
    runSync({
      client: c,
      repo,
      meta: () => meta,
      setMeta: (k, v) => (meta[k] = v),
      reload: async () => void reloads++,
      flush: async () => undefined,
    });
  return { client: c, repo, meta, sync, reloads: () => reloads };
}

function attempt(itemId: string, correct: boolean, at = Date.now()): Attempt {
  return {
    id: uuidv7(at),
    itemId,
    itemVersion: 1,
    exam: 'LSAT',
    section: 'LR',
    at,
    day: dayKey(at),
    mode: 'daily5',
    sessionId: 's',
    selected: correct ? 'B' : 'A',
    correct,
    ms: 50000,
    confidence: 'sure',
    eliminated: [],
    changed: false,
    missReason: null,
    xp: correct ? 15 : 0,
  };
}

function card(kpId: string, updatedAt: number, due: number): CardRow {
  return { kpId, exam: 'LSAT', card: { ...newCard(updatedAt), due }, source: 'miss', addedAt: updatedAt, updatedAt };
}

beforeAll(async () => {
  const res = await fetch(`${URL}/health`).catch(() => null);
  if (!res?.ok) throw new Error('Local Supabase stand-in is not running. Use `npm run test:sync`.');
});

describe('sync against Supabase schema', () => {
  it('backs up a new guest and restores everything on a second phone', async () => {
    const phone = device();
    await phone.repo.addAttempt(attempt('lsat-lr-0001', false));
    await phone.repo.addAttempt(attempt('lsat-lr-0002', true));
    const review: Review = { id: uuidv7(), kpId: 'kp-lsat-rival-cause', exam: 'LSAT', at: Date.now(), day: dayKey(Date.now()), rating: 1, kind: 'question', itemId: 'lsat-lr-0001', ms: 40000, xp: 0 };
    await phone.repo.addReview(review);
    await phone.repo.putCard(card('kp-lsat-rival-cause', Date.now(), Date.now() + 86400000));
    await phone.repo.saveSettings({ ...DEFAULT_SETTINGS, onboarded: true, exam: 'LSAT', dailyGoalMin: 20 });

    const first = await phone.sync();
    expect(first).toMatchObject({ ok: true });
    expect(first.ok && first.pushed).toBe(5);
    expect((await phone.repo.unsynced()).attempts).toHaveLength(0);

    // Second phone, same account (same session), empty database.
    const second = device(phone.client);
    const result = await second.sync();
    expect(result).toMatchObject({ ok: true });
    const data = await second.repo.load();
    expect(data.attempts.map((a) => a.itemId).sort()).toEqual(['lsat-lr-0001', 'lsat-lr-0002']);
    expect(data.reviews).toHaveLength(1);
    expect(data.cards.map((c) => c.kpId)).toEqual(['kp-lsat-rival-cause']);
    expect(data.settings.dailyGoalMin).toBe(20);
    expect(second.reloads()).toBe(1);
  });

  it('is idempotent: syncing again uploads and downloads nothing new', async () => {
    const phone = device();
    await phone.repo.addAttempt(attempt('lsat-lr-0003', true));
    await phone.sync();
    const again = await phone.sync();
    expect(again).toEqual({ ok: true, pushed: 0, pulled: 0 });
  });

  it('keeps every account private', async () => {
    const alice = device();
    await alice.repo.addAttempt(attempt('lsat-lr-0004', true));
    await alice.sync();
    const bob = device();
    await bob.sync();
    const { data } = await bob.client.from('attempts').select('item_id');
    expect(data).toEqual([]);
    expect((await bob.repo.load()).attempts).toHaveLength(0);
  });

  it('keeps the newer copy of a concept card', async () => {
    const phone = device();
    const t = Date.now();
    await phone.repo.putCard(card('kp-lsat-negation-test', t, t + 3 * 86400000));
    await phone.sync();

    // An older edit from another device must not overwrite the newer one.
    const other = device(phone.client);
    await other.sync();
    await other.repo.putCard(card('kp-lsat-negation-test', t - 60000, t + 86400000));
    await other.sync();

    const { data } = await phone.client.from('cards').select('client_updated_at').eq('kp_id', 'kp-lsat-negation-test').single();
    expect(Number(data!.client_updated_at)).toBe(t);
  });

  it('uploads this phone’s work when it signs in to a different account', async () => {
    const phone = device();
    await phone.repo.addAttempt(attempt('lsat-lr-0005', true));
    await phone.sync();
    const firstUser = phone.meta.syncUserId;

    // Sign in as someone else on the same phone (an email account).
    await phone.client.auth.signOut();
    await phone.client.auth.signInWithOtp({ email: 'student@example.com' });
    const verified = await phone.client.auth.verifyOtp({ email: 'student@example.com', token: '123456', type: 'email' });
    expect(verified.error).toBeNull();
    const result = await phone.sync();
    expect(result).toMatchObject({ ok: true });
    expect(phone.meta.syncUserId).not.toBe(firstUser);
    const { data } = await phone.client.from('attempts').select('item_id');
    expect(data?.map((r) => r.item_id)).toContain('lsat-lr-0005');
  });

  it('reports how everyone answered, counting each student’s first answer', async () => {
    const id = `lsat-lr-77${Math.floor(Math.random() * 90 + 10)}`;
    for (const [first, second] of [
      [false, true],
      [true, true],
      [false, false],
    ]) {
      const phone = device();
      await phone.repo.addAttempt(attempt(id, first, Date.now() - 1000));
      await phone.repo.addAttempt(attempt(id, second));
      await phone.sync();
    }
    const asker = device();
    await asker.sync();
    const { data, error } = await asker.client.rpc('item_answer_counts', { p_item_id: id });
    expect(error).toBeNull();
    const counts = Object.fromEntries((data as { selected: string; n: number }[]).map((r) => [r.selected, Number(r.n)]));
    expect(counts).toEqual({ A: 2, B: 1 });
  });

  it('deletes the account and all of its rows', async () => {
    const phone = device();
    await phone.repo.addAttempt(attempt('lsat-lr-0006', true));
    await phone.repo.putCard(card('kp-lsat-concession', Date.now(), Date.now()));
    await phone.sync();
    const { error } = await phone.client.rpc('delete_my_account');
    expect(error).toBeNull();
    const { data: attempts } = await phone.client.from('attempts').select('item_id');
    const { data: cards } = await phone.client.from('cards').select('kp_id');
    expect(attempts).toEqual([]);
    expect(cards).toEqual([]);
  });
});
