import { useCallback, useEffect, useState } from 'react';
import { Suggest, VoiceField } from '../../components/Fields';
import { IconClose } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { Timer } from '../../components/Timer';
import { toast } from '../../components/Toast';
import { todayKey } from '../../lib/dates';
import { getDay, newId, updateDay, useStore } from '../../lib/store';
import type { PatternId } from '../../lib/types';

type Step =
  | { kind: 'text'; field: 'task' | 'action' | 'note'; q: string; hint?: string; suggest?: string[] }
  | { kind: 'list'; q: string }
  | { kind: 'pick'; q: string }
  | { kind: 'breathe' }
  | { kind: 'return'; q: string };

interface Flow { pattern: PatternId; label: string; sub: string; minutes: number; steps: Step[] }

const SMALLEST = ['Open it', 'Write one sentence', 'List the first 3 steps', 'Send one message', 'Set up the space'];

const FLOWS: Flow[] = [
  { pattern: 'avoidance', label: "I'm avoiding something", sub: 'Smallest action, 10 minutes', minutes: 10, steps: [
    { kind: 'text', field: 'task', q: 'What are you avoiding?' },
    { kind: 'text', field: 'action', q: 'What is the smallest action you could take right now?', hint: 'Small enough that it feels almost too easy.', suggest: SMALLEST },
  ] },
  { pattern: 'overwhelm', label: 'Too much at once', sub: 'List it, pick one', minutes: 25, steps: [
    { kind: 'list', q: 'What is competing for your attention?' },
    { kind: 'pick', q: 'Choose one. Everything else can wait.' },
  ] },
  { pattern: 'perfectionism', label: 'It has to be perfect', sub: 'Define done, then start', minutes: 25, steps: [
    { kind: 'text', field: 'task', q: 'What are you working on?' },
    { kind: 'text', field: 'action', q: 'What is the minimum version that counts as done?', hint: 'Good enough to ship, share or move on.' },
  ] },
  { pattern: 'distraction', label: 'I keep getting pulled away', sub: 'Name it, return', minutes: 10, steps: [
    { kind: 'text', field: 'note', q: 'What were you avoiding just before the distraction?' },
    { kind: 'return', q: 'Return to your commitment.' },
  ] },
  { pattern: 'fear', label: "I'm afraid of it", sub: 'One brave step, 5 minutes', minutes: 5, steps: [
    { kind: 'text', field: 'note', q: 'What are you afraid will happen?' },
    { kind: 'text', field: 'action', q: 'What is one small, brave step?', suggest: SMALLEST },
  ] },
  { pattern: 'emotional', label: "I'm reacting emotionally", sub: 'Breathe, then act', minutes: 10, steps: [
    { kind: 'breathe' },
    { kind: 'text', field: 'action', q: 'What is the next right action?' },
  ] },
  { pattern: 'reward', label: 'I want something easier', sub: 'Earn it first', minutes: 25, steps: [
    { kind: 'text', field: 'note', q: 'What are you reaching for instead?' },
    { kind: 'text', field: 'action', q: 'What will you do first to earn it?' },
  ] },
];

