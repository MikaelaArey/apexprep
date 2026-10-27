// Storage interface for user data. The app uses the SQLite implementation
// (./sqlite.ts); tests use MemoryRepo. Rows carry a `synced` flag so the sync
// engine knows what still has to go to the server.

import type { ActiveSession } from '@/state/session-types';
import { DEFAULT_SETTINGS, type Attempt, type CardRow, type Review, type Settings, type XpEvent } from './types';

export interface UserData {
  attempts: Attempt[];
  reviews: Review[];
  cards: CardRow[];
  xpEvents: XpEvent[];
  settings: Settings;
  session: ActiveSession | null;
  meta: Record<string, unknown>;
}

export interface Unsynced {
  attempts: Attempt[];
  reviews: Review[];
  cards: CardRow[];
  xpEvents: XpEvent[];
  settings: { value: Settings; updatedAt: number } | null;
}

export type SyncTable = 'attempts' | 'reviews' | 'cards' | 'xp_events' | 'settings';

export interface Repo {
  load(): Promise<UserData>;
  addAttempt(a: Attempt): Promise<void>;
  updateAttempt(a: Attempt): Promise<void>;
  addReview(r: Review): Promise<void>;
  putCard(c: CardRow): Promise<void>;
  addXpEvent(e: XpEvent): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  saveSession(s: ActiveSession | null): Promise<void>;
  setMeta(key: string, value: unknown): Promise<void>;
  unsynced(): Promise<Unsynced>;
  markSynced(table: SyncTable, ids: string[]): Promise<void>;
  markAllUnsynced(): Promise<void>;
  /** Merges rows from the server: new events are inserted, cards keep the newer copy. */
  mergeRemote(data: Partial<Omit<UserData, 'session' | 'meta' | 'settings'>> & { settings?: { value: Settings; updatedAt: number } }): Promise<void>;
  reset(): Promise<void>;
}

export function mergeSettings(stored: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  // Older installs had no exam list: enroll them in the exam they were using.
  const exams = stored?.exams?.length ? [...new Set(stored.exams)] : [s.exam];
  return {
    ...s,
    exam: exams.includes(s.exam) ? s.exam : exams[0],
    exams,
    plans: { ...DEFAULT_SETTINGS.plans, ...(stored?.plans ?? {}) },
    reminder: { ...DEFAULT_SETTINGS.reminder, ...(stored?.reminder ?? {}) },
  };
}

/** In-memory repo for tests and previews. */
export class MemoryRepo implements Repo {
  private attempts = new Map<string, { row: Attempt; synced: boolean }>();
  private reviews = new Map<string, { row: Review; synced: boolean }>();
  private cards = new Map<string, { row: CardRow; synced: boolean }>();
  private xpEvents = new Map<string, { row: XpEvent; synced: boolean }>();
  private settings: { value: Settings; updatedAt: number; synced: boolean } = {
    value: DEFAULT_SETTINGS,
    updatedAt: 0,
    synced: true,
  };
  private session: ActiveSession | null = null;
  private meta: Record<string, unknown> = {};

  async load(): Promise<UserData> {
    return {
      attempts: [...this.attempts.values()].map((v) => v.row).sort((a, b) => a.at - b.at),
      reviews: [...this.reviews.values()].map((v) => v.row).sort((a, b) => a.at - b.at),
      cards: [...this.cards.values()].map((v) => v.row),
      xpEvents: [...this.xpEvents.values()].map((v) => v.row),
      settings: mergeSettings(this.settings.value),
      session: this.session,
      meta: { ...this.meta },
    };
  }
  async addAttempt(a: Attempt) {
    this.attempts.set(a.id, { row: a, synced: false });
  }
  async updateAttempt(a: Attempt) {
    this.attempts.set(a.id, { row: a, synced: false });
  }
  async addReview(r: Review) {
    this.reviews.set(r.id, { row: r, synced: false });
  }
  async putCard(c: CardRow) {
    this.cards.set(c.kpId, { row: c, synced: false });
  }
  async addXpEvent(e: XpEvent) {
    this.xpEvents.set(e.id, { row: e, synced: false });
  }
  async saveSettings(s: Settings) {
    this.settings = { value: s, updatedAt: Date.now(), synced: false };
  }
  async saveSession(s: ActiveSession | null) {
    this.session = s;
  }
  async setMeta(key: string, value: unknown) {
    this.meta[key] = value;
  }
  async unsynced(): Promise<Unsynced> {
    const pending = <T>(m: Map<string, { row: T; synced: boolean }>) => [...m.values()].filter((v) => !v.synced).map((v) => v.row);
    return {
      attempts: pending(this.attempts),
      reviews: pending(this.reviews),
      cards: pending(this.cards),
      xpEvents: pending(this.xpEvents),
      settings: this.settings.synced ? null : { value: this.settings.value, updatedAt: this.settings.updatedAt },
    };
  }
  async markSynced(table: SyncTable, ids: string[]) {
    if (table === 'settings') {
      this.settings.synced = true;
      return;
    }
    const map = { attempts: this.attempts, reviews: this.reviews, cards: this.cards, xp_events: this.xpEvents }[table] as Map<
      string,
      { synced: boolean }
    >;
    for (const id of ids) {
      const v = map.get(id);
      if (v) v.synced = true;
    }
  }
  async markAllUnsynced() {
    for (const m of [this.attempts, this.reviews, this.cards, this.xpEvents] as Map<string, { synced: boolean }>[]) {
      for (const v of m.values()) v.synced = false;
    }
    this.settings.synced = false;
  }
  async mergeRemote(data: Parameters<Repo['mergeRemote']>[0]) {
    for (const a of data.attempts ?? []) {
      const cur = this.attempts.get(a.id);
      if (!cur || cur.synced) this.attempts.set(a.id, { row: a, synced: true });
    }
    for (const r of data.reviews ?? []) if (!this.reviews.has(r.id)) this.reviews.set(r.id, { row: r, synced: true });
    for (const e of data.xpEvents ?? []) if (!this.xpEvents.has(e.id)) this.xpEvents.set(e.id, { row: e, synced: true });
    for (const c of data.cards ?? []) {
      const cur = this.cards.get(c.kpId);
      if (!cur || cur.row.updatedAt < c.updatedAt) this.cards.set(c.kpId, { row: c, synced: true });
    }
    if (data.settings && data.settings.updatedAt > this.settings.updatedAt) {
      this.settings = { ...data.settings, synced: true };
    }
  }
  async reset() {
    this.attempts.clear();
    this.reviews.clear();
    this.cards.clear();
    this.xpEvents.clear();
    this.settings = { value: DEFAULT_SETTINGS, updatedAt: 0, synced: true };
    this.session = null;
    this.meta = {};
  }
}
