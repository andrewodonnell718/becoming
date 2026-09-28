import { useState } from 'react';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { Chips, Segmented, VoiceField } from '../../components/Fields';
import { IconPlus } from '../../components/Icons';
import { ProgressBar } from '../../components/Progress';
import { Sheet } from '../../components/Sheet';
import { toast } from '../../components/Toast';
import { AREAS, areaName, DEFAULT_COMMITMENTS, patternName, PATTERNS } from '../../lib/constants';
import { addDays, format, range, todayKey } from '../../lib/dates';
import { activeCommitments, activeOutcomes, commitmentStats, isDue, outcomeProgress, patternCounts } from '../../lib/evidence';
import { getDay, getState, live, newId, put, remove, updateDay, useStore } from '../../lib/store';
import type { AreaId, Commitment, Outcome, PatternId } from '../../lib/types';

type View = 'scorecard' | 'measures' | 'patterns';

export function Track() {
  const [view, setView] = useState<View>('scorecard');
  return (
    <div className="screen">
      <h1>Track</h1>
      <Segmented options={[{ id: 'scorecard', name: 'Scorecard' }, { id: 'measures', name: 'Measures' }, { id: 'patterns', name: 'Patterns' }]} value={view} onChange={setView} />
      {view === 'scorecard' && <Scorecard />}
      {view === 'measures' && <Measures />}
      {view === 'patterns' && <Patterns />}
    </div>
  );
}

