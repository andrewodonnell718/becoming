/**
 * Optional Supabase sync + auth. With no VITE_SUPABASE_* env vars the app runs
 * fully offline and none of this activates.
 */
import { createClient, type Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { markAllDirty, mergeRecords, onLocalChange, takeDirty, type SyncRecord } from './store';
import type { Base, CollectionName } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key) : null;

export interface SyncStatus {
  email: string | null;
  state: 'offline-only' | 'signed-out' | 'idle' | 'syncing' | 'error';
  lastSynced: number | null;
  error: string | null;
}

let status: SyncStatus = { email: null, state: supabase ? 'signed-out' : 'offline-only', lastSynced: null, error: null };
const listeners = new Set<() => void>();
const setStatus = (p: Partial<SyncStatus>) => {
  status = { ...status, ...p };
  listeners.forEach((fn) => fn());
};
export const useSyncStatus = () =>
  useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), () => status);
export const isSignedIn = () => !!session;

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

interface Row { collection: CollectionName; id: string; data: Base; updated_at: number }

async function pullAll(): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase!
      .from('records')
      .select('collection,id,data,updated_at')
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data as Row[]));
    if (!data || data.length < page) return out;
  }
}

async function doSync() {
  if (!supabase || !session) return;
  setStatus({ state: 'syncing', error: null });
  try {
    const rows = await pullAll();
    mergeRecords(rows.map((r) => ({ collection: r.collection, id: r.id, data: r.data, updatedAt: Number(r.updated_at) })));

    const batch = takeDirty();
    for (let i = 0; i < batch.records.length; i += 500) {
      const chunk: SyncRecord[] = batch.records.slice(i, i + 500);
      const { error } = await supabase.from('records').upsert(
        chunk.map((r) => ({ collection: r.collection, id: r.id, data: r.data, updated_at: r.updatedAt, deleted: !!r.data.deleted })),
      );
      if (error) throw error;
    }
    batch.ack(batch.records);
    setStatus({ state: 'idle', lastSynced: Date.now() });
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = doSync().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

export function initSync() {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((event, s) => {
    const wasSignedOut = !session;
    session = s;
    setStatus({ email: s?.user.email ?? null, state: s ? 'idle' : 'signed-out' });
    if (s && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      if (wasSignedOut && event === 'SIGNED_IN') markAllDirty(); // upload this device's data
      setTimeout(() => void syncNow(), 0);
    }
  });
  onLocalChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function createAccount(email: string, password: string) {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) throw error;
  // With "Confirm email" off in Supabase, sign-up returns a session straight away.
  if (!data.session) throw new Error('Account created. Turn off "Confirm email" in Supabase, or confirm via the email, then sign in.');
}

export async function signOut() {
  await supabase?.auth.signOut();
}
