import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, isPast, setPrefs, weeklyDue } from './reminders';

const at = (iso: string) => new Date(iso);

describe('reminder timing', () => {
  it('compares clock times', () => {
    expect(isPast('07:00', at('2026-09-26T06:59:00'))).toBe(false);
    expect(isPast('07:00', at('2026-09-26T07:00:00'))).toBe(true);
    expect(isPast('20:30', at('2026-09-26T23:10:00'))).toBe(true);
  });
  it('surfaces a Sunday review from Sunday evening only', () => {
    setPrefs({ ...DEFAULT_PREFS, weekly: { on: true, day: 0, time: '18:00' } });
    expect(weeklyDue(at('2026-09-26T20:00:00'))).toBe(false); // Saturday
    expect(weeklyDue(at('2026-09-27T17:00:00'))).toBe(false); // Sunday, too early
    expect(weeklyDue(at('2026-09-27T18:30:00'))).toBe(true);
    expect(weeklyDue(at('2026-09-28T08:00:00'))).toBe(false); // Monday: a new week
  });
  it('keeps a Friday review available through the weekend', () => {
    setPrefs({ ...DEFAULT_PREFS, weekly: { on: true, day: 5, time: '16:00' } });
    expect(weeklyDue(at('2026-09-25T16:05:00'))).toBe(true);
    expect(weeklyDue(at('2026-09-27T10:00:00'))).toBe(true);
    expect(weeklyDue(at('2026-09-24T16:05:00'))).toBe(false); // Thursday
  });
  it('respects the toggle', () => {
    setPrefs({ ...DEFAULT_PREFS, weekly: { on: false, day: 0, time: '18:00' } });
    expect(weeklyDue(at('2026-09-27T19:00:00'))).toBe(false);
  });
});
