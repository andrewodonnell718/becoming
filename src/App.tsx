import { useCallback, useEffect, useState } from 'react';
import { Background } from './components/Background';
import { IconSettings } from './components/Icons';
import { TabBar, type Tab } from './components/TabBar';
import { Toaster } from './components/Toast';
import { Grow } from './screens/grow/Grow';
import { Plan } from './screens/plan/Plan';
import { Reflect, type View as ReflectView } from './screens/reflect/Reflect';
import { Settings } from './screens/Settings';
import { Today, type TodaySheet } from './screens/today/Today';
import { Track } from './screens/track/Track';

/** Deep links from reminder notifications: /?open=morning|evening|weekly */
function parseOpen(url: string): { tab: Tab; sheet?: TodaySheet; reflect?: ReflectView } | null {
  const open = new URL(url, location.origin).searchParams.get('open');
  if (open === 'morning' || open === 'evening') return { tab: 'today', sheet: open };
  if (open === 'weekly') return { tab: 'reflect', reflect: 'week' };
  return null;
}

export function App() {
  const initial = parseOpen(location.href);
  const [tab, setTab] = useState<Tab>(initial?.tab ?? 'today');
  const [sheet, setSheet] = useState<TodaySheet>(initial?.sheet ?? null);
  const [reflectView, setReflectView] = useState<ReflectView | undefined>(initial?.reflect);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    if (initial) history.replaceState(null, '', import.meta.env.BASE_URL);
    // The service worker posts here when a notification is tapped while the app is open.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'open') return;
      const target = parseOpen(e.data.url);
      if (!target) return;
      setTab(target.tab);
      setSheet(target.sheet ?? null);
      setReflectView(target.reflect);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    setReflectView(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const clearSheet = useCallback(() => setSheet(null), []);

  return (
    <>
      <Background />
      <button className="icon-btn settings-btn" onClick={() => setSettings(true)} aria-label="Account, reminders and data">
        <IconSettings size={18} />
      </button>
      <main className="app">
        {tab === 'today' && (
          <Today
            open={sheet}
            onOpened={clearSheet}
            goTo={(t) => (t === 'reflect-week' ? (setReflectView('week'), setTab('reflect'), window.scrollTo({ top: 0 })) : go(t))}
          />
        )}
        {tab === 'plan' && <Plan />}
        {tab === 'track' && <Track />}
        {tab === 'reflect' && <Reflect key={reflectView ?? 'default'} initial={reflectView} />}
        {tab === 'grow' && <Grow />}
      </main>
      <TabBar tab={tab} onChange={go} />
      {settings && <Settings onClose={() => setSettings(false)} />}
      <Toaster />
    </>
  );
}
