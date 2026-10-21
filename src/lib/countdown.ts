import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * Whole calendar days from today in `timeZone` to the Due date: positive
 * before it, 0 on the day, negative once it has passed. The count changes at
 * local midnight in the Site's Timezone. The Public page, the share image and
 * Notifications all count with this.
 */
export function countdownDays(dueDate: string, timeZone: string, now: Date = new Date()): number {
  const today = format(new TZDate(now, timeZone), 'yyyy-MM-dd');
  return differenceInCalendarDays(parseISO(dueDate), parseISO(today));
}
