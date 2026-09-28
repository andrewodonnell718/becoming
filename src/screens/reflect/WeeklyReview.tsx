import { useState } from 'react';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { Segmented, Suggest, VoiceField } from '../../components/Fields';
import { IconSpark } from '../../components/Icons';
import { ProgressBar } from '../../components/Progress';
import { toast } from '../../components/Toast';
import { askCoach, weeklyContext } from '../../lib/ai';
import { patternName } from '../../lib/constants';
import { addDays, format, startOfWeek, todayKey } from '../../lib/dates';
import { weekSummary } from '../../lib/evidence';
import { getState, getWeek, updateWeek, useStore } from '../../lib/store';

interface CoachWeek { summary: string; observations: string[]; questions: string[]; changeIdeas: string[] }

export function WeeklyReview() {
  const today = todayKey();
  // Early in the week, the week worth reviewing is usually the one that just ended.
  const [which, setWhich] = useState<'this' | 'last'>(() => (new Date().getDay() === 1 ? 'last' : 'this'));
  const weekStart = which === 'this' ? startOfWeek(today) : addDays(startOfWeek(today), -7);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <Segmented options={[{ id: 'last', name: 'Last week' }, { id: 'this', name: 'This week' }]} value={which} onChange={setWhich} />
      <Review key={weekStart} weekStart={weekStart} />
    </div>
  );
}

function Review({ weekStart }: { weekStart: string }) {
  const s = useStore();
  const today = todayKey();
  const w = weekSummary(s, weekStart, today);
  const week = getWeek(s, weekStart);
  const nextStart = addDays(weekStart, 7);
  const [oneChange, setOneChange] = useState(week.review?.oneChange ?? '');
  const [coach, setCoach] = useState<CoachWeek | null>(null);
  const [busy, setBusy] = useState(false);
  const rate = w.commitments.rate ?? 0;

  const ask = async () => {
    setBusy(true);
    try {
      setCoach(await askCoach<CoachWeek>('weekly', weeklyContext(getState(), weekStart, today)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Coach unavailable');
    } finally {
      setBusy(false);
    }
  };

  const commit = () => {
    const change = oneChange.trim();
    if (!change) return;
    updateWeek(weekStart, (x) => ({ ...x, review: { oneChange: change, notes: '', coach: coach?.summary, at: Date.now() } }));
    updateWeek(nextStart, (x) => ({ ...x, priority: change }));
    toast("Set as next week's priority");
  };

  return (
    <>
      <p className="small faint" style={{ padding: '0 4px' }}>
        {format(weekStart, { month: 'short', day: 'numeric' })} – {format(w.end, { month: 'short', day: 'numeric' })}
        {week.priority && <> · Priority: <span style={{ color: 'var(--text)' }}>{week.priority}</span></>}
      </p>

      <section className="glass pad stack" style={{ gap: 12 }}>
        <p className="tiny faint">Commitments kept</p>
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <AnimatedNumber value={w.commitments.kept} className="num hero-num" />
          <span className="num faint" style={{ fontSize: 22 }}>/ {w.commitments.due}</span>
          <span className="small faint" style={{ marginLeft: 'auto' }}><AnimatedNumber value={rate * 100} className="num" suffix="%" /></span>
        </div>
        <ProgressBar value={rate} />
        <div className="stack" style={{ gap: 8, marginTop: 4 }}>
          {w.commitments.list.filter((c) => c.due > 0).map((c) => (
            <div key={c.commitment.id} className="stack" style={{ gap: 4 }}>
              <div className="row between small"><span>{c.commitment.name}</span><span className="num faint">{c.kept}/{c.due}</span></div>
              <ProgressBar value={c.due ? c.kept / c.due : 0} thin />
            </div>
          ))}
        </div>
        <p className="small faint">
          Planned <span className="num">{w.daysPlanned}</span> mornings · reviewed <span className="num">{w.daysReviewed}</span> evenings · <span className="num">{w.tasksDone}</span> scheduled items done
        </p>
      </section>

      <List title="Accomplishments" items={w.accomplishments} empty="Nothing marked yet. Milestones and completed most-important tasks appear here." />

      {w.missed.length > 0 && (
        <List title="Missed commitments" items={w.missed.map((m) => `${m.commitment.name} · missed ${m.missed}×`)} />
      )}

      {w.patterns.total > 0 && (
        <List title="Common obstacles" items={w.patterns.sorted.slice(0, 3).map(([p, n]) => `${patternName(p)} · ${n}×`)} />
      )}

      {w.outcomes.length > 0 && (
        <section className="glass pad stack" style={{ gap: 14 }}>
          <h3>90-day outcomes</h3>
          {w.outcomes.map((o) => (
            <div key={o.outcome.id} className="stack" style={{ gap: 6 }}>
              <div className="row between small"><span style={{ fontWeight: 600 }}>{o.outcome.name}</span><span className="faint">Day <span className="num">{o.progress.dayNumber}</span></span></div>
              <ProgressBar value={o.progress.milestones} thin />
              <span className="small faint">
                <span className="num">{o.progress.milestonesDone}</span>/<span className="num">{o.progress.milestonesTotal}</span> milestones
                {o.actions.length > 0 && <> · actions {o.actions.map((a) => `${a.action.title} ${Math.min(a.done, a.action.perWeek)}/${a.action.perWeek}`).join(', ')}</>}
              </span>
            </div>
          ))}
        </section>
      )}

      {w.reflections.some((r) => r.wentWell) && (
        <List title="In your words" items={w.reflections.filter((r) => r.wentWell).map((r) => `${format(r.date, { weekday: 'short' })}: ${r.wentWell}`)} />
      )}

      {coach ? (
        <section className="glass pad stack coach" style={{ gap: 10 }}>
          <p className="tiny faint row" style={{ gap: 6 }}><IconSpark size={14} /> Coach summary</p>
          <p className="small">{coach.summary}</p>
          {coach.observations.map((o) => <p key={o} className="small muted">· {o}</p>)}
          {coach.questions.length > 0 && <p className="tiny faint" style={{ marginTop: 6 }}>Questions to sit with</p>}
          {coach.questions.map((q) => <p key={q} className="small">{q}</p>)}
        </section>
      ) : (
        <button className="btn block" disabled={busy} onClick={ask}><IconSpark size={18} /> {busy ? 'Summarizing…' : 'Summarize my week with the coach'}</button>
      )}

      <section className="glass pad stack" style={{ gap: 12 }}>
        <h2 style={{ fontWeight: 300 }}>What is the ONE change that would make next week better?</h2>
        <VoiceField multiline value={oneChange} onChange={setOneChange} placeholder="One specific behavior" />
        {coach && <Suggest items={coach.changeIdeas} onPick={setOneChange} />}
        <button className="btn primary block" disabled={!oneChange.trim()} onClick={commit}>
          {week.review ? "Update next week's priority" : "Make it next week's priority"}
        </button>
      </section>
    </>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section className="glass pad stack" style={{ gap: 8 }}>
      <h3>{title}</h3>
      {items.length ? items.map((x, i) => <p key={i} className="small">· {x}</p>) : <p className="small faint">{empty}</p>}
    </section>
  );
}
