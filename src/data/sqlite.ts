// SQLite-backed user data. Rows are stored as JSON with a few indexed columns;
// the local database is the source of truth and works with no connection.

import * as SQLite from 'expo-sqlite';
import type { ActiveSession } from '@/state/session-types';
import { mergeSettings, type Repo, type SyncTable, type Unsynced, type UserData } from './repo';
import type { Attempt, CardRow, Review, Settings, XpEvent } from './types';

const SCHEMA_VERSION = 1;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS attempts_at ON attempts (at);
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS cards (
      kp_id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 1);
  `,
};

type Row = { data: string };
type KvRow = { key: string; value: string; updated_at: number; synced: number };

/**
 * Opens the database synchronously so the app's first render already has the
 * user's data: no loading screen, and links opened at launch route correctly.
 */
export function openRepoSync(name = 'apexprep.db'): { repo: Repo; data: UserData } {
  const db = SQLite.openDatabaseSync(name);
  db.execSync('PRAGMA journal_mode = WAL;');
  const userVersion = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  for (let v = userVersion + 1; v <= SCHEMA_VERSION; v++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v}`);
    });
  }
  const repo = new SqliteRepo(db);
  return { repo, data: repo.loadSync() };
}

export async function openRepo(name = 'apexprep.db'): Promise<Repo> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const { user_version } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')) ?? { user_version: 0 };
  for (let v = user_version + 1; v <= SCHEMA_VERSION; v++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[v]);
      await tx.execAsync(`PRAGMA user_version = ${v}`);
    });
  }
  return new SqliteRepo(db);
}

class SqliteRepo implements Repo {
  constructor(private db: SQLite.SQLiteDatabase) {}

  private async all<T>(sql: string): Promise<T[]> {
    return (await this.db.getAllAsync<Row>(sql)).map((r) => JSON.parse(r.data) as T);
  }

  private async putKv(key: string, value: unknown, synced: boolean) {
    await this.db.runAsync(
      'INSERT INTO kv (key, value, updated_at, synced) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, synced = excluded.synced',
      key,
      JSON.stringify(value ?? null),
      Date.now(),
      synced ? 1 : 0,
    );
  }

  loadSync(): UserData {
    const all = <T,>(sql: string) => this.db.getAllSync<Row>(sql).map((r) => JSON.parse(r.data) as T);
    return this.assemble(this.db.getAllSync<KvRow>('SELECT key, value, updated_at, synced FROM kv'), {
      attempts: all<Attempt>('SELECT data FROM attempts ORDER BY at'),
      reviews: all<Review>('SELECT data FROM reviews ORDER BY at'),
      cards: all<CardRow>('SELECT data FROM cards'),
      xpEvents: all<XpEvent>('SELECT data FROM xp_events ORDER BY at'),
    });
  }

  private assemble(kv: KvRow[], rows: Pick<UserData, 'attempts' | 'reviews' | 'cards' | 'xpEvents'>): UserData {
    const get = (key: string) => {
      const row = kv.find((r) => r.key === key);
      return row ? JSON.parse(row.value) : null;
    };
    const meta: Record<string, unknown> = {};
    for (const row of kv) if (row.key.startsWith('meta:')) meta[row.key.slice(5)] = JSON.parse(row.value);
    return { ...rows, settings: mergeSettings(get('settings')), session: get('session'), meta };
  }

  async load(): Promise<UserData> {
    return this.assemble(await this.db.getAllAsync<KvRow>('SELECT key, value, updated_at, synced FROM kv'), {
      attempts: await this.all<Attempt>('SELECT data FROM attempts ORDER BY at'),
      reviews: await this.all<Review>('SELECT data FROM reviews ORDER BY at'),
      cards: await this.all<CardRow>('SELECT data FROM cards'),
      xpEvents: await this.all<XpEvent>('SELECT data FROM xp_events ORDER BY at'),
    });
  }

