/**
 * AI coach. Calls the `coach` Supabase Edge Function, which holds the Anthropic
 * API key server-side. The coach organizes, reflects and asks questions; it
 * never decides the user's values, goals or identity.
 */
import { addDays } from './dates';
import { activeOutcomes, evidenceTotals, patternCounts, weekSummary } from './evidence';
import { getDay, getPhilosophy } from './store';
import { isSignedIn, supabase } from './sync';
import { ALL_PRINCIPLES, areaName, patternName } from './constants';
import type { Collections, DateKey, Outcome } from './types';

export type CoachTask = 'plan_outcome' | 'evening' | 'weekly' | 'patterns' | 'progress';

export const aiAvailable = () => !!supabase && isSignedIn();

export async function askCoach<T = { text: string }>(task: CoachTask, context: unknown): Promise<T> {
  if (!supabase) throw new Error('AI coach needs Supabase set up. See the README.');
  if (!isSignedIn()) throw new Error('Sign in on the You tab to use the AI coach.');
  const { data, error } = await supabase.functions.invoke('coach', { body: { task, context } });
  if (error) throw new Error(error.message || 'The coach is unavailable right now.');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ---------- compact context builders (keep payloads small and relevant) ----------

function philosophy(s: Collections) {
  const p = getPhilosophy(s);
  return {
    vision: p.vision || undefined,
    principles: ALL_PRINCIPLES.filter((d) => p.principles[d.id]?.meaning).map((d) => `${d.name}: ${p.principles[d.id].meaning}`),
  };
}

const outcomeBrief = (o: Outcome) => ({
  name: o.name, area: areaName(o.area), why: o.why, current: o.current, desired: o.desired, deadline: o.deadline,
  milestones: o.milestones.map((m) => `${m.doneOn ? '[done] ' : ''}${m.title}`),
  weeklyActions: o.weeklyActions.map((a) => `${a.title} x${a.perWeek}/wk`),
});

export const outcomeContext = (s: Collections, draft: Partial<Outcome>) => ({
  philosophy: philosophy(s),
  outcome: { name: draft.name, area: draft.area && areaName(draft.area), why: draft.why, current: draft.current, desired: draft.desired, startDate: draft.startDate, deadline: draft.deadline },
});

export function eveningContext(s: Collections, date: DateKey) {
  const d = getDay(s, date);
  const recent = [1, 2, 3, 4, 5, 6].map((i) => getDay(s, addDays(date, -i))).filter((x) => x.evening);
  return {
    philosophy: philosophy(s),
    today: {
      morning: d.morning, mostImportantTask: d.mit, evening: d.evening,
      commitments: Object.values(s.commitments).filter((c) => !c.deleted && !c.archived).map((c) => `${d.kept[c.id] ? 'kept' : 'not kept'}: ${c.name}`),
      obstacles: d.obstacles.map((o) => patternName(o.pattern) + (o.note ? ` (${o.note})` : '')),
    },
    recentEvenings: recent.map((x) => ({ date: x.id, change: x.evening!.change, brokeWord: x.evening!.brokeWord })),
  };
}

export function weeklyContext(s: Collections, weekStart: DateKey, today: DateKey) {
  const w = weekSummary(s, weekStart, today);
  return {
    philosophy: philosophy(s),
    commitmentsKept: `${w.commitments.kept}/${w.commitments.due}`,
    perCommitment: w.commitments.list.map((c) => `${c.commitment.name}: ${c.kept}/${c.due}`),
    accomplishments: w.accomplishments,
    obstacles: w.patterns.sorted.map(([p, n]) => `${patternName(p)} x${n}`),
    outcomes: w.outcomes.map((o) => ({ ...outcomeBrief(o.outcome), dayNumber: o.progress.dayNumber, actionsThisWeek: o.actions.map((a) => `${a.action.title}: ${a.done}/${a.action.perWeek}`) })),
    reflections: w.reflections,
  };
}

export function patternsContext(s: Collections, today: DateKey) {
  const p = patternCounts(s, addDays(today, -41), today);
  const notes = Object.values(s.days).filter((d) => !d.deleted && d.id >= addDays(today, -41)).flatMap((d) => d.obstacles.filter((o) => o.note).map((o) => `${d.id} ${patternName(o.pattern)}: ${o.note}`));
  return {
    windowDays: 42,
    counts: p.sorted.map(([id, n]) => `${patternName(id)} x${n}`),
    byWeekday: p.byWeekday, byTimeOfDay: p.byPart,
    commitmentsMissedOnThoseDays: p.missedOnPatternDays.slice(0, 5),
    notes: notes.slice(-30),
  };
}

export function progressContext(s: Collections, today: DateKey) {
  const e = evidenceTotals(s, today);
  return {
    philosophy: philosophy(s),
    since: e.since,
    evidence: e.perCommitment.map((x) => `${x.count} ${x.commitment.evidence}`),
    milestones: e.milestones, daysAllCommitmentsKept: e.wordKeptDays, eveningReviews: e.reviews,
    outcomes: activeOutcomes(s).map(outcomeBrief),
  };
}
