const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between `from` and `dueIso`, rounded to the nearest day so a due
 * date of "today" doesn't flicker between 0 and 1 depending on time of day.
 * Positive when the due date is in the future, negative when it has passed.
 */
export function daysUntil(dueIso: string, from: Date = new Date()): number {
  const due = new Date(dueIso);
  return Math.round((due.getTime() - from.getTime()) / MS_PER_DAY);
}
