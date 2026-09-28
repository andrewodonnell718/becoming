import type { DateKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date): DateKey =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: DateKey): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = (): DateKey => toKey(new Date());

export const addDays = (k: DateKey, n: number): DateKey => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

export const weekday = (k: DateKey) => fromKey(k).getDay();

/** Whole calendar days from a to b (b - a). Rounded so DST shifts don't matter. */
export const diffDays = (a: DateKey, b: DateKey) =>
  Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

/** Inclusive list of date keys from start to end. */
export const range = (start: DateKey, end: DateKey): DateKey[] => {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
};

/** Monday of the week containing k. */
export const startOfWeek = (k: DateKey) => addDays(k, -((weekday(k) + 6) % 7));

export const format = (k: DateKey, opts: Intl.DateTimeFormatOptions) =>
  fromKey(k).toLocaleDateString(undefined, opts);
