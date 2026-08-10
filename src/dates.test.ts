import { daysFromToday, parseJournalTitle, todayTitle, toJournalTitle } from './dates';

const today = new Date();
const shift = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);

describe('toJournalTitle', () => {
	// Titles were once produced with toISOString(), which is UTC: late in the
	// evening east of Greenwich, "today" became tomorrow.
	test('uses the local date, not UTC', () => {
		expect(toJournalTitle(new Date(2026, 7, 10, 23, 30))).toBe('2026-08-10');
		expect(toJournalTitle(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
	});

	test('pads short years', () => {
		expect(toJournalTitle(new Date(897, 2, 3))).toBe('0897-03-03');
	});

	test('round trips through todayTitle', () => {
		expect(parseJournalTitle(todayTitle())?.getDate()).toBe(today.getDate());
	});
});

describe('parseJournalTitle', () => {
	test('accepts an ISO date, with or without surrounding space', () => {
		expect(parseJournalTitle('2026-08-10')).not.toBeNull();
		expect(parseJournalTitle('  2026-08-10  ')).not.toBeNull();
	});

	// `new Date(2026, 1, 31)` silently rolls over into March, which would list a
	// note that names a day that never existed.
	test('rejects dates that do not exist', () => {
		expect(parseJournalTitle('2026-02-31')).toBeNull();
		expect(parseJournalTitle('2026-13-01')).toBeNull();
		expect(parseJournalTitle('2025-02-29')).toBeNull();
	});

	test('accepts a real leap day', () => {
		expect(parseJournalTitle('2024-02-29')).not.toBeNull();
	});

	test('rejects anything that is not exactly a date', () => {
		expect(parseJournalTitle('2026-8-1')).toBeNull();
		expect(parseJournalTitle('Meeting notes')).toBeNull();
		expect(parseJournalTitle('2026-08-10 trip')).toBeNull();
		expect(parseJournalTitle('')).toBeNull();
	});
});

describe('daysFromToday', () => {
	test('counts whole local days in both directions', () => {
		expect(daysFromToday(shift(0))).toBe(0);
		expect(daysFromToday(shift(-1))).toBe(-1);
		expect(daysFromToday(shift(1))).toBe(1);
		expect(daysFromToday(shift(400))).toBe(400);
	});

	// Comparing midnights rather than raw timestamps keeps this right across the
	// 23 and 25 hour days at a DST boundary.
	test('is unaffected by time of day', () => {
		const later = shift(-3);
		later.setHours(23, 59);
		expect(daysFromToday(later)).toBe(-3);
	});
});