  async addAttempt(a: Attempt) {
    await this.db.runAsync('INSERT OR REPLACE INTO attempts (id, data, at, synced) VALUES (?, ?, ?, 0)', a.id, JSON.stringify(a), a.at);
  }
  async updateAttempt(a: Attempt) {
    await this.addAttempt(a);
  }
  async addReview(r: Review) {
    await this.db.runAsync('INSERT OR REPLACE INTO reviews (id, data, at, synced) VALUES (?, ?, ?, 0)', r.id, JSON.stringify(r), r.at);
  }
  async putCard(c: CardRow) {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO cards (kp_id, data, updated_at, synced) VALUES (?, ?, ?, 0)',
      c.kpId,
      JSON.stringify(c),
      c.updatedAt,
    );
  }
  async addXpEvent(e: XpEvent) {
    await this.db.runAsync('INSERT OR REPLACE INTO xp_events (id, data, at, synced) VALUES (?, ?, ?, 0)', e.id, JSON.stringify(e), e.at);
  }
  async saveSettings(s: Settings) {
    await this.putKv('settings', s, false);
  }
  async saveSession(s: ActiveSession | null) {
    await this.putKv('session', s, true);
  }
  async setMeta(key: string, value: unknown) {
    await this.putKv(`meta:${key}`, value, true);
  }

  async unsynced(): Promise<Unsynced> {
    const settingsRow = await this.db.getFirstAsync<KvRow>("SELECT key, value, updated_at, synced FROM kv WHERE key = 'settings' AND synced = 0");
    return {
      attempts: await this.all<Attempt>('SELECT data FROM attempts WHERE synced = 0 ORDER BY at LIMIT 500'),
      reviews: await this.all<Review>('SELECT data FROM reviews WHERE synced = 0 ORDER BY at LIMIT 500'),
      cards: await this.all<CardRow>('SELECT data FROM cards WHERE synced = 0 LIMIT 500'),
      xpEvents: await this.all<XpEvent>('SELECT data FROM xp_events WHERE synced = 0 LIMIT 500'),
      settings: settingsRow ? { value: mergeSettings(JSON.parse(settingsRow.value)), updatedAt: settingsRow.updated_at } : null,
    };
  }

  async markSynced(table: SyncTable, ids: string[]) {
    if (table === 'settings') {
      await this.db.runAsync("UPDATE kv SET synced = 1 WHERE key = 'settings'");
      return;
    }
    if (ids.length === 0) return;
    const key = table === 'cards' ? 'kp_id' : 'id';
    const marks = ids.map(() => '?').join(',');
    await this.db.runAsync(`UPDATE ${table} SET synced = 1 WHERE ${key} IN (${marks})`, ...ids);
  }

  async markAllUnsynced() {
    await this.db.execAsync(`
      UPDATE attempts SET synced = 0; UPDATE reviews SET synced = 0; UPDATE cards SET synced = 0;
      UPDATE xp_events SET synced = 0; UPDATE kv SET synced = 0 WHERE key = 'settings';
    `);
  }

  async mergeRemote(data: Parameters<Repo['mergeRemote']>[0]) {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      for (const a of data.attempts ?? []) {
        // Keep local edits that haven't been uploaded yet.
        await tx.runAsync(
          'INSERT INTO attempts (id, data, at, synced) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET data = excluded.data WHERE attempts.synced = 1',
          a.id,
          JSON.stringify(a),
          a.at,
        );
      }
      for (const r of data.reviews ?? []) {
        await tx.runAsync('INSERT OR IGNORE INTO reviews (id, data, at, synced) VALUES (?, ?, ?, 1)', r.id, JSON.stringify(r), r.at);
      }
      for (const e of data.xpEvents ?? []) {
        await tx.runAsync('INSERT OR IGNORE INTO xp_events (id, data, at, synced) VALUES (?, ?, ?, 1)', e.id, JSON.stringify(e), e.at);
      }
      for (const c of data.cards ?? []) {
        await tx.runAsync(
          'INSERT INTO cards (kp_id, data, updated_at, synced) VALUES (?, ?, ?, 1) ON CONFLICT(kp_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, synced = 1 WHERE cards.updated_at < excluded.updated_at',
          c.kpId,
          JSON.stringify(c),
          c.updatedAt,
        );
      }
      if (data.settings) {
        await tx.runAsync(
          "INSERT INTO kv (key, value, updated_at, synced) VALUES ('settings', ?, ?, 1) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, synced = 1 WHERE kv.updated_at < excluded.updated_at",
          JSON.stringify(data.settings.value),
          data.settings.updatedAt,
        );
      }
    });
  }

  async reset() {
    await this.db.execAsync('DELETE FROM attempts; DELETE FROM reviews; DELETE FROM cards; DELETE FROM xp_events; DELETE FROM kv;');
  }
}
