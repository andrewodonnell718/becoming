import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDictation, voiceSupported } from '../lib/voice';
import { IconChevron, IconMic } from './Icons';

/** Text input or textarea with a dictation button. */
export function VoiceField({
  value, onChange, placeholder, multiline, autoFocus, label,
}: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; autoFocus?: boolean; label?: string }) {
  const latest = useRef(value);
  latest.current = value;
  const dict = useDictation((chunk) => {
    const cur = latest.current.trim();
    onChange(cur ? `${cur} ${chunk}` : chunk.charAt(0).toUpperCase() + chunk.slice(1));
  });
  const common = { value, placeholder, autoFocus, 'aria-label': label ?? placeholder };
  return (
    <div className={`voice-field${dict.listening ? ' listening' : ''}`}>
      {multiline ? (
        <textarea className="input area" rows={3} {...common} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      {voiceSupported && (
        <button type="button" className="mic" onClick={dict.toggle} aria-label={dict.listening ? 'Stop dictation' : 'Dictate'} aria-pressed={dict.listening}>
          <IconMic size={18} />
        </button>
      )}
    </div>
  );
}

export function Chips<T extends string>({
  options, value, onToggle, multi,
}: { options: { id: T; name: string }[]; value: T[]; onToggle: (id: T) => void; multi?: boolean }) {
  return (
    <div className="chips" role={multi ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`chip${value.includes(o.id) ? ' on' : ''}`} aria-pressed={value.includes(o.id)} onClick={() => onToggle(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

/** Chips that append their text to a field. */
export function Suggest({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="chips">
      {items.map((s) => (
        <button key={s} type="button" className="chip suggest" onClick={() => onPick(s)}>{s}</button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; name: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.name}</button>
      ))}
    </div>
  );
}

/** Progressive disclosure: a titled section that expands. */
export function Collapse({ title, meta, children, defaultOpen = false }: { title: ReactNode; meta?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass collapse">
      <button className="collapse-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="head" style={{ fontSize: 17 }}>{title}</span>
        <span className="row small faint" style={{ gap: 8 }}>{meta}<IconChevron dir={open ? 'up' : 'down'} /></span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  );
}

/** Saves after the user pauses typing. */
export function useDebounced<T>(value: T, ms: number, fn: (v: T) => void) {
  const first = useRef(true);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => cb.current(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
}
