import { useState } from 'react';
import { Segmented } from '../../components/Fields';
import { IconSpark } from '../../components/Icons';
import { ProgressBar } from '../../components/Progress';
import { toast } from '../../components/Toast';
import { askCoach, patternsContext } from '../../lib/ai';
import { patternName } from '../../lib/constants';
import { addDays, format, todayKey } from '../../lib/dates';
import { patternCounts } from '../../lib/evidence';
import { getState, live, useStore } from '../../lib/store';
import { weeklyDue } from '../../lib/reminders';
import { WeeklyReview } from './WeeklyReview';

export type View = 'journal' | 'week' | 'patterns';

export function Reflect({ initial }: { initial?: View }) {
  const [view, setView] = useState<View>(initial ?? (weeklyDue() ? 'week' : 'journal'));
  return (
    <div className="screen">
      <h1>Reflect</h1>
      <Segmented options={[{ id: 'journal', name: 'Journal' }, { id: 'week', name: 'Weekly review' }, { id: 'patterns', name: 'Patterns' }]} value={view} onChange={setView} />
      {view === 'journal' && <Journal />}
      {view === 'week' && <WeeklyReview />}
      {view === 'patterns' && <PatternInsights />}
    </div>
  );
}

function Journal() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(14);
  const days = live(s, 'days')
    .filter((d) => d.morning || d.evening)
    .sort((a, b) => b.id.localeCompare(a.id))
    .filter((d) => !q || JSON.stringify([d.morning, d.evening, d.mit]).toLowerCase().includes(q.toLowerCase()));

  if (!days.length && !q)
    return <p className="glass pad small muted">Your morning check-ins and evening reviews collect here, day by day.</p>;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <input className="input" placeholder="Search your reflections" value={q} onChange={(e) => setQ(e.target.value)} />
      {days.slice(0, limit).map((d) => (
        <article key={d.id} className="glass pad stack" style={{ gap: 10 }}>
          <p className="tiny faint">{format(d.id, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          {d.mit?.text && <p className="head" style={{ fontSize: 17 }}>{d.mit.done ? '✓ ' : ''}{d.mit.text}</p>}
          {d.morning?.success && <Line label="Success looked like" text={d.morning.success} />}
          {d.evening?.wentWell && <Line label="Went well" text={d.evening.wentWell} />}
          {d.evening?.brokeWord && <Line label="Broke my word" text={d.evening.brokeWord} />}
          {d.evening?.why && <Line label="Why" text={d.evening.why} />}
          {d.evening?.change && <Line label="Change" text={d.evening.change} />}
          {d.evening?.coach && <Line label="Coach" text={d.evening.coach} />}
        </article>
      ))}
      {days.length > limit && <button className="btn block" onClick={() => setLimit(limit + 14)}>Show more</button>}
    </div>
  );
}

const Line = ({ label, text }: { label: string; text: string }) => (
  <div className="stack" style={{ gap: 2 }}>
    <span className="tiny faint">{label}</span>
    <span className="small" style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
  </div>
);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PatternInsights() {
  const s = useStore();
  const today = todayKey();
  const p = patternCounts(s, addDays(today, -41), today);
  const [coach, setCoach] = useState('');
  const [busy, setBusy] = useState(false);
  const maxDay = Math.max(1, ...p.byWeekday);
  const partTotal = p.byPart.morning + p.byPart.afternoon + p.byPart.evening;

  const ask = async () => {
    setBusy(true);
    try {
      setCoach((await askCoach('patterns', patternsContext(getState(), today))).text);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Coach unavailable');
    } finally {
      setBusy(false);
    }
  };

  if (p.total === 0)
    return <p className="glass pad small muted">When you note obstacles (in the evening review, the "I'm stuck" tool, or Track → Patterns), what they have in common shows up here.</p>;

  const top = p.sorted[0];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="glass pad stack" style={{ gap: 8 }}>
        <p className="tiny faint">Last six weeks</p>
        <p>
          <b>{patternName(top[0])}</b> is the pattern you've noted most (<span className="num">{top[1]}</span> of <span className="num">{p.total}</span>).
          {p.missedOnPatternDays[0] && <> On days with obstacles, the commitment most often missed was <b>{p.missedOnPatternDays[0][0]}</b>.</>}
        </p>
        <p className="small faint">These are observations of behavior, not diagnoses.</p>
      </section>

      <section className="glass pad stack" style={{ gap: 12 }}>
        <h3>By day of week</h3>
        <div className="weekbars" role="img" aria-label="Obstacles by day of week">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="stack" style={{ alignItems: 'center', gap: 6 }} title={`${DAYS[d]}: ${p.byWeekday[d]}`}>
              <div className="vbar"><i style={{ height: `${(p.byWeekday[d] / maxDay) * 100}%` }} /></div>
              <span className="tiny faint">{DAYS[d][0]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass pad stack" style={{ gap: 10 }}>
        <h3>By time of day</h3>
        {(['morning', 'afternoon', 'evening'] as const).map((k) => (
          <div key={k} className="stack" style={{ gap: 4 }}>
            <div className="row between small"><span style={{ textTransform: 'capitalize' }}>{k}</span><span className="num faint">{p.byPart[k]}</span></div>
            <ProgressBar value={partTotal ? p.byPart[k] / partTotal : 0} thin />
          </div>
        ))}
      </section>

      {coach ? (
        <div className="glass pad coach">
          <p className="tiny faint row" style={{ gap: 6 }}><IconSpark size={14} /> Coach</p>
          <p className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{coach}</p>
        </div>
      ) : (
        <button className="btn block" disabled={busy} onClick={ask}><IconSpark size={18} /> {busy ? 'Looking…' : 'What does the coach notice?'}</button>
      )}
    </div>
  );
}
