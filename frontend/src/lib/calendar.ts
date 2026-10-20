import { toDateInput } from './format';

/** A month as its local year and 0-based month index, like Date. */
export interface Month {
  year: number;
  month: number;
}

export function monthOf(date: Date): Month {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** The month before or after, by `delta` months. */
export function addMonths({ year, month }: Month, delta: number): Month {
  return monthOf(new Date(year, month + delta, 1));
}

export function sameMonth(a: Month, b: Month): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Local midnight on the 1st, and on the 1st of the next month: the window to fetch. */
export function monthBounds({ year, month }: Month): { from: Date; to: Date } {
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
}

/** Local midnight on 1 January, and on 1 January of the next year. */
export function yearBounds(year: number): { from: Date; to: Date } {
  return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
}

/** How many days of `month` count toward its summary: up to today in the current month, none in a later one. */
export function elapsedDays({ year, month }: Month, today = new Date()): number {
  const end = new Date(year, month + 1, 0);
  if (end <= today) return end.getDate();
  return year === today.getFullYear() && month === today.getMonth() ? today.getDate() : 0;
}

/** The month as weeks of seven days, Monday first, padded with null before the 1st and after the last day. */
export function monthGrid({ year, month }: Month): (Date | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() is 0 for Sunday; shift so Monday is 0.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Workouts by the local day they started, keyed YYYY-MM-DD, oldest first within a day. */
export function groupByDay<T extends { started_at: string }>(workouts: T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const workout of workouts) {
    const key = toDateInput(new Date(workout.started_at));
    days.set(key, [...(days.get(key) ?? []), workout]);
  }
  for (const list of days.values()) list.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return days;
}