export function Stuck({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const today = todayKey();
  const day = getDay(s, today);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [i, setI] = useState(0);
  const [v, setV] = useState({ task: '', action: '', note: '' });
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [obstacleId, setObstacleId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const current = [day.mit && !day.mit.done ? day.mit.text : '', ...day.tasks.filter((t) => !t.done).map((t) => t.text)].filter(Boolean);

  const startTimer = () => {
    const id = newId();
    const action = v.action || v.task;
    updateDay(today, (d) => ({
      ...d,
      obstacles: [...d.obstacles, { id, pattern: flow!.pattern, note: [v.task, v.note].filter(Boolean).join(' · ') || undefined, action, minutes: flow!.minutes, at: Date.now(), source: 'stuck', completed: false }],
    }));
    setObstacleId(id);
  };

  const onTimerDone = useCallback(() => {
    setFinished(true);
    if (obstacleId)
      updateDay(today, (d) => ({ ...d, obstacles: d.obstacles.map((o) => (o.id === obstacleId ? { ...o, completed: true } : o)) }));
  }, [obstacleId, today]);

  if (!flow)
    return (
      <Sheet onClose={onClose}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="row between">
            <h2 style={{ fontSize: 24, fontWeight: 300 }}>What's happening?</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {FLOWS.map((f) => (
              <button key={f.pattern} className="option" onClick={() => setFlow(f)}>
                <span>{f.label}</span>
                <span className="small faint">{f.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    );

  const step = flow.steps[i];
  const onLast = i === flow.steps.length - 1;
  const canNext =
    !step ? false :
    step.kind === 'text' ? !!v[step.field].trim() || step.field === 'note' :
    step.kind === 'list' ? items.length > 0 :
    step.kind === 'pick' ? !!v.action :
    step.kind === 'return' ? !!v.action :
    true;

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 18, minHeight: 380 }}>
        <div className="row between">
          <span className="tiny faint">{flow.label}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>

        {obstacleId ? (
          finished ? (
            <div className="stack" style={{ gap: 14, alignItems: 'center', textAlign: 'center', paddingTop: 20 }}>
              <h2 style={{ fontSize: 26, fontWeight: 300 }}>You moved.</h2>
              <p className="muted">That was the hard part. Keep going, or take the win.</p>
              <button className="btn primary block" onClick={() => { toast('Recorded. Stuck, then moving.'); onClose(); }}>Done</button>
            </div>
          ) : (
            <>
              <p className="head" style={{ fontSize: 20, textAlign: 'center' }}>{v.action || v.task}</p>
              <Timer minutes={flow.minutes} onDone={onTimerDone} />
              <button className="small muted" onClick={onTimerDone}>I'm in motion, stop the timer</button>
            </>
          )
        ) : (
          <>
            {step.kind === 'text' && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 300 }}>{step.q}</h2>
                {step.hint && <p className="small faint">{step.hint}</p>}
                {step.field === 'task' && <Suggest items={current.slice(0, 3)} onPick={(x) => setV({ ...v, task: x })} />}
                <VoiceField value={v[step.field]} onChange={(x) => setV({ ...v, [step.field]: x })} autoFocus placeholder="Type or speak" />
                {step.suggest && <Suggest items={step.suggest} onPick={(x) => setV({ ...v, [step.field]: x })} />}
              </>
            )}
            {step.kind === 'list' && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 300 }}>{step.q}</h2>
                <Suggest items={current.filter((c) => !items.includes(c)).slice(0, 4)} onPick={(x) => setItems([...items, x])} />
                <div className="row" style={{ gap: 8 }}>
                  <div style={{ flex: 1 }}><VoiceField value={draft} onChange={setDraft} placeholder="Add one" /></div>
                  <button className="btn" disabled={!draft.trim()} onClick={() => { setItems([...items, draft.trim()]); setDraft(''); }}>Add</button>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {items.map((x) => <p key={x} className="small">· {x}</p>)}
                </div>
              </>
            )}
            {step.kind === 'pick' && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 300 }}>{step.q}</h2>
                <div className="stack" style={{ gap: 8 }}>
                  {items.map((x) => (
                    <button key={x} className={`option${v.action === x ? ' on' : ''}`} onClick={() => setV({ ...v, action: x })}>{x}</button>
                  ))}
                </div>
              </>
            )}
            {step.kind === 'return' && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 300 }}>{step.q}</h2>
                <div className="stack" style={{ gap: 8 }}>
                  {current.map((x) => (
                    <button key={x} className={`option${v.action === x ? ' on' : ''}`} onClick={() => setV({ ...v, action: x })}>{x}</button>
                  ))}
                </div>
                {current.length === 0 && <VoiceField value={v.action} onChange={(x) => setV({ ...v, action: x })} placeholder="What were you meant to be doing?" />}
              </>
            )}
            {step.kind === 'breathe' && <Breathe onDone={() => setI(i + 1)} />}

            {step.kind !== 'breathe' && (
              <div className="row" style={{ gap: 10, marginTop: 'auto' }}>
                <button className="btn" onClick={() => (i === 0 ? setFlow(null) : setI(i - 1))}>Back</button>
                <button className="btn primary" style={{ flex: 1 }} disabled={!canNext} onClick={() => (onLast ? startTimer() : setI(i + 1))}>
                  {onLast ? `Start ${flow.minutes}-minute timer` : 'Next'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Breathe({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= 3) return;
    const t = setTimeout(() => setN(n + 1), 8000);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 22, paddingTop: 10 }}>
      <h2 style={{ fontSize: 22, fontWeight: 300 }}>Three slow breaths.</h2>
      <div className="breathe" aria-hidden />
      <p className="small faint">In for four, out for four. <span className="num">{Math.min(n + 1, 3)}</span> of <span className="num">3</span></p>
      <button className="btn primary block" onClick={onDone}>{n >= 3 ? 'Continue' : 'Skip'}</button>
    </div>
  );
}
