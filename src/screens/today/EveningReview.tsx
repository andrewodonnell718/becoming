import { useState } from 'react';
import { Chips, Suggest, VoiceField } from '../../components/Fields';
import { IconCheck, IconSpark } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { toast } from '../../components/Toast';
import { PATTERNS } from '../../lib/constants';
import { todayKey } from '../../lib/dates';
import { askCoach, eveningContext } from '../../lib/ai';
import { dueOn } from '../../lib/evidence';
import { getDay, getState, newId, updateDay, useStore } from '../../lib/store';
import type { Evening, PatternId } from '../../lib/types';

const STEPS = ['Before you close', 'What went well?', 'Where did I break my word?', 'Why?', 'What will I change tomorrow?'];

export function EveningReview({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const today = todayKey();
  const day = getDay(s, today);
  const due = dueOn(s, today);
  const [step, setStep] = useState(day.evening ? 5 : 0);
  const [e, setE] = useState<Evening>(day.evening ?? { wentWell: '', brokeWord: '', why: '', whyPatterns: [], change: '', at: 0 });
  const [coachBusy, setCoachBusy] = useState(false);
  const set = (p: Partial<Evening>) => setE((x) => ({ ...x, ...p }));
  const append = (field: 'wentWell' | 'brokeWord', v: string) => set({ [field]: e[field] ? `${e[field]}, ${v}` : v });

  const kept = due.filter((c) => day.kept[c.id]).map((c) => c.name);
  const missed = due.filter((c) => !day.kept[c.id]).map((c) => c.name);
  if (day.mit?.text) (day.mit.done ? kept : missed).unshift(day.mit.text);

  const save = () => {
    const at = Date.now();
    updateDay(today, (d) => ({
      ...d,
      evening: { ...e, at },
      // Replace this evening's pattern entries so re-saving doesn't double count.
      obstacles: [
        ...d.obstacles.filter((o) => o.source !== 'evening'),
        ...e.whyPatterns.map((pattern) => ({ id: newId(), pattern, note: e.why || undefined, at, source: 'evening' as const })),
      ],
    }));
    toast('Day closed. Evidence recorded.');
    setStep(5);
  };

  const askForReflection = async () => {
    setCoachBusy(true);
    try {
      const { text } = await askCoach('evening', eveningContext(getState(), today));
      set({ coach: text });
      updateDay(today, (d) => ({ ...d, evening: d.evening && { ...d.evening, coach: text } }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Coach unavailable');
    } finally {
      setCoachBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 20, minHeight: 420 }}>
        <div className="row between">
          <div className="dots">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
          <button className="small muted" onClick={onClose}>Close</button>
        </div>

        {step < 5 && <h2 style={{ fontSize: 24, fontWeight: 300 }}>{STEPS[step]}</h2>}

        {step === 0 && (
          <>
            <p className="small faint">Mark anything you did that isn't checked yet.</p>
            <div className="stack" style={{ gap: 4 }}>
              {due.map((c) => {
                const on = !!day.kept[c.id];
                return (
                  <button key={c.id} className={`commit-row${on ? ' kept' : ''}`} onClick={() => updateDay(today, (d) => ({ ...d, kept: { ...d.kept, [c.id]: !on } }))}>
                    <span className={`check-sm${on ? ' on' : ''}`}>{on && <IconCheck size={14} color="#0b0f1a" />}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
                  </button>
                );
              })}
              {due.length === 0 && <p className="small muted">No commitments were scheduled today.</p>}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <Suggest items={kept} onPick={(v) => append('wentWell', v)} />
            <VoiceField multiline value={e.wentWell} onChange={(v) => set({ wentWell: v })} placeholder="Evidence from today" autoFocus />
          </>
        )}
        {step === 2 && (
          <>
            <Suggest items={missed} onPick={(v) => append('brokeWord', v)} />
            <VoiceField multiline value={e.brokeWord} onChange={(v) => set({ brokeWord: v })} placeholder="Honestly, without judgment" />
            {missed.length === 0 && <p className="small faint">Nothing missed on your scorecard today.</p>}
          </>
        )}
        {step === 3 && (
          <>
            <p className="small faint">What got in the way? These are observed patterns, not labels.</p>
            <Chips
              multi
              options={PATTERNS}
              value={e.whyPatterns}
              onToggle={(id: PatternId) => set({ whyPatterns: e.whyPatterns.includes(id) ? e.whyPatterns.filter((x) => x !== id) : [...e.whyPatterns, id] })}
            />
            <VoiceField multiline value={e.why} onChange={(v) => set({ why: v })} placeholder="What happened, in your words (optional)" />
          </>
        )}
        {step === 4 && (
          <>
            <VoiceField multiline value={e.change} onChange={(v) => set({ change: v })} placeholder="One specific change" autoFocus />
            <p className="small faint">You'll see this tomorrow morning.</p>
          </>
        )}
        {step === 5 && (
          <div className="stack" style={{ gap: 16 }}>
            <h2 style={{ fontSize: 24, fontWeight: 300 }}>Today is recorded.</h2>
            {e.wentWell && <Summary label="Went well" text={e.wentWell} />}
            {e.brokeWord && <Summary label="Broke my word" text={e.brokeWord} />}
            {e.change && <Summary label="Tomorrow" text={e.change} />}
            {e.coach ? (
              <div className="glass pad coach">
                <p className="tiny faint row" style={{ gap: 6 }}><IconSpark size={14} /> Coach</p>
                <p className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{e.coach}</p>
              </div>
            ) : (
              <button className="btn block" disabled={coachBusy} onClick={askForReflection}>
                <IconSpark size={18} /> {coachBusy ? 'Reflecting…' : 'Reflect with the coach'}
              </button>
            )}
            <div className="row" style={{ gap: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setStep(1)}>Edit</button>
              <button className="btn primary" style={{ flex: 1 }} onClick={onClose}>Done</button>
            </div>
          </div>
        )}

        {step < 5 && (
          <div className="row" style={{ gap: 10, marginTop: 'auto' }}>
            {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
            <button className="btn primary" style={{ flex: 1 }} onClick={() => (step === 4 ? save() : setStep(step + 1))}>
              {step === 4 ? 'Close the day' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

const Summary = ({ label, text }: { label: string; text: string }) => (
  <div className="stack" style={{ gap: 2 }}>
    <span className="tiny faint">{label}</span>
    <span className="small">{text}</span>
  </div>
);
