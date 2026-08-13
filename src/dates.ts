// Journal notes are identified purely by their title, which must be an ISO
// calendar date (YYYY-MM-DD). Everything here works in *local* time: a journal
// entry belongs to the day the user experienced, not to a UTC day.

const JOURNAL_TITLE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (value: number, length: number) => `${value}`.padStart(length, '0');

/** Start of the given day, in local time. */
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const toJournalTitle = (date: Date): string => {
	return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
};

export const todayTitle = (): string => toJournalTitle(new Date());

/**
 * Returns the local date a journal title refers to, or null when the title is
 * not a journal title. Impossible dates such as `2026-02-31` are rejected -
 * `new Date()` would silently roll them over to the next month.
 */
export const parseJournalTitle = (title: string): Date | null => {
	const match = JOURNAL_TITLE_REGEX.exec(title.trim());
	if (!match) return null;

	const [, year, month, day] = match.map(Number);
	const date = new Date(year, month - 1, day);
	const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

	return isRealDate ? date : null;
};

/**
 * Whole days between today and `date`, negative for the past. Comparing
 * midnights rather than raw timestamps keeps this correct across DST changes,
 * where a day may be 23 or 25 hours long.
 */
export const daysFromToday = (date: Date): number => {
	return Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / MS_PER_DAY);
};

/**
 * Whole years ago that `date` falls on today's month and day, or 0 when it is
 * not the same day of the year. 29 February matches only in a leap year:
 * rolling it onto the 28th would claim an anniversary the calendar does not
 * have that year.
 */
export const sameDayYearsAgo = (date: Date): number => {
	const today = new Date();
	if (date.getMonth() !== today.getMonth() || date.getDate() !== today.getDate()) return 0;

	return Math.max(today.getFullYear() - date.getFullYear(), 0);
};

