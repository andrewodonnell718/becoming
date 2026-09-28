import { useEffect, useState } from 'react';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { VoiceField } from '../../components/Fields';
import { IconBuoy, IconCheck, IconChevron, IconClose, IconMoon, IconPlus, IconSun } from '../../components/Icons';
import { ProgressBar } from '../../components/Progress';
import { toast } from '../../components/Toast';
import { areaName, patternName, PHILOSOPHY_LINE } from '../../lib/constants';
import { addDays, format, startOfWeek, todayKey } from '../../lib/dates';
import { activeOutcomes, dayProgress, dueOn, outcomeProgress, suggestOutcome, weeklyActionCount } from '../../lib/evidence';
import { getDay, getWeek, newId, put, updateDay, useStore } from '../../lib/store';
import type { Commitment, Outcome } from '../../lib/types';
import { isPast, usePrefs, weeklyDue } from '../../lib/reminders';
import { EveningReview } from './EveningReview';
import { MorningCheckin } from './MorningCheckin';
import { Stuck } from './Stuck';

export type TodaySheet = 'morning' | 'evening' | 'stuck' | null;

export function Today({ goTo, open, onOpened }: { goTo: (tab: 'plan' | 'track' | 'reflect-week') => void; open?: TodaySheet; onOpened?: () => void }) {
  const s = useStore();
  const today = todayKey();
  const day = getDay(s, today);
  const yesterday = getDay(s, addDays(today, -1));
  const outcomes = activeOutcomes(s);
  const week = getWeek(s, today);
  const [sheet, setSheet] = useState<TodaySheet>(null);
  const prefs = usePrefs();
  const evening = isPast(prefs.evening.time);
  const reviewDue = weeklyDue() && !week.review;

  // A notification tap (or deep link) asks for a specific sheet.
  useEffect(() => {
    if (!open) return;
    setSheet(open);
    onOpened?.();
  }, [open, onOpened]);

  const primary =
    outcomes.find((o) => o.id === day.primaryOutcomeId) ??
    outcomes.find((o) => week.focusOutcomeIds.includes(o.id)) ??
    outcomes[0];

  const due = dueOn(s, today);
  const progress = dayProgress(s, today);
  const commitments = due.filter((c) => !c.principleId);
  const practices = due.filter((c) => c.principleId);

  return (
    <div className="screen">
      <header className="stack" style={{ gap: 6 }}>
        <p className="tiny faint">{format(today, { weekday: 'long' })}</p>
        <h1>{format(today, { month: 'long', day: 'numeric' })}</h1>
        {primary && (
          <p className="small muted">
            Day <span className="num">{outcomeProgress(primary, today).dayNumber}</span> of{' '}
            <span className="num">{outcomeProgress(primary, today).totalDays}</span>
          </p>
        )}
      </header>

      {!day.morning && !evening && (
        <button className="glass pad cta" onClick={() => setSheet('morning')}>
          <IconSun />
          <div className="stack" style={{ gap: 2, flex: 1, textAlign: 'left' }}>
            <span className="head" style={{ fontSize: 18 }}>Morning check-in</span>
            <span className="small faint">Five questions · about 90 seconds</span>
          </div>
          <IconChevron />
        </button>
      )}

      {reviewDue && (
        <button className="glass pad cta emphasis" onClick={() => goTo('reflect-week')}>
          <div className="stack" style={{ gap: 2, flex: 1, textAlign: 'left' }}>
            <span className="head" style={{ fontSize: 18 }}>Weekly review</span>
            <span className="small faint">Look back, choose one change · 15–30 minutes</span>
          </div>
          <IconChevron />
        </button>
      )}

      {yesterday.evening?.change && !day.morning && (
        <p className="glass pad small muted quote">
          Yesterday you decided: <span style={{ color: 'var(--text)' }}>{yesterday.evening.change}</span>
        </p>
      )}

      {day.morning?.ifThen && (
        <div className="glass pad stack" style={{ gap: 6 }}>
          <p className="tiny faint">Today's if-then plan</p>
          <p className="small">{day.morning.ifThen}</p>
        </div>
      )}

      {primary ? (
        <PrimaryOutcome outcome={primary} outcomes={outcomes} />
      ) : (
        <button className="glass pad cta" onClick={() => goTo('plan')}>
          <div className="stack" style={{ gap: 2, flex: 1, textAlign: 'left' }}>
            <span className="head" style={{ fontSize: 18 }}>Set your 90-day direction</span>
            <span className="small faint">Up to three outcomes that everything else serves.</span>
          </div>
          <IconChevron />
        </button>
      )}

      <MostImportant outcomes={outcomes} fallbackOutcome={primary} />

      <Scheduled outcomes={outcomes} />

      <section className="glass pad stack" style={{ gap: 14 }}>
        <div className="row between">
          <h2>Commitments</h2>
          <span className="small muted">
            <AnimatedNumber value={progress.kept} className="num" /> of <span className="num">{progress.due}</span> kept
          </span>
        </div>
        <ProgressBar value={progress.rate ?? 0} />
        {due.length === 0 ? (
          <button className="small muted" style={{ textAlign: 'left' }} onClick={() => goTo('track')}>
            No commitments set for today. Set up your daily scorecard →
          </button>
        ) : (
          <>
            <CommitmentChecks list={commitments} />
            {practices.length > 0 && (
              <>
                <p className="tiny faint" style={{ marginTop: 6 }}>Practices</p>
                <CommitmentChecks list={practices} />
              </>
            )}
          </>
        )}
      </section>

      <button className={`glass pad cta${evening && !day.evening ? ' emphasis' : ''}`} onClick={() => setSheet('evening')}>
        <IconMoon />
        <div className="stack" style={{ gap: 2, flex: 1, textAlign: 'left' }}>
          <span className="head" style={{ fontSize: 18 }}>{day.evening ? 'Evening review done' : 'Close the day'}</span>
          <span className="small faint">
            {day.evening ? 'Tap to revisit' : 'What went well, where you broke your word, what changes'}
          </span>
        </div>
        {day.evening ? <IconCheck /> : <IconChevron />}
      </button>

      {day.obstacles.length > 0 && (
        <p className="small faint" style={{ textAlign: 'center' }}>
          Noticed today: {day.obstacles.map((o) => patternName(o.pattern)).join(', ')}
        </p>
      )}

      <p className="small faint philosophy">{PHILOSOPHY_LINE}</p>

      <button className="stuck-fab" onClick={() => setSheet('stuck')}>
        <IconBuoy size={20} /> I'm stuck
      </button>

      {sheet === 'morning' && <MorningCheckin onClose={() => setSheet(null)} />}
      {sheet === 'evening' && <EveningReview onClose={() => setSheet(null)} />}
      {sheet === 'stuck' && <Stuck onClose={() => setSheet(null)} />}
    </div>
  );
}

