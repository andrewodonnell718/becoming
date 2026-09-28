import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  commitmentStats, dayProgress, evidenceTotals, outcomeProgress, patternCounts, patternTrend,
  suggestOutcome, weekSummary, weeklyActionCount,
} from './evidence';
import { blankDay } from './store';
import type { Collections, Commitment, Day, Outcome } from './types';

const T = '2026-09-26'; // Saturday
const MON = '2026-09-21';
const ALL = [0, 1, 2, 3, 4, 5, 6];

const commitment = (p: Partial<Commitment> = {}): Commitment => ({
  id: 'c', updatedAt: 1, name: 'Train', area: 'health', days: ALL, evidence: 'sessions',
  order: 0, archived: false, startDate: addDays(T, -30), ...p,
});

const outcome = (p: Partial<Outcome> = {}): Outcome => ({
  id: 'o', updatedAt: 1, name: 'Launch the podcast', area: 'creation', why: '', current: '', desired: 'Ten episodes published',
  startDate: addDays(T, -9), deadline: addDays(T, 80), milestones: [], weeklyActions: [], measures: [],
  status: 'active', order: 0, ...p,
});

function store(p: Partial<Collections>, days: Partial<Day>[] = []): Collections {
  const s: Collections = { commitments: {}, outcomes: {}, days: {}, weeks: {}, philosophy: {}, ...p };
  for (const d of days) s.days[d.id!] = { ...blankDay(d.id!), updatedAt: 1, ...d };
  return s;
}
const keyed = <T extends { id: string }>(...xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));

describe('commitment stats', () => {
  it('does not count an unkept commitment today as missed', () => {
    const s = store({ commitments: keyed(commitment()) }, [{ id: addDays(T, -1), kept: { c: true } }]);
    const st = commitmentStats(s, addDays(T, -1), T, T);
    expect(st.due).toBe(1);
    expect(st.kept).toBe(1);
    expect(st.list[0].missed).toBe(0);
  });
  it('counts a kept commitment today immediately', () => {
    const s = store({ commitments: keyed(commitment()) }, [{ id: T, kept: { c: true } }]);
    expect(commitmentStats(s, T, T, T).rate).toBe(1);
  });
  it('respects schedules and start dates', () => {
    const c = commitment({ days: [1, 2, 3, 4, 5], startDate: MON });
    const s = store({ commitments: keyed(c) }, [{ id: MON, kept: { c: true } }]);
    const st = commitmentStats(s, addDays(MON, -7), T, T);
    expect(st.due).toBe(5); // Mon–Fri this week only
    expect(st.kept).toBe(1);
  });
  it('reports day progress', () => {
    const s = store({ commitments: keyed(commitment(), commitment({ id: 'd' })) }, [{ id: T, kept: { c: true } }]);
    expect(dayProgress(s, T)).toEqual({ due: 2, kept: 1, rate: 0.5 });
  });
});

