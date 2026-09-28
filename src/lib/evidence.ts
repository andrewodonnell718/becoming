/**
 * All calculations live here as pure functions over the store, so they can be
 * unit tested. Principles:
 * - A commitment is *due* on each scheduled weekday on/after its start date.
 * - Today is in progress: an unkept commitment today is not counted as missed,
 *   so rates only rise during the day. (Kept ones count immediately.)
 * - We report counts of evidence (sessions, days, milestones), not scores.
 */
import { addDays, diffDays, range, startOfWeek, weekday } from './dates';
import { getDay, getWeek, live } from './store';
import type { Collections, Commitment, DateKey, Outcome, PatternId, WeeklyAction } from './types';

export const activeCommitments = (s: Collections) =>
  live(s, 'commitments').filter((c) => !c.archived).sort((a, b) => a.order - b.order);

export const activeOutcomes = (s: Collections) =>
  live(s, 'outcomes').filter((o) => o.status === 'active').sort((a, b) => a.order - b.order);

export const isDue = (c: Commitment, date: DateKey) =>
  !c.deleted && date >= c.startDate && c.days.includes(weekday(date));

export function dueOn(s: Collections, date: DateKey) {
  return activeCommitments(s).filter((c) => isDue(c, date));
}

export function dayProgress(s: Collections, date: DateKey) {
  const due = dueOn(s, date);
  const day = getDay(s, date);
  const kept = due.filter((c) => day.kept[c.id]).length;
  return { due: due.length, kept, rate: due.length ? kept / due.length : null };
}

export interface CommitmentStat { commitment: Commitment; due: number; kept: number; missed: number }

/** Per-commitment kept/missed over [start, end], treating today as in progress. */
export function commitmentStats(s: Collections, start: DateKey, end: DateKey, today: DateKey) {
  const commitments = live(s, 'commitments').filter((c) => !c.archived);
  const stats = new Map<string, CommitmentStat>(
    commitments.map((c) => [c.id, { commitment: c, due: 0, kept: 0, missed: 0 }]),
  );
  for (const date of range(start, end < today ? end : today)) {
    const day = getDay(s, date);
    for (const c of commitments) {
      if (!isDue(c, date)) continue;
      const st = stats.get(c.id)!;
      if (day.kept[c.id]) {
        st.due++;
        st.kept++;
      } else if (date !== today) {
        st.due++;
        st.missed++;
      }
    }
  }
  const list = [...stats.values()];
  const due = list.reduce((n, x) => n + x.due, 0);
  const kept = list.reduce((n, x) => n + x.kept, 0);
  return { list, due, kept, rate: due ? kept / due : null };
}

/** How many times a weekly action was done in the week starting `weekStart`. */
export function weeklyActionCount(s: Collections, a: WeeklyAction, weekStart: DateKey) {
  const days = range(weekStart, addDays(weekStart, 6)).map((d) => getDay(s, d));
  if (a.commitmentId) return days.filter((d) => d.kept[a.commitmentId!]).length;
  const manual = getWeek(s, weekStart).actionCounts[a.id] ?? 0;
  const fromTasks = days.reduce((n, d) => n + d.tasks.filter((t) => t.done && t.weeklyActionId === a.id).length, 0);
  return manual + fromTasks;
}

