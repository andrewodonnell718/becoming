import { useState } from 'react';
import { Segmented, Suggest, useDebounced, VoiceField } from '../../components/Fields';
import { IconMinus, IconPlus } from '../../components/Icons';
import { ProgressBar } from '../../components/Progress';
import { addDays, format, startOfWeek, todayKey } from '../../lib/dates';
import { activeOutcomes, weeklyActionCount } from '../../lib/evidence';
import { getWeek, updateWeek, useStore } from '../../lib/store';

export function WeekPlan() {
  const s = useStore();
  const today = todayKey();
  const [which, setWhich] = useState<'this' | 'next'>('this');
  const weekStart = which === 'this' ? startOfWeek(today) : addDays(startOfWeek(today), 7);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Segmented options={[{ id: 'this', name: 'This week' }, { id: 'next', name: 'Next week' }]} value={which} onChange={setWhich} />
      <WeekEditor key={weekStart} weekStart={weekStart} previous={getWeek(s, addDays(weekStart, -7)).review?.oneChange} />
    </div>
  );
}

function WeekEditor({ weekStart, previous }: { weekStart: string; previous?: string }) {
  const s = useStore();
  const week = getWeek(s, weekStart);
  const outcomes = activeOutcomes(s);
  const [priority, setPriority] = useState(week.priority);
  useDebounced(priority, 700, (v) => updateWeek(weekStart, (w) => ({ ...w, priority: v })));
  const isFuture = weekStart > todayKey();

  const toggleFocus = (id: string) =>
    updateWeek(weekStart, (w) => ({ ...w, focusOutcomeIds: w.focusOutcomeIds.includes(id) ? w.focusOutcomeIds.filter((x) => x !== id) : [...w.focusOutcomeIds, id] }));

  return (
    <>
      <p className="small faint" style={{ padding: '0 4px' }}>
        {format(weekStart, { month: 'short', day: 'numeric' })} – {format(addDays(weekStart, 6), { month: 'short', day: 'numeric' })}
      </p>
      <section className="glass pad stack" style={{ gap: 10 }}>
        <p className="tiny faint">The one priority</p>
        <VoiceField multiline value={priority} onChange={setPriority} placeholder="If only one thing changes this week, it's…" />
        {!priority && previous && <Suggest items={[previous]} onPick={setPriority} />}
      </section>

      {outcomes.length > 0 && (
        <section className="glass pad stack" style={{ gap: 12 }}>
          <p className="tiny faint">Focus outcomes</p>
          <div className="chips">
            {outcomes.map((o) => (
              <button key={o.id} className={`chip${week.focusOutcomeIds.includes(o.id) ? ' on' : ''}`} onClick={() => toggleFocus(o.id)}>{o.name}</button>
            ))}
          </div>
        </section>
      )}

      {outcomes.filter((o) => o.weeklyActions.length).map((o) => (
        <section key={o.id} className="glass pad stack" style={{ gap: 14 }}>
          <div>
            <p className="tiny faint">Weekly actions</p>
            <h3 style={{ marginTop: 4 }}>{o.name}</h3>
          </div>
          {o.weeklyActions.map((a) => {
            const done = weeklyActionCount(s, a, weekStart);
            return (
              <div key={a.id} className="stack" style={{ gap: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="small" style={{ flex: 1 }}>{a.title}</span>
                  {!a.commitmentId && !isFuture && (
                    <>
                      <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Undo one" disabled={!week.actionCounts[a.id]}
                        onClick={() => updateWeek(weekStart, (w) => ({ ...w, actionCounts: { ...w.actionCounts, [a.id]: Math.max(0, (w.actionCounts[a.id] ?? 0) - 1) } }))}>
                        <IconMinus size={14} />
                      </button>
                      <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Log one"
                        onClick={() => updateWeek(weekStart, (w) => ({ ...w, actionCounts: { ...w.actionCounts, [a.id]: (w.actionCounts[a.id] ?? 0) + 1 } }))}>
                        <IconPlus size={14} />
                      </button>
                    </>
                  )}
                  <span className="num small" style={{ minWidth: 36, textAlign: 'right' }}>{done}/{a.perWeek}</span>
                </div>
                <ProgressBar value={done / a.perWeek} thin />
                {a.commitmentId && <span className="tiny faint" style={{ textTransform: 'none', letterSpacing: 0 }}>Counts automatically from your scorecard</span>}
              </div>
            );
          })}
        </section>
      ))}
      {outcomes.length === 0 && <p className="glass pad small muted">Set a 90-day outcome first. Weekly actions come from it.</p>}
    </>
  );
}
