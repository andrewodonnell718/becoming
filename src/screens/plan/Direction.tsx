import { useState } from 'react';
import { Collapse, useDebounced, VoiceField } from '../../components/Fields';
import { IconClose, IconPlus } from '../../components/Icons';
import { toast } from '../../components/Toast';
import { AREAS, MASTERIES, PILLARS, PURSUIT, type PrincipleDef } from '../../lib/constants';
import { todayKey } from '../../lib/dates';
import { getPhilosophy, getState, live, newId, put, updatePhilosophy, useStore } from '../../lib/store';

export function Direction() {
  const s = useStore();
  const p = getPhilosophy(s);
  const [vision, setVision] = useState(p.vision);
  const [constitution, setConstitution] = useState(p.constitution);
  useDebounced(vision, 700, (v) => updatePhilosophy((x) => ({ ...x, vision: v })));
  useDebounced(constitution, 700, (v) => updatePhilosophy((x) => ({ ...x, constitution: v })));

  const outcomes = live(s, 'outcomes').filter((o) => o.status === 'active');
  const commitments = live(s, 'commitments').filter((c) => !c.archived);
  const defined = (list: PrincipleDef[]) => list.filter((d) => p.principles[d.id]?.meaning).length;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="glass pad stack" style={{ gap: 10 }}>
        <p className="tiny faint">Vision</p>
        <VoiceField multiline value={vision} onChange={setVision} placeholder="Who are you becoming? Describe the life, in your words." />
      </section>

      <section className="glass pad stack" style={{ gap: 10 }}>
        <p className="tiny faint">Personal constitution</p>
        <VoiceField multiline value={constitution} onChange={setConstitution} placeholder="The rules you live by. What you do, and what you don't." />
      </section>

      <Collapse title="Seven pillars" meta={<span className="num">{defined(PILLARS)}/7</span>}>
        {PILLARS.map((d) => <Principle key={d.id} def={d} />)}
      </Collapse>
      <Collapse title="The pursuit" meta={<span className="num">{defined(PURSUIT)}/1</span>}>
        {PURSUIT.map((d) => <Principle key={d.id} def={d} />)}
      </Collapse>
      <Collapse title="Eight masteries" meta={<span className="num">{defined(MASTERIES)}/8</span>}>
        {MASTERIES.map((d) => <Principle key={d.id} def={d} />)}
      </Collapse>

      <Collapse title="Life areas" meta={<span className="num">7</span>}>
        <div className="stack" style={{ gap: 12 }}>
          {AREAS.map((a) => {
            const o = outcomes.filter((x) => x.area === a.id).length;
            const c = commitments.filter((x) => x.area === a.id).length;
            return (
              <div key={a.id} className="row between">
                <div className="stack" style={{ gap: 0 }}>
                  <span style={{ fontWeight: 600 }}>{a.name}</span>
                  <span className="small faint">{a.hint}</span>
                </div>
                <span className="small faint" style={{ textAlign: 'right' }}>
                  {o > 0 && <><span className="num">{o}</span> outcome{o > 1 ? 's' : ''}<br /></>}
                  <span className="num">{c}</span> commitment{c === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}

function Principle({ def }: { def: PrincipleDef }) {
  const s = useStore();
  const entry = getPhilosophy(s).principles[def.id] ?? { meaning: '', practices: [] };
  const [meaning, setMeaning] = useState(entry.meaning);
  const [open, setOpen] = useState(false);
  const [practice, setPractice] = useState('');
  useDebounced(meaning, 700, (v) =>
    updatePhilosophy((p) => ({ ...p, principles: { ...p.principles, [def.id]: { ...(p.principles[def.id] ?? { practices: [] }), meaning: v } } })),
  );
  const tracked = live(s, 'commitments').filter((c) => c.principleId === def.id && !c.archived);

  const setPractices = (practices: string[]) =>
    updatePhilosophy((p) => ({ ...p, principles: { ...p.principles, [def.id]: { meaning, practices } } }));

  const track = (name: string) => {
    const existing = live(getState(), 'commitments');
    put('commitments', {
      id: newId(), name, area: 'practice', principleId: def.id, days: [0, 1, 2, 3, 4, 5, 6], evidence: `days of ${name.toLowerCase()}`,
      order: existing.length, archived: false, startDate: todayKey(),
    });
    toast(`"${name}" is now on your daily scorecard`);
  };

  return (
    <div className="principle">
      <button className="row between" style={{ width: '100%', padding: '10px 0' }} onClick={() => setOpen((o) => !o)}>
        <span className="head" style={{ fontSize: 16 }}>{def.name}</span>
        <span className="small faint" style={{ maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.meaning || 'Define'}
        </span>
      </button>
      {open && (
        <div className="stack" style={{ gap: 10, paddingBottom: 14 }}>
          <VoiceField multiline value={meaning} onChange={setMeaning} placeholder={def.prompt} />
          <p className="tiny faint">Practices</p>
          {entry.practices.map((pr) => {
            const isTracked = tracked.some((c) => c.name === pr);
            return (
              <div key={pr} className="row" style={{ gap: 8 }}>
                <span className="small" style={{ flex: 1 }}>{pr}</span>
                {!isTracked && <button className="chip small" onClick={() => track(pr)}>Track daily</button>}
                {isTracked && <span className="tiny faint">Tracked</span>}
                <button className="faint" aria-label="Remove practice" onClick={() => setPractices(entry.practices.filter((x) => x !== pr))}><IconClose size={16} /></button>
              </div>
            );
          })}
          <div className="row" style={{ gap: 8 }}>
            <input className="input" value={practice} onChange={(e) => setPractice(e.target.value)} placeholder="Add a behavioral practice" />
            <button
              className="icon-btn"
              aria-label="Add practice"
              disabled={!practice.trim()}
              onClick={() => { setPractices([...entry.practices, practice.trim()]); setPractice(''); }}
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