export function outcomeProgress(o: Outcome, today: DateKey) {
  const total = Math.max(1, diffDays(o.startDate, o.deadline));
  const elapsed = Math.min(total, Math.max(0, diffDays(o.startDate, today)));
  const milestonesDone = o.milestones.filter((m) => m.doneOn).length;
  const measures = o.measures.map((m) => {
    const latest = [...m.entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? m.baseline;
    const span = m.target - m.baseline;
    return { measure: m, latest, progress: span === 0 ? 1 : Math.min(1, Math.max(0, (latest - m.baseline) / span)) };
  });
  return {
    dayNumber: elapsed + 1,
    totalDays: total,
    daysLeft: Math.max(0, diffDays(today, o.deadline)),
    time: elapsed / total,
    milestonesDone,
    milestonesTotal: o.milestones.length,
    milestones: o.milestones.length ? milestonesDone / o.milestones.length : 0,
    measures,
    next: o.milestones.find((m) => !m.doneOn),
  };
}

export function patternCounts(s: Collections, start: DateKey, end: DateKey) {
  const counts = new Map<PatternId, number>();
  const byWeekday = Array(7).fill(0) as number[];
  const byPart = { morning: 0, afternoon: 0, evening: 0 };
  const missedOnPatternDays = new Map<string, number>();
  let total = 0;
  for (const date of range(start, end)) {
    const day = getDay(s, date);
    if (!day.obstacles.length) continue;
    for (const o of day.obstacles) {
      counts.set(o.pattern, (counts.get(o.pattern) ?? 0) + 1);
      byWeekday[weekday(date)]++;
      const h = new Date(o.at).getHours();
      byPart[h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening']++;
      total++;
    }
    for (const c of dueOn(s, date)) if (!day.kept[c.id]) missedOnPatternDays.set(c.name, (missedOnPatternDays.get(c.name) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { total, sorted, byWeekday, byPart, missedOnPatternDays: [...missedOnPatternDays.entries()].sort((a, b) => b[1] - a[1]) };
}

export function weekSummary(s: Collections, weekStart: DateKey, today: DateKey) {
  const end = addDays(weekStart, 6);
  const dates = range(weekStart, end).filter((d) => d <= today);
  const days = dates.map((d) => getDay(s, d));
  const commitments = commitmentStats(s, weekStart, end, today);
  const outcomes = activeOutcomes(s).map((o) => ({
    outcome: o,
    progress: outcomeProgress(o, today),
    milestonesThisWeek: o.milestones.filter((m) => m.doneOn && m.doneOn >= weekStart && m.doneOn <= end),
    actions: o.weeklyActions.map((a) => ({ action: a, done: weeklyActionCount(s, a, weekStart) })),
  }));
  const accomplishments = [
    ...outcomes.flatMap((o) => o.milestonesThisWeek.map((m) => `Milestone: ${m.title}`)),
    ...days.filter((d) => d.mit?.done && d.mit.text).map((d) => d.mit!.text),
  ];
  const tasksDone = days.reduce((n, d) => n + d.tasks.filter((t) => t.done).length, 0);
  return {
    weekStart,
    end,
    commitments,
    missed: commitments.list.filter((c) => c.missed > 0).sort((a, b) => b.missed - a.missed),
    outcomes,
    accomplishments,
    tasksDone,
    patterns: patternCounts(s, weekStart, end),
    reflections: days
      .filter((d) => d.evening)
      .map((d) => ({ date: d.id, wentWell: d.evening!.wentWell, brokeWord: d.evening!.brokeWord, change: d.evening!.change })),
    daysReviewed: days.filter((d) => d.evening).length,
    daysPlanned: days.filter((d) => d.morning).length,
  };
}

/** Commitment kept-rate per week for the last `weeks` weeks (oldest first). */
export function weeklyTrend(s: Collections, today: DateKey, weeks = 12) {
  const thisWeek = startOfWeek(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const st = commitmentStats(s, start, addDays(start, 6), today);
    return { weekStart: start, ...st };
  });
}

/** All-time evidence, counted. */
export function evidenceTotals(s: Collections, today: DateKey) {
  const commitments = live(s, 'commitments');
  const first = commitments.reduce<DateKey>((m, c) => (c.startDate < m ? c.startDate : m), today);
  const perCommitment = new Map<string, number>();
  let kept = 0;
  let wordKeptDays = 0;
  let mits = 0;
  let stuckWorked = 0;
  let reviews = 0;
  for (const date of range(first, today)) {
    const day = s.days[date];
    if (!day || day.deleted) continue;
    for (const [id, v] of Object.entries(day.kept)) {
      if (!v || !s.commitments[id]) continue;
      perCommitment.set(id, (perCommitment.get(id) ?? 0) + 1);
      kept++;
    }
    const p = dayProgress(s, date);
    if (p.due > 0 && p.kept === p.due) wordKeptDays++;
    if (day.mit?.done) mits++;
    stuckWorked += day.obstacles.filter((o) => o.source === 'stuck' && o.completed).length;
    if (day.evening) reviews++;
  }
  const outcomes = live(s, 'outcomes');
  const milestones = outcomes.flatMap((o) => o.milestones.filter((m) => m.doneOn).map((m) => ({ ...m, outcome: o })));
  return {
    since: first,
    kept,
    wordKeptDays,
    mits,
    stuckWorked,
    reviews,
    milestones: milestones.length,
    experiences: milestones.filter((m) => m.outcome.area === 'adventure').length,
    outcomesAchieved: outcomes.filter((o) => o.status === 'achieved').length,
    perCommitment: commitments
      .map((c) => ({ commitment: c, count: perCommitment.get(c.id) ?? 0 }))
      .filter((x) => x.count > 0 || !x.commitment.archived)
      .sort((a, b) => b.count - a.count),
  };
}

/** Compare pattern frequency in the last `days` vs the `days` before. */
export function patternTrend(s: Collections, today: DateKey, days = 28) {
  const recent = patternCounts(s, addDays(today, -(days - 1)), today);
  const before = patternCounts(s, addDays(today, -(2 * days - 1)), addDays(today, -days));
  const ids = new Set<PatternId>([...recent.sorted.map(([p]) => p), ...before.sorted.map(([p]) => p)]);
  const get = (list: [PatternId, number][], p: PatternId) => list.find(([x]) => x === p)?.[1] ?? 0;
  return [...ids]
    .map((p) => ({ pattern: p, recent: get(recent.sorted, p), before: get(before.sorted, p) }))
    .sort((a, b) => b.recent + b.before - (a.recent + a.before));
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'my', 'with', 'at', 'by', 'do', 'get']);
const words = (t: string) =>
  t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

/** Best-matching active outcome for a piece of text, by shared words with its name and actions. */
export function suggestOutcome(text: string, outcomes: Outcome[]): Outcome | undefined {
  const t = new Set(words(text));
  if (!t.size) return;
  let best: Outcome | undefined;
  let bestScore = 0;
  for (const o of outcomes) {
    const vocab = words([o.name, o.desired, ...o.weeklyActions.map((a) => a.title), ...o.milestones.map((m) => m.title)].join(' '));
    const score = new Set(vocab.filter((w) => t.has(w))).size;
    if (score > bestScore) [best, bestScore] = [o, score];
  }
  return best;
}