describe('outcomes', () => {
  it('tracks time, milestones and measures', () => {
    const o = outcome({
      milestones: [{ id: 'm1', title: 'a', doneOn: T }, { id: 'm2', title: 'b' }],
      measures: [{ id: 'x', name: 'Weight', unit: 'lb', baseline: 200, target: 180, entries: [{ date: T, value: 190 }] }],
    });
    const p = outcomeProgress(o, T);
    expect(p.dayNumber).toBe(10);
    expect(p.daysLeft).toBe(80);
    expect(p.milestones).toBe(0.5);
    expect(p.measures[0].progress).toBeCloseTo(0.5);
    expect(p.next?.id).toBe('m2');
  });
  it('counts weekly actions from linked commitments, tasks and manual taps', () => {
    const c = commitment();
    const o = outcome({ weeklyActions: [{ id: 'w1', title: 'Record', perWeek: 3 }, { id: 'w2', title: 'Train', perWeek: 4, commitmentId: 'c' }] });
    const s = store({ commitments: keyed(c), outcomes: keyed(o) }, [
      { id: MON, kept: { c: true }, tasks: [{ id: 't', text: 'Record ep', done: true, weeklyActionId: 'w1' }] },
      { id: addDays(MON, 2), kept: { c: true } },
    ]);
    s.weeks[MON] = { id: MON, updatedAt: 1, priority: '', focusOutcomeIds: [], actionCounts: { w1: 1 } };
    expect(weeklyActionCount(s, o.weeklyActions[0], MON)).toBe(2);
    expect(weeklyActionCount(s, o.weeklyActions[1], MON)).toBe(2);
  });
  it('suggests the outcome a task belongs to', () => {
    const a = outcome({ id: 'a', name: 'Launch the podcast', weeklyActions: [{ id: 'w', title: 'Record episodes', perWeek: 2 }] });
    const b = outcome({ id: 'b', name: 'Run a half marathon', area: 'health' });
    expect(suggestOutcome('Record episode 3', [a, b])?.id).toBe('a');
    expect(suggestOutcome('Long run 10 miles', [a, b])?.id).toBe('b');
    expect(suggestOutcome('Call mom', [a, b])).toBeUndefined();
  });
});

describe('patterns and evidence', () => {
  const at = (date: string, h: number) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime();
  it('counts patterns with context', () => {
    const s = store({ commitments: keyed(commitment()) }, [
      { id: MON, obstacles: [{ id: '1', pattern: 'avoidance', at: at(MON, 9), source: 'log' }] },
      { id: addDays(MON, 1), obstacles: [{ id: '2', pattern: 'avoidance', at: at(addDays(MON, 1), 20), source: 'stuck' }, { id: '3', pattern: 'fear', at: at(addDays(MON, 1), 21), source: 'log' }] },
    ]);
    const p = patternCounts(s, MON, T);
    expect(p.total).toBe(3);
    expect(p.sorted[0]).toEqual(['avoidance', 2]);
    expect(p.byWeekday[1]).toBe(1);
    expect(p.byPart).toEqual({ morning: 1, afternoon: 0, evening: 2 });
    expect(p.missedOnPatternDays[0]).toEqual(['Train', 2]);
  });
  it('compares recent and earlier pattern frequency', () => {
    const old = addDays(T, -40);
    const s = store({}, [
      { id: old, obstacles: [{ id: '1', pattern: 'distraction', at: at(old, 9), source: 'log' }, { id: '2', pattern: 'distraction', at: at(old, 10), source: 'log' }] },
      { id: T, obstacles: [{ id: '3', pattern: 'distraction', at: at(T, 9), source: 'log' }] },
    ]);
    expect(patternTrend(s, T)[0]).toEqual({ pattern: 'distraction', recent: 1, before: 2 });
  });
  it('totals evidence and summarizes the week', () => {
    const c = commitment();
    const o = outcome({ milestones: [{ id: 'm', title: 'Pilot recorded', doneOn: MON }] });
    const s = store({ commitments: keyed(c), outcomes: keyed(o) }, [
      { id: MON, kept: { c: true }, mit: { text: 'Record pilot', done: true }, evening: { wentWell: 'Shipped', brokeWord: '', why: '', whyPatterns: [], change: 'Earlier start', at: 1 } },
      { id: addDays(MON, 1), kept: { c: true } },
    ]);
    const e = evidenceTotals(s, T);
    expect(e.kept).toBe(2);
    expect(e.mits).toBe(1);
    expect(e.milestones).toBe(1);
    expect(e.perCommitment[0].count).toBe(2);
    const w = weekSummary(s, MON, T);
    expect(w.commitments.kept).toBe(2);
    expect(w.missed[0].missed).toBe(3); // Wed–Fri (Sat is today, in progress)
    expect(w.accomplishments).toEqual(['Milestone: Pilot recorded', 'Record pilot']);
    expect(w.reflections).toHaveLength(1);
  });
});
