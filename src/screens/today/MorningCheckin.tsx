import { useState } from 'react';
import { Chips, Suggest, VoiceField } from '../../components/Fields';
import { Sheet } from '../../components/Sheet';
import { toast } from '../../components/Toast';
import { BODY_CHIPS, IF_THEN, PATTERNS } from '../../lib/constants';
import { addDays, todayKey } from '../../lib/dates';
import { activeOutcomes, outcomeProgress, suggestOutcome } from '../../lib/evidence';
import { getDay, newId, updateDay, useStore } from '../../lib/store';
import type { Morning, PatternId } from '../../lib/types';

const STEPS = [
  { key: 'success', q: 'What would make today successful?' },
  { key: 'mustHappen', q: 'What must happen today?' },
  { key: 'body', q: 'What will I do for my body?' },
  { key: 'connect', q: 'Who will I connect with?' },
  { key: 'derail', q: 'What could derail me?' },
  { key: 'ifThen', q: 'My if-then plan' },
] as const;

export function MorningCheckin({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const today = todayKey();
  const existing = getDay(s, today).morning;
  const yesterday = getDay(s, addDays(today, -1));
  const outcomes = activeOutcomes(s);
  const [step, setStep] = useState(0);
  const [m, setM] = useState<Morning>(
    existing ?? {
      success: '', mustHappen: '', body: '', connect: '', derail: [], derailNote: '', ifThen: '', at: 0,
    },
  );
  const set = (p: Partial<Morning>) => setM((x) => ({ ...x, ...p }));
  const append = (field: 'success' | 'mustHappen' | 'body' | 'connect', v: string) =>
    set({ [field]: m[field] ? `${m[field]}, ${v}` : v });

  // Names from recent mornings, so connecting takes one tap.
  const recentPeople = [
    ...new Set(
      Array.from({ length: 21 }, (_, i) => getDay(s, addDays(today, -i - 1)).morning?.connect ?? '')
        .flatMap((c) => c.split(/,| and /).map((x) => x.trim()))
        .filter((x) => x && x.length < 30),
    ),
  ].slice(0, 6);

  const successIdeas = [
    ...outcomes.map((o) => outcomeProgress(o, today).next?.title).filter(Boolean) as string[],
    ...(yesterday.evening?.change ? [yesterday.evening.change] : []),
  ].slice(0, 3);

  const toggleDerail = (id: PatternId) => {
    const derail = m.derail.includes(id) ? m.derail.filter((x) => x !== id) : [...m.derail, id];
    // Pre-fill the if-then from the first selected pattern unless the user has written their own.
    const auto = Object.values(IF_THEN).includes(m.ifThen) || !m.ifThen;
    set({ derail, ifThen: auto ? (derail[0] ? IF_THEN[derail[0]] : '') : m.ifThen });
  };

  const finish = () => {
    const at = Date.now();
    updateDay(today, (d) => {
      const mustHappen = m.mustHappen.trim();
      const mit = mustHappen && !d.mit?.text
        ? { text: mustHappen, done: false, outcomeId: (suggestOutcome(mustHappen, outcomes) ?? outcomes[0])?.id }
        : d.mit;
      // Anticipated obstacles are logged too, so patterns include what you saw coming.
      const anticipated = existing ? [] : m.derail.map((pattern) => ({ id: newId(), pattern, note: m.derailNote || undefined, at, source: 'morning' as const }));
      return { ...d, morning: { ...m, at }, mit, obstacles: [...d.obstacles, ...anticipated] };
    });
    toast('Checked in. Go build the evidence.');
    onClose();
  };

  const cur = STEPS[step];
  const last = step === STEPS.length - 1;
  const filled = cur.key === 'derail' ? m.derail.length > 0 || !!m.derailNote : !!m[cur.key].trim();

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 20, minHeight: 420 }}>
        <div className="row between">
          <div className="dots">
            {STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
          </div>
          <button className="small muted" onClick={onClose}>Close</button>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 300 }}>{cur.q}</h2>

        {cur.key === 'success' && (
          <>
            <VoiceField multiline value={m.success} onChange={(v) => set({ success: v })} placeholder="Today is a success if…" autoFocus />
            <Suggest items={successIdeas} onPick={(v) => append('success', v)} />
          </>
        )}
        {cur.key === 'mustHappen' && (
          <>
            <VoiceField value={m.mustHappen} onChange={(v) => set({ mustHappen: v })} placeholder="The one thing" autoFocus />
            <p className="small faint">This becomes today's most important task.</p>
          </>
        )}
        {cur.key === 'body' && (
          <>
            <Suggest items={BODY_CHIPS} onPick={(v) => append('body', v)} />
            <VoiceField value={m.body} onChange={(v) => set({ body: v })} placeholder="Training, food, sleep…" />
          </>
        )}
        {cur.key === 'connect' && (
          <>
            <Suggest items={recentPeople} onPick={(v) => append('connect', v)} />
            <VoiceField value={m.connect} onChange={(v) => set({ connect: v })} placeholder="A name, and how" />
          </>
        )}
        {cur.key === 'derail' && (
          <>
            <Chips multi options={PATTERNS} value={m.derail} onToggle={toggleDerail} />
            <VoiceField value={m.derailNote} onChange={(v) => set({ derailNote: v })} placeholder="Anything specific? (optional)" />
          </>
        )}
        {cur.key === 'ifThen' && (
          <>
            <p className="small faint">Decide now, so you don't have to decide later.</p>
            <VoiceField multiline value={m.ifThen} onChange={(v) => set({ ifThen: v })} placeholder="If … then I will …" />
          </>
        )}

        <div className="row" style={{ gap: 10, marginTop: 'auto' }}>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn primary" style={{ flex: 1 }} onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Begin the day' : filled ? 'Next' : 'Skip'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
