/**
 * Local-first store. Every change is written to localStorage immediately and
 * queued in `dirty` so the sync layer can push it to Supabase when signed in.
 * Records merge last-write-wins on `updatedAt`.
 */
import { useSyncExternalStore } from 'react';
import { addDays, startOfWeek, todayKey } from './dates';
import type { Base, CollectionName, Collections, Day, Philosophy, Week } from './types';

const DATA_KEY = 'becoming:data:v1';
const DIRTY_KEY = 'becoming:dirty:v1';
export const COLLECTIONS: CollectionName[] = ['commitments', 'outcomes', 'days', 'weeks', 'philosophy'];

const empty = (): Collections => ({ commitments: {}, outcomes: {}, days: {}, weeks: {}, philosophy: {} });

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: state stays in memory */
  }
}

let state: Collections = read(DATA_KEY, empty());
const dirty = new Set<string>(read<{ keys: string[] }>(DIRTY_KEY, { keys: [] }).keys);
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();
const saveDirty = () => write(DIRTY_KEY, { keys: [...dirty] });

function commit(next: Collections, changed: string[] | null) {
  state = next;
  write(DATA_KEY, state);
  if (changed?.length) {
    changed.forEach((k) => dirty.add(k));
    saveDirty();
    changeHooks.forEach((fn) => fn());
  }
  listeners.forEach((fn) => fn());
}

export const getState = () => state;

export function useStore(): Collections {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => state,
  );
}

export function onLocalChange(fn: () => void) {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

type Rec<C extends CollectionName> = Collections[C][string];

export function put<C extends CollectionName>(coll: C, rec: Omit<Rec<C>, 'updatedAt'> & Partial<Base>) {
  const full = { ...rec, updatedAt: Date.now() } as Rec<C>;
  commit({ ...state, [coll]: { ...state[coll], [full.id]: full } }, [`${coll}/${full.id}`]);
  return full;
}

export function remove(coll: CollectionName, id: string) {
  const cur = state[coll][id];
  if (cur) put(coll, { ...cur, deleted: true });
}

/** Live (non-deleted) records of a collection. */
export const live = <C extends CollectionName>(s: Collections, coll: C): Rec<C>[] =>
  Object.values(s[coll]).filter((r) => !r.deleted) as Rec<C>[];

// ---------- day / week / philosophy helpers ----------

export const blankDay = (id: string): Day => ({ id, updatedAt: 0, kept: {}, tasks: [], obstacles: [] });

export function getDay(s: Collections, date: string): Day {
  const d = s.days[date];
  return d && !d.deleted ? { ...blankDay(date), ...d } : blankDay(date);
}

export function updateDay(date: string, fn: (d: Day) => Day) {
  const next = fn(getDay(state, date));
  return put('days', next);
}

export const blankWeek = (id: string): Week => ({ id, updatedAt: 0, priority: '', focusOutcomeIds: [], actionCounts: {} });

export function getWeek(s: Collections, anyDate: string): Week {
  const id = startOfWeek(anyDate);
  const w = s.weeks[id];
  return w && !w.deleted ? { ...blankWeek(id), ...w } : blankWeek(id);
}

export function updateWeek(anyDate: string, fn: (w: Week) => Week) {
  return put('weeks', fn(getWeek(state, anyDate)));
}

export function getPhilosophy(s: Collections): Philosophy {
  return s.philosophy.me ?? { id: 'me', updatedAt: 0, vision: '', constitution: '', principles: {} };
}

export function updatePhilosophy(fn: (p: Philosophy) => Philosophy) {
  return put('philosophy', fn(getPhilosophy(state)));
}

export const tomorrow = () => addDays(todayKey(), 1);

// ---------- sync plumbing ----------

export interface SyncRecord { collection: CollectionName; id: string; data: Base; updatedAt: number }

/** Merge records from elsewhere (cloud or an import). Newest updatedAt wins. */
export function mergeRecords(records: SyncRecord[]) {
  const next = { ...state } as Collections;
  let changed = false;
  for (const r of records) {
    if (!COLLECTIONS.includes(r.collection)) continue;
    const cur = next[r.collection][r.id];
    if (!cur || r.updatedAt > cur.updatedAt) {
      next[r.collection] = { ...next[r.collection], [r.id]: { ...r.data, id: r.id, updatedAt: r.updatedAt } } as never;
      changed = true;
    }
  }
  if (changed) commit(next, null);
}

export function replaceAll(data: Collections) {
  const next = { ...empty(), ...data };
  commit(next, COLLECTIONS.flatMap((c) => Object.keys(next[c]).map((id) => `${c}/${id}`)));
}

export function markAllDirty() {
  COLLECTIONS.forEach((c) => Object.keys(state[c]).forEach((id) => dirty.add(`${c}/${id}`)));
  saveDirty();
}

/** Snapshot of queued changes; call `ack` once they've been pushed. */
export function takeDirty() {
  const records: SyncRecord[] = [];
  for (const key of dirty) {
    const [collection, id] = key.split('/') as [CollectionName, string];
    const data = state[collection]?.[id];
    if (data) records.push({ collection, id, data, updatedAt: data.updatedAt });
    else dirty.delete(key);
  }
  return {
    records,
    ack(pushed: SyncRecord[]) {
      // Only clear records that weren't edited again while the push was in flight.
      for (const r of pushed)
        if (state[r.collection][r.id]?.updatedAt === r.updatedAt) dirty.delete(`${r.collection}/${r.id}`);
      saveDirty();
    },
  };
}
