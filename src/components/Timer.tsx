import { useEffect, useState } from 'react';
import { ProgressRing } from './Progress';

/** Countdown based on an end timestamp, so it stays correct if the phone sleeps. */
export function Timer({ minutes, onDone }: { minutes: number; onDone: () => void }) {
  const [total, setTotal] = useState(minutes * 60_000);
  const [end, setEnd] = useState(() => Date.now() + minutes * 60_000);
  const [now, setNow] = useState(Date.now());
  /** Remaining ms while paused, else null. */
  const [paused, setPaused] = useState<number | null>(null);
  const remaining = paused ?? Math.max(0, end - now);

  useEffect(() => {
    if (paused !== null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    if (paused === null && remaining === 0) {
      navigator.vibrate?.([30, 60, 30]);
      onDone();
    }
  }, [remaining, paused, onDone]);

  const togglePause = () => {
    if (paused === null) return setPaused(remaining);
    setEnd(Date.now() + paused);
    setNow(Date.now());
    setPaused(null);
  };
  const addFive = () => {
    setTotal((t) => t + 5 * 60_000);
    if (paused !== null) setPaused(paused + 5 * 60_000);
    else setEnd((e) => e + 5 * 60_000);
  };

  const s = Math.ceil(remaining / 1000);
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 18 }}>
      <ProgressRing value={1 - remaining / total} size={190} stroke={10}>
        <span className="num" style={{ fontSize: 44, fontWeight: 300 }}>
          {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
        </span>
      </ProgressRing>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn" onClick={togglePause}>{paused === null ? 'Pause' : 'Resume'}</button>
        <button className="btn" onClick={addFive}>+5 min</button>
      </div>
    </div>
  );
}
