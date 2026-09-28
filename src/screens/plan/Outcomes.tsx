import { useState } from 'react';
import { Chips, VoiceField } from '../../components/Fields';
import { IconCheck, IconClose, IconMinus, IconPlus, IconSpark } from '../../components/Icons';
import { ProgressBar } from '../../components/Progress';
import { Sheet } from '../../components/Sheet';
import { toast } from '../../components/Toast';
import { askCoach, outcomeContext } from '../../lib/ai';
import { AREAS, areaName } from '../../lib/constants';
import { addDays, format, todayKey } from '../../lib/dates';
import { activeOutcomes, outcomeProgress } from '../../lib/evidence';
import { getState, live, newId, put, remove, useStore } from '../../lib/store';
import type { AreaId, Outcome } from '../../lib/types';

export const MAX_OUTCOMES = 3;

export function Outcomes() {
  const s = useStore();
  const today = todayKey();
  const active = activeOutcomes(s);
  const past = live(s, 'outcomes').filter((o) => o.status !== 'active');
  const [editing, setEditing] = useState<Outcome | 'new' | null>(null);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="small muted" style={{ padding: '0 4px' }}>
        Up to three outcomes for the next 90 days. Everything on Today connects back to these.
      </p>
      {active.map((o) => {
        const p = outcomeProgress(o, today);
        return (
          <button key={o.id} className="glass pad stack" style={{ gap: 10, textAlign: 'left' }} onClick={() => setEditing(o)}>
            <div className="row between">
              <span className="tiny faint">{areaName(o.area)}</span>
              <span className="small faint">Day <span className="num">{p.dayNumber}</span> of <span className="num">{p.totalDays}</span></span>
            </div>
            <h2>{o.name}</h2>
            {o.desired && <p className="small muted">{o.desired}</p>}
            <ProgressBar value={p.milestones} />
            <div className="row between small faint">
              <span><span className="num">{p.milestonesDone}</span>/<span className="num">{p.milestonesTotal}</span> milestones</span>
              <span>by {format(o.deadline, { month: 'short', day: 'numeric' })}</span>
            </div>
          </button>
        );
      })}
      {active.length < MAX_OUTCOMES ? (
        <button className="btn block" onClick={() => setEditing('new')}><IconPlus size={18} /> New 90-day outcome</button>
      ) : (
        <p className="small faint" style={{ textAlign: 'center' }}>Three is the limit. Focus is the point.</p>
      )}
      {past.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="tiny faint" style={{ padding: '6px 4px 0' }}>Past outcomes</p>
          {past.map((o) => (
            <button key={o.id} className="glass pad row between" style={{ padding: 14 }} onClick={() => setEditing(o)}>
              <span className="small">{o.name}</span>
              <span className="tiny faint">{o.status}</span>
            </button>
          ))}
        </div>
      )}
      {editing && <OutcomeEditor outcome={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

interface Suggestion { milestones: string[]; weeklyActions: { title: string; perWeek: number }[]; measures: { name: string; unit: string }[]; questions: string[] }

function OutcomeEditor({ outcome, onClose }: { outcome: Outcome | null; onClose: () => void }) {
  const today = todayKey();
  const s = useStore();
  const [o, setO] = useState<Outcome>(
    outcome ?? {
      id: newId(), updatedAt: 0, name: '', area: 'creation', why: '', current: '', desired: '', startDate: today, deadline: addDays(today, 90),
      milestones: [], weeklyActions: [], measures: [], status: 'active', order: live(s, 'outcomes').length,
    },
  );
  const [milestone, setMilestone] = useState('');
  const [action, setAction] = useState('');
  const [measure, setMeasure] = useState({ name: '', unit: '', baseline: '', target: '' });
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<Outcome>) => setO((x) => ({ ...x, ...p }));
  const commitments = live(s, 'commitments').filter((c) => !c.archived);

  const save = (extra: Partial<Outcome> = {}) => {
    if (!o.name.trim()) return;
    put('outcomes', { ...o, ...extra, name: o.name.trim() });
    toast(outcome ? 'Saved' : 'Outcome set. 90 days start now.');
    onClose();
  };

  const draftPlan = async () => {
    setBusy(true);
    try {
      setSuggestion(await askCoach<Suggestion>('plan_outcome', outcomeContext(getState(), o)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Coach unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="row between">
          <h2>{outcome ? 'Outcome' : 'New 90-day outcome'}</h2>
          <button className="small muted" onClick={onClose}>Cancel</button>
        </div>

        <label className="field"><span>Name</span>
          <VoiceField value={o.name} onChange={(v) => set({ name: v })} placeholder="e.g. Launch the podcast" autoFocus={!outcome} />
        </label>
        <div className="field"><span>Life area</span>
          <Chips options={AREAS} value={[o.area]} onToggle={(id: AreaId) => set({ area: id })} />
        </div>
        <label className="field"><span>Why it matters</span>
          <VoiceField multiline value={o.why} onChange={(v) => set({ why: v })} placeholder="The reason you'll return to on hard days" />
        </label>
        <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
          <label className="field" style={{ flex: 1 }}><span>Current state</span>
            <VoiceField multiline value={o.current} onChange={(v) => set({ current: v })} placeholder="Where it is now" />
          </label>
          <label className="field" style={{ flex: 1 }}><span>Desired state</span>
            <VoiceField multiline value={o.desired} onChange={(v) => set({ desired: v })} placeholder="What done looks like" />
          </label>
        </div>
        <label className="field"><span>Deadline</span>
          <input className="input" type="date" value={o.deadline} min={o.startDate} onChange={(e) => set({ deadline: e.target.value })} />
        </label>

        <button className="btn block" disabled={busy || !o.name.trim()} onClick={draftPlan}>
          <IconSpark size={18} /> {busy ? 'Drafting…' : 'Draft milestones and actions with the coach'}
        </button>
        {suggestion && (
          <div className="glass pad stack coach" style={{ gap: 12 }}>
            <p className="tiny faint">Coach suggestions · tap to add</p>
            {suggestion.questions.map((q) => <p key={q} className="small muted">{q}</p>)}
            <div className="chips">
              {suggestion.milestones.filter((m) => !o.milestones.some((x) => x.title === m)).map((m) => (
                <button key={m} className="chip suggest" onClick={() => set({ milestones: [...o.milestones, { id: newId(), title: m }] })}>+ {m}</button>
              ))}
              {suggestion.weeklyActions.filter((a) => !o.weeklyActions.some((x) => x.title === a.title)).map((a) => (
                <button key={a.title} className="chip suggest" onClick={() => set({ weeklyActions: [...o.weeklyActions, { id: newId(), title: a.title, perWeek: a.perWeek }] })}>
                  + {a.title} · {a.perWeek}×/wk
                </button>
              ))}
              {suggestion.measures.filter((m) => !o.measures.some((x) => x.name === m.name)).map((m) => (
                <button key={m.name} className="chip suggest" onClick={() => setMeasure({ ...measure, name: m.name, unit: m.unit })}>+ Measure: {m.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="field"><span>Milestones</span>
          {o.milestones.map((m, i) => (
            <div key={m.id} className="row" style={{ gap: 10 }}>
              <button
                className={`check-sm${m.doneOn ? ' on' : ''}`}
                aria-label={`Toggle ${m.title}`}
                onClick={() => set({ milestones: o.milestones.map((x) => (x.id === m.id ? { ...x, doneOn: x.doneOn ? undefined : today } : x)) })}
              >
                {m.doneOn && <IconCheck size={14} color="#0b0f1a" />}
              </button>
              <span className="small" style={{ flex: 1 }}><span className="num faint">{i + 1}.</span> {m.title}</span>
              <button className="faint" aria-label="Remove" onClick={() => set({ milestones: o.milestones.filter((x) => x.id !== m.id) })}><IconClose size={16} /></button>
            </div>
          ))}
          <AddRow value={milestone} onChange={setMilestone} placeholder="Add a milestone" onAdd={() => { set({ milestones: [...o.milestones, { id: newId(), title: milestone.trim() }] }); setMilestone(''); }} />
        </div>

        <div className="field"><span>Weekly actions</span>
          {o.weeklyActions.map((a) => (
            <div key={a.id} className="stack" style={{ gap: 6, paddingBottom: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="small" style={{ flex: 1 }}>{a.title}</span>
                <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Fewer" onClick={() => set({ weeklyActions: o.weeklyActions.map((x) => (x.id === a.id ? { ...x, perWeek: Math.max(1, x.perWeek - 1) } : x)) })}><IconMinus size={14} /></button>
                <span className="num small" style={{ minWidth: 34, textAlign: 'center' }}>{a.perWeek}×</span>
                <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="More" onClick={() => set({ weeklyActions: o.weeklyActions.map((x) => (x.id === a.id ? { ...x, perWeek: Math.min(7, x.perWeek + 1) } : x)) })}><IconPlus size={14} /></button>
                <button className="faint" aria-label="Remove" onClick={() => set({ weeklyActions: o.weeklyActions.filter((x) => x.id !== a.id) })}><IconClose size={16} /></button>
              </div>
              {commitments.length > 0 && (
                <select
                  className="input small"
                  style={{ height: 38 }}
                  value={a.commitmentId ?? ''}
                  onChange={(e) => set({ weeklyActions: o.weeklyActions.map((x) => (x.id === a.id ? { ...x, commitmentId: e.target.value || undefined } : x)) })}
                >
                  <option value="">Count manually or from tasks</option>
                  {commitments.map((c) => <option key={c.id} value={c.id}>Counts when I keep: {c.name}</option>)}
                </select>
              )}
            </div>
          ))}
          <AddRow value={action} onChange={setAction} placeholder="e.g. Record an episode" onAdd={() => { set({ weeklyActions: [...o.weeklyActions, { id: newId(), title: action.trim(), perWeek: 3 }] }); setAction(''); }} />
        </div>

        <div className="field"><span>Measurements</span>
          {o.measures.map((m) => (
            <div key={m.id} className="row small" style={{ gap: 8 }}>
              <span style={{ flex: 1 }}>{m.name}</span>
              <span className="num faint">{m.baseline} → {m.target} {m.unit}</span>
              <button className="faint" aria-label="Remove" onClick={() => set({ measures: o.measures.filter((x) => x.id !== m.id) })}><IconClose size={16} /></button>
            </div>
          ))}
          <div className="row" style={{ gap: 6 }}>
            <input className="input" style={{ flex: 2 }} placeholder="Name" value={measure.name} onChange={(e) => setMeasure({ ...measure, name: e.target.value })} />
            <input className="input" style={{ flex: 1 }} placeholder="Unit" value={measure.unit} onChange={(e) => setMeasure({ ...measure, unit: e.target.value })} />
          </div>
          <div className="row" style={{ gap: 6 }}>
            <input className="input num" inputMode="decimal" placeholder="Now" value={measure.baseline} onChange={(e) => setMeasure({ ...measure, baseline: e.target.value })} />
            <input className="input num" inputMode="decimal" placeholder="Target" value={measure.target} onChange={(e) => setMeasure({ ...measure, target: e.target.value })} />
            <button
              className="icon-btn"
              style={{ flex: 'none' }}
              aria-label="Add measurement"
              disabled={!measure.name.trim() || measure.baseline === '' || measure.target === '' || isNaN(+measure.baseline) || isNaN(+measure.target)}
              onClick={() => {
                set({ measures: [...o.measures, { id: newId(), name: measure.name.trim(), unit: measure.unit.trim(), baseline: +measure.baseline, target: +measure.target, entries: [] }] });
                setMeasure({ name: '', unit: '', baseline: '', target: '' });
              }}
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>

        <button className="btn primary block" disabled={!o.name.trim()} onClick={() => save()}>{outcome ? 'Save' : 'Commit to this outcome'}</button>
        {outcome && (
          <div className="row" style={{ gap: 10 }}>
            {o.status === 'active' ? (
              <>
                <button className="btn" style={{ flex: 1 }} onClick={() => save({ status: 'achieved' })}>Mark achieved</button>
                <button className="btn" style={{ flex: 1 }} onClick={() => save({ status: 'released' })}>Release</button>
              </>
            ) : (
              <button className="btn" style={{ flex: 1 }} onClick={() => save({ status: 'active' })}>Reactivate</button>
            )}
            <button className="btn danger" onClick={() => { if (!confirm) return setConfirm(true); remove('outcomes', o.id); onClose(); }}>
              {confirm ? 'Confirm' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function AddRow({ value, onChange, placeholder, onAdd }: { value: string; onChange: (v: string) => void; placeholder: string; onAdd: () => void }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && value.trim() && onAdd()} />
      <button className="icon-btn" style={{ flex: 'none' }} aria-label="Add" disabled={!value.trim()} onClick={onAdd}><IconPlus size={18} /></button>
    </div>
  );
}
