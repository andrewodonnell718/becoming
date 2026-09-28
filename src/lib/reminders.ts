/**
 * Reminder preferences (per device) and web-push subscription.
 *
 * In-app nudges always work: Today reads these times to decide what to surface.
 * Phone notifications additionally need Supabase + a VAPID key; the `remind`
 * edge function sends them and skips any that are already done.
 */
import { useSyncExternalStore } from 'react';
import { isSignedIn, supabase } from './sync';

export interface ReminderPrefs {
  morning: { on: boolean; time: string };
  evening: { on: boolean; time: string };
  /** day: 0 = Sunday … 6 = Saturday */
  weekly: { on: boolean; day: number; time: string };
}

const KEY = 'becoming:reminders:v1';
export const DEFAULT_PREFS: ReminderPrefs = {
  morning: { on: true, time: '07:00' },
  evening: { on: true, time: '20:30' },
  weekly: { on: true, day: 0, time: '18:00' },
};

function load(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ReminderPrefs>;
    return {
      morning: { ...DEFAULT_PREFS.morning, ...p.morning },
      evening: { ...DEFAULT_PREFS.evening, ...p.evening },
      weekly: { ...DEFAULT_PREFS.weekly, ...p.weekly },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

let prefs = load();
const listeners = new Set<() => void>();

export const usePrefs = () =>
  useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), () => prefs);
export const getPrefs = () => prefs;

export function setPrefs(next: ReminderPrefs) {
  prefs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
  void pushPrefsToServer();
}

/** "HH:MM" of `now` has reached `time`. */
export function isPast(time: string, now = new Date()) {
  const [h, m] = time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

/** Whether the weekly review should be surfaced now: on/after the chosen day+time, through the end of that week. */
export function weeklyDue(now = new Date()) {
  const { weekly } = prefs;
  if (!weekly.on) return false;
  // Compare positions within a Monday-first week.
  const pos = (d: number) => (d + 6) % 7;
  const today = pos(now.getDay());
  const target = pos(weekly.day);
  return today > target || (today === target && isPast(weekly.time, now));
}

// ---------- web push ----------

const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = 'unsupported' | 'needs-setup' | 'needs-signin' | 'needs-install' | 'denied' | 'off' | 'on';

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iOS only exposes push to apps added to the home screen.
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios && !matchMedia('(display-mode: standalone)').matches ? 'needs-install' : 'unsupported';
  }
  if (!supabase || !vapid) return 'needs-setup';
  if (!isSignedIn()) return 'needs-signin';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

const toKey = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export async function enablePush() {
  if (!supabase || !vapid) throw new Error('Notifications need Supabase and a VAPID key. See the README.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications were not allowed.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapid) }));
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
    time_zone: timeZone(),
    prefs,
  });
  if (error) throw error;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

async function pushPrefsToServer() {
  if (!supabase || !isSignedIn() || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await supabase.from('push_subscriptions').update({ prefs, time_zone: timeZone() }).eq('endpoint', sub.endpoint);
}