function Scorecard() {
  const s = useStore();
  const today = todayKey();
  const list = activeCommitments(s);
  const [editing, setEditing] = useState<Commitment | 'new' | null>(null);
  const days = range(addDays(today, -27), today);
  const stats = commitmentStats(s, days[0], today, today);

  const addDefaults = () => {
    DEFAULT_COMMITMENTS.forEach((d, i) =>
      put('commitments', { id: newId(), name: d.name, area: d.area, evidence: d.evidence, days: d.days ?? [0, 1, 2, 3, 4, 5, 6], order: i, archived: false, startDate: today }),
    );
    toast('Scorecard ready. Edit anything to make it yours.');
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {list.length === 0 ? (
        <div className="glass pad stack" style={{ gap: 12 }}>
          <h2>Your daily scorecard</h2>
          <p className="small muted">A short list of commitments you intend to keep every day. This is behavioral evidence, not a game.</p>
          <button className="btn primary block" onClick={addDefaults}>Start with the suggested seven</button>
          <button className="btn block" onClick={() => setEditing('new')}>Build my own</button>
        </div>
      ) : (
        <>
          <p className="small muted" style={{ padding: '0 4px' }}>
            Last 4 weeks: <AnimatedNumber value={stats.kept} className="num" /> kept of <span className="num">{stats.due}</span> due.
          </p>
          {list.map((c) => {
            const st = stats.list.find((x) => x.commitment.id === c.id);
            return (
              <button key={c.id} className="glass pad stack" style={{ gap: 10, padding: 16, textAlign: 'left' }} onClick={() => setEditing(c)}>
                <div className="row between">
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span className="small faint"><span className="num">{st?.kept ?? 0}</span>/<span className="num">{st?.due ?? 0}</span></span>
                </div>
                <div className="dotrow" aria-label={`${c.name}: last 28 days`}>
                  {days.map((d) => {
                    const due = isDue(c, d);
                    const kept = !!getDay(s, d).kept[c.id];
                    return <i key={d} className={!due ? 'off' : kept ? 'kept' : d === today ? 'today' : ''} title={`${format(d, { month: 'short', day: 'numeric' })}: ${!due ? 'rest' : kept ? 'kept' : d === today ? 'open' : 'missed'}`} />;
                  })}
                </div>
                <span className="tiny faint">{areaName(c.area)}{c.principleId ? ' · practice' : ''}</span>
              </button>
            );
          })}
          <button className="btn block" onClick={() => setEditing('new')}><IconPlus size={18} /> Add commitment</button>
        </>
      )}
      {editing && <CommitmentEditor commitment={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CommitmentEditor({ commitment, onClose }: { commitment: Commitment | null; onClose: () => void }) {
  const s = useStore();
  const outcomes = activeOutcomes(s);
  const [c, setC] = useState<Commitment>(
    commitment ?? { id: newId(), updatedAt: 0, name: '', area: 'health', days: [0, 1, 2, 3, 4, 5, 6], evidence: '', order: live(s, 'commitments').length, archived: false, startDate: todayKey() },
  );
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<Commitment>) => setC((x) => ({ ...x, ...p }));
  const valid = c.name.trim() && c.days.length;

  const save = () => {
    if (!valid) return;
    put('commitments', { ...c, name: c.name.trim(), evidence: c.evidence.trim() || `days of ${c.name.trim().toLowerCase()}` });
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="row between">
          <h2>{commitment ? 'Commitment' : 'New commitment'}</h2>
          <button className="small muted" onClick={onClose}>Cancel</button>
        </div>
        <label className="field"><span>Commitment</span>
          <VoiceField value={c.name} onChange={(v) => set({ name: v })} placeholder="e.g. Physical training" autoFocus={!commitment} />
        </label>
        <div className="field"><span>Life area</span>
          <Chips options={AREAS} value={[c.area]} onToggle={(id: AreaId) => set({ area: id })} />
        </div>
        <div className="field"><span>Days</span>
          <div className="row" style={{ gap: 6 }}>
            {WEEK.map((d) => (
              <button key={d} className={`chip${c.days.includes(d) ? ' on' : ''}`} style={{ flex: 1, padding: 0 }}
                onClick={() => set({ days: c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort() })}>
                {LETTERS[d]}
              </button>
            ))}
          </div>
        </div>
        <label className="field"><span>Counts on Grow as</span>
          <input className="input" value={c.evidence} onChange={(e) => set({ evidence: e.target.value })} placeholder="e.g. training sessions" />
        </label>
        {outcomes.length > 0 && (
          <label className="field"><span>Serves outcome</span>
            <select className="input" value={c.outcomeId ?? ''} onChange={(e) => set({ outcomeId: e.target.value || undefined })}>
              <option value="">None</option>
              {outcomes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        <button className="btn primary block" disabled={!valid} onClick={save}>Save</button>
        {commitment && (
          <div className="row" style={{ gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => { put('commitments', { ...c, archived: true }); onClose(); }}>Archive</button>
            <button className="btn danger" style={{ flex: 1 }} onClick={() => { if (!confirm) return setConfirm(true); remove('commitments', c.id); onClose(); }}>
              {confirm ? 'Delete, including history' : 'Delete'}
            </button>
          </div>
        )}
        {commitment && <p className="small faint" style={{ textAlign: 'center' }}>Archiving keeps its evidence on Grow.</p>}
      </div>
    </Sheet>
  );
}

function Measures() {
  const s = useStore();
  const today = todayKey();
  const outcomes = activeOutcomes(s).filter((o) => o.measures.length);
  if (!outcomes.length)
    return <p className="glass pad small muted">Measurements belong to your 90-day outcomes. Add them in Plan → 90 days.</p>;
  return (
    <div className="stack" style={{ gap: 12 }}>
      {outcomes.map((o) => outcomeProgress(o, today).measures.map((m) => <MeasureCard key={m.measure.id} outcome={o} m={m} />))}
    </div>
  );
}

function MeasureCard({ outcome, m }: { outcome: Outcome; m: ReturnType<typeof outcomeProgress>['measures'][number] }) {
  const [value, setValue] = useState('');
  const today = todayKey();
  const entries = [...m.measure.entries].sort((a, b) => a.date.localeCompare(b.date));
  const log = () => {
    const v = parseFloat(value);
    if (isNaN(v)) return;
    const measures = outcome.measures.map((x) =>
      x.id === m.measure.id ? { ...x, entries: [...x.entries.filter((e) => e.date !== today), { date: today, value: v }] } : x,
    );
    put('outcomes', { ...outcome, measures });
    setValue('');
    toast('Logged');
  };
  return (
    <section className="glass pad stack" style={{ gap: 12 }}>
      <div className="row between">
        <div>
          <p className="tiny faint">{outcome.name}</p>
          <h3 style={{ marginTop: 4 }}>{m.measure.name}</h3>
        </div>
        <span className="num" style={{ fontSize: 26 }}>
          <AnimatedNumber value={m.latest} decimals={Number.isInteger(m.latest) ? 0 : 1} />
          <span className="small faint"> {m.measure.unit}</span>
        </span>
      </div>
      <ProgressBar value={m.progress} />
      <div className="row between small faint">
        <span>Start <span className="num">{m.measure.baseline}</span></span>
        <span>Target <span className="num">{m.measure.target}</span></span>
      </div>
      {entries.length > 1 && <Sparkline values={entries.map((e) => e.value)} />}
      <div className="row" style={{ gap: 8 }}>
        <input className="input num" inputMode="decimal" placeholder={`Today's ${m.measure.name.toLowerCase()}`} value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn" disabled={isNaN(parseFloat(value))} onClick={log}>Log</button>
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 300, h = 44;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / (max - min || 1)) * (h - 8)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Patterns() {
  const s = useStore();
  const today = todayKey();
  const [pattern, setPattern] = useState<PatternId | null>(null);
  const [note, setNote] = useState('');
  const p = patternCounts(s, addDays(today, -29), today);
  const max = Math.max(1, ...p.sorted.map(([, n]) => n));
  const recent = range(addDays(today, -13), today).reverse().flatMap((d) => getDay(getState(), d).obstacles.map((o) => ({ ...o, date: d }))).slice(0, 12);

  const log = () => {
    if (!pattern) return;
    updateDay(today, (d) => ({ ...d, obstacles: [...d.obstacles, { id: newId(), pattern, note: note.trim() || undefined, at: Date.now(), source: 'log' }] }));
    toast('Noted. Observing is the first step.');
    setPattern(null);
    setNote('');
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="glass pad stack" style={{ gap: 12 }}>
        <h2>What got in the way?</h2>
        <p className="small faint">Record it without diagnosing it. These are observed patterns, not labels.</p>
        <Chips options={PATTERNS} value={pattern ? [pattern] : []} onToggle={(id: PatternId) => setPattern(pattern === id ? null : id)} />
        {pattern && (
          <>
            <VoiceField value={note} onChange={setNote} placeholder="Context (optional): where, when, what happened" />
            <button className="btn primary block" onClick={log}>Record</button>
          </>
        )}
      </section>

      <section className="glass pad stack" style={{ gap: 12 }}>
        <div className="row between">
          <h2>Last 30 days</h2>
          <span className="small faint"><span className="num">{p.total}</span> noted</span>
        </div>
        {p.sorted.length === 0 && <p className="small muted">Nothing recorded yet.</p>}
        {p.sorted.map(([id, n]) => (
          <div key={id} className="stack" style={{ gap: 4 }}>
            <div className="row between small"><span>{patternName(id)}</span><span className="num faint">{n}</span></div>
            <ProgressBar value={n / max} thin />
          </div>
        ))}
        {p.total > 0 && (
          <p className="small faint">
            Most often in the {Object.entries(p.byPart).sort((a, b) => b[1] - a[1])[0][0]}
            {' · '}busiest day: {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.byWeekday.indexOf(Math.max(...p.byWeekday))]}
          </p>
        )}
      </section>

      {recent.length > 0 && (
        <section className="glass pad stack" style={{ gap: 10 }}>
          <h3>Recent</h3>
          {recent.map((o) => (
            <div key={o.id} className="row between small" style={{ gap: 10 }}>
              <span style={{ flex: 1 }}>
                {patternName(o.pattern)}
                {o.note && <span className="faint"> · {o.note}</span>}
              </span>
              <span className="faint">{format(o.date, { weekday: 'short' })}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
