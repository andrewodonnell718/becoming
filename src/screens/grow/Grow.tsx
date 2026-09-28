import { useState } from 'react';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { IconSpark } from '../../components/Icons';
import { toast } from '../../components/Toast';
import { askCoach, progressContext } from '../../lib/ai';
import { patternName, PHILOSOPHY_LINE } from '../../lib/constants';
import { format, todayKey } from '../../lib/dates';
import { evidenceTotals, patternTrend, weeklyTrend } from '../../lib/evidence';
import { getState, live, useStore } from '../../lib/store';

export function Grow() {
  const s = useStore();
  const today = todayKey();
  const e = evidenceTotals(s, today);
  const trend = weeklyTrend(s, today, 12);
  const patterns = patternTrend(s, today, 28).slice(0, 5);
  const achieved = live(s, 'outcomes').filter((o) => o.status === 'achieved');
  const [coach, setCoach] = useState('');
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<number | null>(null);

  // "Then vs now": first four weeks with data vs the last four.
  const withData = trend.filter((w) => w.due > 0);
  const avg = (xs: typeof trend) => {
    const due = xs.reduce((n, w) => n + w.due, 0);
    return due ? xs.reduce((n, w) => n + w.kept, 0) / due : null;
  };
  const then = withData.length >= 6 ? avg(withData.slice(0, 4)) : null;
  const now = withData.length >= 6 ? avg(withData.slice(-4)) : null;

  const ask = async () => {
    setBusy(true);
    try {
      setCoach((await askCoach('progress', progressContext(getState(), today))).text);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Coach unavailable');
    } finally {
      setBusy(false);
    }
  };

  if (e.kept === 0 && e.milestones === 0)
    return (
      <div className="screen">
        <h1>Grow</h1>
        <p className="glass pad muted">Evidence builds here as you keep commitments, reach milestones and close each day. Come back in a week.</p>
        <p className="small faint philosophy">{PHILOSOPHY_LINE}</p>
      </div>
    );

  return (
    <div className="screen">
      <h1>Grow</h1>

      <section className="glass pad stack" style={{ gap: 6 }}>
        <p className="tiny faint">Since {format(e.since, { month: 'long', day: 'numeric' })}</p>
        <p className="head" style={{ fontSize: 22, fontWeight: 300, lineHeight: 1.35 }}>
          You have kept <AnimatedNumber value={e.kept} className="num" style={{ fontWeight: 600 }} /> commitments
          {e.wordKeptDays > 0 && <> and kept your whole word on <AnimatedNumber value={e.wordKeptDays} className="num" style={{ fontWeight: 600 }} /> days</>}.
        </p>
      </section>

      <div className="tiles">
        <Tile label="Milestones reached" value={e.milestones} />
        <Tile label="Most important tasks done" value={e.mits} />
        <Tile label="Stuck, then moving" value={e.stuckWorked} />
        <Tile label="Days reviewed" value={e.reviews} />
        {e.experiences > 0 && <Tile label="Experiences completed" value={e.experiences} />}
        {e.outcomesAchieved > 0 && <Tile label="Outcomes achieved" value={e.outcomesAchieved} />}
      </div>

      <section className="glass pad stack" style={{ gap: 12 }}>
        <h2>Evidence</h2>
        {e.perCommitment.map(({ commitment, count }) => (
          <div key={commitment.id} className="row between">
            <span className="small muted">{commitment.evidence}</span>
            <AnimatedNumber value={count} className="num" />
          </div>
        ))}
      </section>

      <section className="glass pad stack" style={{ gap: 14 }}>
        <div className="row between">
          <h2>Commitments kept, by week</h2>
        </div>
        {then != null && now != null && (
          <p className="small muted">
            First four weeks: <span className="num">{Math.round(then * 100)}%</span> · last four: <span className="num" style={{ color: 'var(--text)' }}>{Math.round(now * 100)}%</span>
          </p>
        )}
        <div className="trend" role="img" aria-label="Share of commitments kept each week, last 12 weeks" onPointerLeave={() => setTip(null)}>
          {trend.map((w, i) => (
            <button
              key={w.weekStart}
              className="trend-col"
              onPointerEnter={() => setTip(i)}
              onClick={() => setTip(i)}
              aria-label={`Week of ${format(w.weekStart, { month: 'short', day: 'numeric' })}: ${w.kept} of ${w.due} kept`}
            >
              <i style={{ height: `${w.rate == null ? 0 : Math.max(3, w.rate * 100)}%`, opacity: tip == null || tip === i ? 1 : 0.45 }} />
            </button>
          ))}
        </div>
        <div className="row between tiny faint">
          <span>{format(trend[0].weekStart, { month: 'short', day: 'numeric' })}</span>
          <span>
            {tip != null
              ? <>Week of {format(trend[tip].weekStart, { month: 'short', day: 'numeric' })}: <span className="num">{trend[tip].kept}/{trend[tip].due}</span></>
              : 'This week'}
          </span>
        </div>
      </section>

      {patterns.length > 0 && (
        <section className="glass pad stack" style={{ gap: 10 }}>
          <h2>Recurring patterns</h2>
          <p className="small faint">Last 4 weeks compared with the 4 before.</p>
          {patterns.map((p) => {
            const fewer = p.recent < p.before;
            const more = p.recent > p.before;
            return (
              <div key={p.pattern} className="row between small">
                <span>{patternName(p.pattern)}</span>
                <span className="num">
                  <span className="faint">{p.before} → </span>{p.recent}
                  <span style={{ marginLeft: 8, color: fewer ? 'var(--good)' : more ? 'var(--warm)' : 'var(--text-3)' }}>
                    {fewer ? 'fewer' : more ? 'more' : 'same'}
                  </span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      {achieved.length > 0 && (
        <section className="glass pad stack" style={{ gap: 8 }}>
          <h2>Outcomes achieved</h2>
          {achieved.map((o) => <p key={o.id} className="small">✓ {o.name}</p>)}
        </section>
      )}

      {coach ? (
        <div className="glass pad coach">
          <p className="tiny faint row" style={{ gap: 6 }}><IconSpark size={14} /> Progress note</p>
          <p className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{coach}</p>
        </div>
      ) : (
        <button className="btn block" disabled={busy} onClick={ask}><IconSpark size={18} /> {busy ? 'Reading the evidence…' : 'Summarize my progress'}</button>
      )}

      <p className="small faint philosophy">{PHILOSOPHY_LINE}</p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass tile">
      <AnimatedNumber value={value} className="num" />
      <span className="small faint">{label}</span>
    </div>
  );
}
