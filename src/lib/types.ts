/** A date in the user's local calendar, formatted YYYY-MM-DD. */
export type DateKey = string;

export type AreaId = 'health' | 'wealth' | 'network' | 'creation' | 'adventure' | 'contribution' | 'practice';

export type PatternId =
  | 'avoidance' | 'perfectionism' | 'distraction' | 'reward' | 'fear' | 'overwhelm'
  | 'expectations' | 'environment' | 'emotional' | 'priorities' | 'other';

/** Every synced record carries these. Deletes are tombstones so they reach other devices. */
export interface Base {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

/** A daily scorecard item. Principle practices are commitments with `principleId`. */
export interface Commitment extends Base {
  name: string;
  area: AreaId;
  outcomeId?: string;
  principleId?: string;
  /** Scheduled weekdays, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Plural noun used on the Grow screen, e.g. "training sessions". */
  evidence: string;
  order: number;
  archived: boolean;
  startDate: DateKey;
}

export interface Milestone { id: string; title: string; doneOn?: DateKey }
export interface WeeklyAction { id: string; title: string; perWeek: number; commitmentId?: string }
export interface MeasureEntry { date: DateKey; value: number }
export interface Measure { id: string; name: string; unit: string; baseline: number; target: number; entries: MeasureEntry[] }

export interface Outcome extends Base {
  name: string;
  area: AreaId;
  why: string;
  current: string;
  desired: string;
  startDate: DateKey;
  deadline: DateKey;
  milestones: Milestone[];
  weeklyActions: WeeklyAction[];
  measures: Measure[];
  status: 'active' | 'achieved' | 'released';
  order: number;
}

export interface Task {
  id: string;
  text: string;
  time?: string;
  done: boolean;
  outcomeId?: string;
  weeklyActionId?: string;
}

export interface Obstacle {
  id: string;
  pattern: PatternId;
  note?: string;
  at: number;
  source: 'log' | 'stuck' | 'morning' | 'evening';
  /** What the "I'm stuck" tool produced, if it was used. */
  action?: string;
  minutes?: number;
  completed?: boolean;
}

export interface Morning {
  success: string;
  mustHappen: string;
  body: string;
  connect: string;
  derail: PatternId[];
  derailNote: string;
  ifThen: string;
  at: number;
}

export interface Evening {
  wentWell: string;
  brokeWord: string;
  why: string;
  whyPatterns: PatternId[];
  change: string;
  coach?: string;
  at: number;
}

/** Everything that happened on one date. id = the DateKey. */
export interface Day extends Base {
  primaryOutcomeId?: string;
  mit?: { text: string; done: boolean; outcomeId?: string };
  /** commitmentId → kept. */
  kept: Record<string, boolean>;
  tasks: Task[];
  obstacles: Obstacle[];
  morning?: Morning;
  evening?: Evening;
  /** Yesterday's "what will I change tomorrow", carried forward. */
  carry?: string;
}

/** One planning week. id = the Monday's DateKey. */
export interface Week extends Base {
  priority: string;
  focusOutcomeIds: string[];
  /** weeklyActionId → times done this week (for actions not linked to a commitment). */
  actionCounts: Record<string, number>;
  review?: { oneChange: string; notes: string; coach?: string; at: number };
}

export interface PrincipleEntry { meaning: string; practices: string[] }

export interface Philosophy extends Base {
  vision: string;
  constitution: string;
  principles: Record<string, PrincipleEntry>;
}

export interface Collections {
  commitments: Record<string, Commitment>;
  outcomes: Record<string, Outcome>;
  days: Record<string, Day>;
  weeks: Record<string, Week>;
  philosophy: Record<string, Philosophy>;
}
export type CollectionName = keyof Collections;
