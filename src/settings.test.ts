import { buildFolderOptions, CREATE_NEW_FOLDER, MAX_ENTRIES_LIMIT, parseMaxEntries } from './settings';
import { FolderPath } from './journal';

const folders: FolderPath[] = [
	{ id: 'f1', path: 'Archive' },
	{ id: 'f2', path: 'Journals' },
	{ id: 'f3', path: 'Journals/Personal' },
];

describe('buildFolderOptions', () => {
	// Insertion order is what the dropdown shows, and creating a notebook is the
	// option that matters when none of the existing ones is a journal.
	test('offers to create a notebook first, then lists the rest in order', () => {
		expect(Object.keys(buildFolderOptions(folders, 'f2'))).toEqual([CREATE_NEW_FOLDER, 'f1', 'f2', 'f3']);
	});

	test('labels notebooks by their full path', () => {
		expect(buildFolderOptions(folders, '').f3).toBe('Journals/Personal');
	});

	// A <select> whose value matches no option renders blank, which reads as the
	// setting having been lost.
	test('keeps a placeholder for a notebook that has been deleted', () => {
		expect(buildFolderOptions(folders, 'gone').gone).toMatch(/no longer exists/);
	});

	test('leaves creating a notebook as the only choice when there are none', () => {
		expect(Object.keys(buildFolderOptions([], ''))).toEqual([CREATE_NEW_FOLDER]);
	});
});

describe('parseMaxEntries', () => {
	// The setting is free text, because Joplin's Int field cannot be typed into:
	// it is a controlled number input, so clearing it writes 0 and "0" returns.
	test('reads a plain number', () => {
		expect(parseMaxEntries('240')).toBe(240);
		expect(parseMaxEntries(' 240 ')).toBe(240);
		expect(parseMaxEntries('30.7')).toBe(30);
	});

	test('treats 0 as no limit', () => {
		expect(parseMaxEntries('0')).toBe(0);
	});

	test('caps values that would make a refresh crawl', () => {
		expect(parseMaxEntries('9999')).toBe(MAX_ENTRIES_LIMIT);
	});

	// Falling back to 0 would quietly render the entire journal.
	test('falls back to the default rather than to no limit', () => {
		expect(parseMaxEntries('')).toBe(30);
		expect(parseMaxEntries('abc')).toBe(30);
		expect(parseMaxEntries('-5')).toBe(30);
		expect(parseMaxEntries(undefined)).toBe(30);
		expect(parseMaxEntries(null)).toBe(30);
	});

	test('still reads a value stored while the setting was an Int', () => {
		expect(parseMaxEntries(30)).toBe(30);
	});
});