function PrimaryOutcome({ outcome, outcomes }: { outcome: Outcome; outcomes: Outcome[] }) {
  const today = todayKey();
  const p = outcomeProgress(outcome, today);
  const [choosing, setChoosing] = useState(false);
  const s = useStore();
  const weekStart = startOfWeek(today);

  const completeNext = () => {
    if (!p.next) return;
    put('outcomes', { ...outcome, milestones: outcome.milestones.map((m) => (m.id === p.next!.id ? { ...m, doneOn: today } : m)) });
    toast('Milestone reached. That is evidence.');
    navigator.vibrate?.([10, 40, 20]);
  };

  return (
    <section className="glass pad stack" style={{ gap: 12 }}>
      <div className="row between">
        <p className="tiny faint">Primary outcome · {areaName(outcome.area)}</p>
        {outcomes.length > 1 && (
          <button className="small muted" onClick={() => setChoosing((c) => !c)}>{choosing ? 'Done' : 'Change'}</button>
        )}
      </div>
      {choosing ? (
        <div className="stack" style={{ gap: 8 }}>
          {outcomes.map((o) => (
            <button
              key={o.id}
              className={`chip block${o.id === outcome.id ? ' on' : ''}`}
              onClick={() => { updateDay(today, (d) => ({ ...d, primaryOutcomeId: o.id })); setChoosing(false); }}
            >
              {o.name}
            </button>
          ))}
        </div>
      ) : (
        <h2 style={{ fontSize: 22 }}>{outcome.name}</h2>
      )}
      <div className="stack" style={{ gap: 6 }}>
        <div className="row between small faint">
          <span>
            <span className="num" style={{ color: 'var(--text)' }}>{p.milestonesDone}</span> of <span className="num">{p.milestonesTotal}</span> milestones
          </span>
          <span><span className="num">{p.daysLeft}</span> days left</span>
        </div>
        <ProgressBar value={p.milestones} />
      </div>
      {p.next && (
        <div className="row" style={{ gap: 12 }}>
          <button className="check-sm" onClick={completeNext} aria-label={`Complete milestone ${p.next.title}`} />
          <div className="stack" style={{ gap: 0 }}>
            <span className="tiny faint">Next milestone</span>
            <span className="small">{p.next.title}</span>
          </div>
        </div>
      )}
      {outcome.weeklyActions.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="tiny faint">This week</span>
          {outcome.weeklyActions.map((a) => {
            const done = weeklyActionCount(s, a, weekStart);
            return (
              <div key={a.id} className="row between small">
                <span className="muted">{a.title}</span>
                <span className="num">{Math.min(done, a.perWeek)}/{a.perWeek}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MostImportant({ outcomes, fallbackOutcome }: { outcomes: Outcome[]; fallbackOutcome?: Outcome }) {
  const s = useStore();
  const today = todayKey();
  const mit = getDay(s, today).mit;
  const [editing, setEditing] = useState(!mit?.text);
  const [text, setText] = useState(mit?.text ?? '');
  const linked = outcomes.find((o) => o.id === mit?.outcomeId);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    const outcomeId = (suggestOutcome(t, outcomes) ?? fallbackOutcome)?.id;
    updateDay(today, (d) => ({ ...d, mit: { text: t, done: d.mit?.done ?? false, outcomeId } }));
    setEditing(false);
  };

  return (
    <section className="glass pad stack" style={{ gap: 10 }}>
      <p className="tiny faint">Most important task</p>
      {editing ? (
        <div className="stack" style={{ gap: 10 }}>
          <VoiceField value={text} onChange={setText} placeholder="What must happen today?" />
          <button className="btn primary block" disabled={!text.trim()} onClick={save}>Set</button>
        </div>
      ) : (
        <div className="row" style={{ gap: 14 }}>
          <button
            className={`check${mit?.done ? ' on' : ''}`}
            aria-pressed={!!mit?.done}
            aria-label="Mark most important task done"
            onClick={() => {
              updateDay(today, (d) => ({ ...d, mit: { ...d.mit!, done: !d.mit!.done } }));
              if (!mit?.done) { toast('Done. The day already counts.'); navigator.vibrate?.(12); }
            }}
          >
            <IconCheck color="#0b0f1a" />
          </button>
          <button className="stack" style={{ gap: 2, flex: 1, textAlign: 'left' }} onClick={() => { setText(mit?.text ?? ''); setEditing(true); }}>
            <span className="head" style={{ fontSize: 18, textDecoration: mit?.done ? 'line-through' : 'none', opacity: mit?.done ? 0.6 : 1 }}>
              {mit?.text}
            </span>
            {linked && <span className="small faint">→ {linked.name}</span>}
          </button>
        </div>
      )}
    </section>
  );
}

function Scheduled({ outcomes }: { outcomes: Outcome[] }) {
  const s = useStore();
  const today = todayKey();
  const day = getDay(s, today);
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [adding, setAdding] = useState(false);
  const tasks = [...day.tasks].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const weekStart = startOfWeek(today);
  const weekActions = outcomes.flatMap((o) =>
    o.weeklyActions
      .filter((a) => !a.commitmentId && weeklyActionCount(s, a, weekStart) < a.perWeek && !day.tasks.some((t) => t.weeklyActionId === a.id))
      .map((a) => ({ action: a, outcome: o })),
  );

  const add = (t: string, extra: { outcomeId?: string; weeklyActionId?: string } = {}) => {
    if (!t.trim()) return;
    const outcomeId = extra.outcomeId ?? suggestOutcome(t, outcomes)?.id;
    updateDay(today, (d) => ({ ...d, tasks: [...d.tasks, { id: newId(), text: t.trim(), time: time || undefined, done: false, outcomeId, ...extra }] }));
    setText('');
    setTime('');
  };

  return (
    <section className="glass pad stack" style={{ gap: 12 }}>
      <div className="row between">
        <h2>Scheduled</h2>
        <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setAdding((a) => !a)} aria-label="Add">
          {adding ? <IconClose size={18} /> : <IconPlus size={18} />}
        </button>
      </div>
      {tasks.length === 0 && !adding && <p className="small faint">Nothing scheduled. Add a commitment or a block of time.</p>}
      {tasks.map((t) => {
        const o = outcomes.find((x) => x.id === t.outcomeId);
        return (
          <div key={t.id} className="task-row">
            <button
              className={`check-sm${t.done ? ' on' : ''}`}
              aria-pressed={t.done}
              aria-label={`Done: ${t.text}`}
              onClick={() => updateDay(today, (d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }))}
            >
              {t.done && <IconCheck size={14} color="#0b0f1a" />}
            </button>
            <div className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
              <span className="small" style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.55 : 1 }}>{t.text}</span>
              {o && <span className="tiny faint" style={{ textTransform: 'none', letterSpacing: 0 }}>→ {o.name}</span>}
            </div>
            {t.time && <span className="num small faint">{t.time}</span>}
            <button className="faint" aria-label="Remove" onClick={() => updateDay(today, (d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))}>
              <IconClose size={16} />
            </button>
          </div>
        );
      })}
      {adding && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><VoiceField value={text} onChange={setText} placeholder="Add a commitment" autoFocus /></div>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 108 }} aria-label="Time" />
          </div>
          <button className="btn primary block" disabled={!text.trim()} onClick={() => add(text)}>Add</button>
        </div>
      )}
      {weekActions.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="tiny faint">From this week's plan</span>
          <div className="chips">
            {weekActions.map(({ action, outcome }) => (
              <button key={action.id} className="chip suggest" onClick={() => add(action.title, { outcomeId: outcome.id, weeklyActionId: action.id })}>
                + {action.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CommitmentChecks({ list }: { list: Commitment[] }) {
  const s = useStore();
  const today = todayKey();
  const day = getDay(s, today);
  return (
    <div className="stack" style={{ gap: 4 }}>
      {list.map((c) => {
        const kept = !!day.kept[c.id];
        return (
          <button
            key={c.id}
            className={`commit-row${kept ? ' kept' : ''}`}
            aria-pressed={kept}
            onClick={() => {
              updateDay(today, (d) => ({ ...d, kept: { ...d.kept, [c.id]: !kept } }));
              navigator.vibrate?.(kept ? 6 : 10);
            }}
          >
            <span className={`check-sm${kept ? ' on' : ''}`}>{kept && <IconCheck size={14} color="#0b0f1a" />}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
            <span className="tiny faint">{areaName(c.area)}</span>
          </button>
        );
      })}
    </div>
  );
}
