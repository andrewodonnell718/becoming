import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { toast } from '../components/Toast';
import { todayKey } from '../lib/dates';
import { disablePush, enablePush, pushState, setPrefs, usePrefs, type PushState, type ReminderPrefs } from '../lib/reminders';
import { getState, replaceAll } from '../lib/store';
import { createAccount, signIn, signOut, syncNow, useSyncStatus } from '../lib/sync';
import type { Collections } from '../lib/types';

export function Settings({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="row between">
          <h2>Account & data</h2>
          <button className="small muted" onClick={onClose}>Close</button>
        </div>
        <RemindersCard />
        <SyncCard />
        <DataCard />
        <p className="small faint" style={{ textAlign: 'center' }}>Becoming v0.1</p>
      </div>
    </Sheet>
  );
}

function SyncCard() {
  const s = useSyncStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass pad stack" style={{ gap: 12 }}>
      <h3>Sync & AI coach</h3>
      {s.state === 'offline-only' && (
        <p className="small muted">
          Everything is saved on this device. To sync across your phone and computer and to turn on the AI coach, connect
          Supabase (see the README).
        </p>
      )}
      {s.state === 'signed-out' && (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => {
          e.preventDefault();
          void run(() => (mode === 'signin' ? signIn : createAccount)(email.trim(), password), mode === 'signin' ? 'Signed in. Syncing…' : 'Account created. Syncing…');
        }}>
          <p className="small muted">
            {mode === 'signin' ? 'Sign in to sync across devices and use the AI coach.' : 'Create your account. Use the same email and password on every device.'}
          </p>
          <input className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password (at least 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn primary block" disabled={busy || !email.includes('@') || password.length < 6}>
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" className="small muted" onClick={() => setMode(mode === 'signin' ? 'create' : 'signin')}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </form>
      )}
      {s.email && (
        <>
          <div className="row between">
            <div>
              <p style={{ fontWeight: 600 }}>{s.email}</p>
              <p className="small faint">
                {s.state === 'syncing' ? 'Syncing…'
                  : s.state === 'error' ? `Sync failed: ${s.error}`
                  : s.lastSynced ? `Synced ${new Date(s.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Connected'}
              </p>
            </div>
            <span className="status-dot" style={{ background: s.state === 'error' ? 'var(--bad)' : 'var(--good)' }} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} disabled={s.state === 'syncing'} onClick={() => void syncNow()}>Sync now</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => void signOut()}>Sign out</button>
          </div>
        </>
      )}
    </section>
  );
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PUSH_NOTE: Record<Exclude<PushState, 'on' | 'off'>, string> = {
  unsupported: "This browser can't show notifications. You'll still see nudges when you open the app.",
  'needs-install': 'On iPhone, add Becoming to your Home Screen (Share → Add to Home Screen), then turn notifications on from there.',
  'needs-setup': 'Phone notifications need Supabase and a VAPID key (see the README). Until then, nudges appear when you open the app.',
  'needs-signin': 'Sign in below to get notifications on this device.',
  denied: 'Notifications are blocked for this app. Allow them in your phone settings, then come back.',
};

function RemindersCard() {
  const prefs = usePrefs();
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const status = useSyncStatus();

  useEffect(() => {
    void pushState().then(setPush);
  }, [status.email]);

  const update = <K extends keyof ReminderPrefs>(k: K, p: Partial<ReminderPrefs[K]>) => setPrefs({ ...prefs, [k]: { ...prefs[k], ...p } });

  const toggle = async () => {
    setBusy(true);
    try {
      if (push === 'on') await disablePush();
      else await enablePush();
      toast(push === 'on' ? 'Notifications off' : 'Notifications on');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change notifications');
    } finally {
      setPush(await pushState());
      setBusy(false);
    }
  };

  // Called as a function (not <Row/>) so inputs aren't remounted on each change.
  const row = (label: string, k: 'morning' | 'evening') => (
    <div className="row" style={{ gap: 10 }}>
      <button className={`switch${prefs[k].on ? ' on' : ''}`} role="switch" aria-checked={prefs[k].on} aria-label={label} onClick={() => update(k, { on: !prefs[k].on })} />
      <span style={{ flex: 1 }}>{label}</span>
      <input className="input time" type="time" value={prefs[k].time} disabled={!prefs[k].on} onChange={(e) => update(k, { time: e.target.value })} aria-label={`${label} time`} />
    </div>
  );

  return (
    <section className="glass pad stack" style={{ gap: 14 }}>
      <h3>Reminders</h3>
      {row('Morning check-in', 'morning')}
      {row('Evening review', 'evening')}
      <div className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 10 }}>
          <button className={`switch${prefs.weekly.on ? ' on' : ''}`} role="switch" aria-checked={prefs.weekly.on} aria-label="Weekly review" onClick={() => update('weekly', { on: !prefs.weekly.on })} />
          <span style={{ flex: 1 }}>Weekly review</span>
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <select className="input time" value={prefs.weekly.day} disabled={!prefs.weekly.on} onChange={(e) => update('weekly', { day: Number(e.target.value) })} aria-label="Weekly review day">
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input className="input time" type="time" value={prefs.weekly.time} disabled={!prefs.weekly.on} onChange={(e) => update('weekly', { time: e.target.value })} aria-label="Weekly review time" />
        </div>
      </div>
      <p className="small faint">Reminders skip anything you've already done.</p>
      {push === 'on' || push === 'off' ? (
        <button className="btn block" disabled={busy} onClick={toggle}>
          {busy ? 'One moment…' : push === 'on' ? 'Turn off phone notifications' : 'Turn on phone notifications'}
        </button>
      ) : (
        push && <p className="small muted">{PUSH_NOTE[push]}</p>
      )}
    </section>
  );
}

function DataCard() {
  const file = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `becoming-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as Collections;
      if (!parsed.days || !parsed.commitments) throw new Error('Not a Becoming backup');
      replaceAll(parsed);
      toast('Backup restored');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read that file');
    }
  };
  return (
    <section className="glass pad stack" style={{ gap: 12 }}>
      <h3>Your data</h3>
      <p className="small muted">Download a backup file, or restore one. Restoring replaces what's on this device.</p>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn" style={{ flex: 1 }} onClick={exportData}>Export</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => file.current?.click()}>Import</button>
      </div>
      <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
    </section>
  );
}
