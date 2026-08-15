import { buildErrorHtml, buildPanelHtml, PanelState } from './panelHtml';
import { JournalEntry } from './journal';
import { toJournalTitle } from './dates';

const today = new Date();
const shift = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);

const entryFor = (date: Date): JournalEntry => ({
	id: `n-${toJournalTitle(date)}`,
	title: toJournalTitle(date),
	date,
	updatedTime: 1,
});

const panel = (over: Partial<PanelState> = {}) => buildPanelHtml({
	folderLabel: 'Journals',
	status: 'ready',
	entries: [],
	bodies: new Map(),
	todayTitle: toJournalTitle(shift(0)),
	maxEntries: 30,
	truncated: false,
	showImages: true,
	onThisDay: [],
	fontSize: 0,
	selectedNoteIds: [],
	...over,
});

const yearsBack = (years: number) => new Date(today.getFullYear() - years, today.getMonth(), today.getDate());

const articleFor = (html: string, id: string) => {
	return (html.match(new RegExp(`<article[^>]*data-note-id="${id}"[^>]*>`)) ?? [''])[0];
};

describe('escaping', () => {
	const hostile = panel({
		folderLabel: 'Journals/<img src=x onerror="alert(1)">',
		entries: [{ id: '"><script>alert(1)</script>', title: '2026-08-10', date: shift(-2), updatedTime: 1 }],
		bodies: new Map([['"><script>alert(1)</script>', '<p>Rendered <em>body</em></p>']]),
	});

	test('escapes notebook labels and note ids', () => {
		expect(hostile).not.toContain('<img src=x');
		expect(hostile).not.toContain('<script>alert');
		expect(hostile).toContain('&lt;img');
	});

	// Bodies come from Joplin's renderer, which has already sanitised them, and
	// must reach the panel as markup rather than as text.
	test('passes rendered note bodies through as HTML', () => {
		expect(hostile).toContain('<p>Rendered <em>body</em></p>');
	});

	test('escapes the error message', () => {
		expect(buildErrorHtml('A<B', 'boom & <crash>')).toContain('&lt;crash&gt;');
	});
});

describe('today', () => {
	test('badges today and yesterday', () => {
		const html = panel({ entries: [entryFor(shift(0)), entryFor(shift(-1))] });
		expect(html).toContain('>Today<');
		expect(html).toContain('Yesterday');
	});

	// Today is marked with a pill rather than a filled card, so it cannot be
	// confused with the entry that is actually open.
	test('gives only today the accent badge', () => {
		const html = panel({ entries: [entryFor(shift(0)), entryFor(shift(-1))] });
		expect(html.match(/jt-entry__badge--today/g)).toHaveLength(1);
	});

	test('offers to start today when it does not exist', () => {
		const html = panel({ entries: [entryFor(shift(-1))] });
		expect(html).toContain('jt-entry--placeholder');
		expect(html).toContain('Start today\'s entry');
	});

	test('does not offer a placeholder once today exists', () => {
		expect(panel({ entries: [entryFor(shift(0))] })).not.toContain('jt-entry--placeholder');
	});

	// Creating an entry here would silently recreate the deleted notebook.
	test('does not offer a placeholder when the notebook is gone', () => {
		const html = panel({ status: 'missing' });
		expect(html).toContain('no longer exists');
		expect(html).not.toContain('jt-entry--placeholder');
	});
});

describe('selection', () => {
	const older = entryFor(shift(-3));
	const html = panel({
		entries: [entryFor(shift(0)), entryFor(shift(-1)), older],
		selectedNoteIds: [older.id],
	});

	test('highlights the open entry and nothing else', () => {
		expect(html.match(/jt-entry--selected/g)).toHaveLength(1);
		expect(articleFor(html, older.id)).toContain('jt-entry--selected');
		expect(articleFor(html, entryFor(shift(0)).id)).not.toContain('jt-entry--selected');
	});

	test('composes with today when they are the same entry', () => {
		const todayEntry = entryFor(shift(0));
		const selected = panel({ entries: [todayEntry], selectedNoteIds: [todayEntry.id] });
		expect(selected).toMatch(/jt-entry--today jt-entry--selected/);
	});

	test('highlights nothing when the selection is elsewhere in the app', () => {
		expect(panel({ entries: [entryFor(shift(0))] })).not.toContain('jt-entry--selected');
	});
});

describe('entries', () => {
	test('are clickable as a whole, not only their date heading', () => {
		const html = panel({ entries: [entryFor(shift(0)), entryFor(shift(-1))] });
		expect(html.match(/<article[^>]*data-action="open-note"/g)).toHaveLength(2);
	});

	test('say when they have no body', () => {
		expect(panel({ entries: [entryFor(shift(0))] })).toContain('This entry is empty');
	});
});

describe('the year heading', () => {
	test('opens on the year at the top of the list', () => {
		const html = panel({ entries: [entryFor(new Date(2026, 0, 2)), entryFor(new Date(2025, 11, 30))] });
		expect(html).toMatch(/class="jt-topbar__title">\s*2026\s*</);
		expect(html).not.toContain('2025 – 2026');
	});

	test('gives every entry a year for the scroll spy to read', () => {
		const html = panel({ entries: [entryFor(new Date(2026, 0, 2)), entryFor(new Date(2025, 11, 30))] });
		expect(html).toContain('data-year="2026"');
		expect(html).toContain('data-year="2025"');
	});

	// The heading carries the year, so repeating it on every date was noise -
	// and it only ever appeared on entries outside the current year.
	test('keeps years out of the date headings', () => {
		const html = panel({ entries: [entryFor(new Date(2026, 0, 2)), entryFor(new Date(2025, 11, 30))] });
		const headings = [...html.matchAll(/class="jt-entry__date"[^>]*>([^<]*)</g)].map(match => match[1].trim());

		expect(headings).toHaveLength(2);
		for (const heading of headings) {
			expect(heading).not.toMatch(/\d{4}/);
			expect(heading).toMatch(/\w+day/);
		}
	});

	test('still exposes the full date in the tooltip', () => {
		const html = panel({ entries: [entryFor(new Date(2026, 0, 2))] });
		expect(html).toContain('title="Open 2026-01-02"');
	});
});

describe('on this day', () => {
	const lastYear = entryFor(yearsBack(1));
	const longAgo = entryFor(yearsBack(4));

	const withPast = (over = {}) => panel({
		entries: [entryFor(shift(0))],
		onThisDay: [lastYear, longAgo],
		bodies: new Map([[lastYear.id, '<p>Hiked to the lake.</p>'], [longAgo.id, '<p>First day.</p>']]),
		...over,
	});

	test('renders the past entries in full', () => {
		const html = withPast();
		expect(html).toContain('On this day');
		expect(html).toContain('<p>Hiked to the lake.</p>');
	});

	// Leading with a card from years back - under the same day and month as today
	// - reads as though the panel opened on the wrong date.
	test('sits below today, and above the older entries', () => {
		const html = withPast({ entries: [entryFor(shift(0)), entryFor(shift(-1))] });
		const section = html.indexOf('jt-onthisday');

		expect(section).toBeGreaterThan(html.indexOf(entryFor(shift(0)).id));
		expect(section).toBeLessThan(html.indexOf(entryFor(shift(-1)).id));
	});

	// Nothing written today, so the placeholder stands in for it.
	test('sits below the placeholder when today has no note', () => {
		const html = withPast({ entries: [entryFor(shift(-1))] });
		expect(html.indexOf('jt-entry--placeholder')).toBeLessThan(html.indexOf('jt-onthisday'));
	});

	test('says how long ago each one was', () => {
		const html = withPast();
		expect(html).toContain('1 year ago');
		expect(html).toContain('4 years ago');
	});

	// The stream omits years, so today's heading and a past one are otherwise the
	// same words - "August 12" directly above "August 12".
	test('heads the past cards with their year, and today\'s without one', () => {
		const headings = [...withPast().matchAll(/class="jt-entry__date"[^>]*>([^<]*)</g)].map(match => match[1].trim());

		// Markup order: today, then the two past cards below it.
		expect(headings[0]).not.toMatch(/\d{4}/);
		expect(headings[1]).toContain(`${lastYear.date.getFullYear()}`);
		expect(headings[2]).toContain(`${longAgo.date.getFullYear()}`);
	});

	// The date headings carry no year, so the badge is the only thing telling a
	// past entry apart from today's.
	test('never labels a past entry Today', () => {
		expect(withPast().match(/jt-entry__badge--today/g)).toHaveLength(1);
	});

	// panel.js retitles the heading from the topmost data-year it can see. A card
	// from four years ago sits above the stream, so it must stay unobserved.
	test('keeps the past cards out of the year spy', () => {
		expect(withPast()).not.toContain(`data-year="${yearsBack(4).getFullYear()}"`);
	});

	test('opens the note like any other entry', () => {
		expect(withPast()).toContain(`data-note-id="${lastYear.id}"`);
	});

	test('highlights a past entry when it is the one open in the editor', () => {
		const html = withPast({ selectedNoteIds: [longAgo.id] });
		expect(articleFor(html, longAgo.id)).toContain('jt-entry--selected');
	});

	// Turned off in settings, or simply nothing written on this date before.
	test('disappears entirely when there is nothing to show', () => {
		expect(panel({ entries: [entryFor(shift(0))] })).not.toContain('jt-onthisday');
	});
});

describe('images', () => {
	const withImage = new Map([['n-x', '<p><img src="joplin-content://note-viewer/x.png"></p>']]);
	const imageEntry: JournalEntry = { id: 'n-x', title: '2026-08-10', date: shift(-2), updatedTime: 1 };

	test('are shown by default', () => {
		expect(panel({ entries: [imageEntry], bodies: withImage })).not.toContain('jt--no-images');
	});

	// Hiding is a CSS toggle so the cached note HTML stays valid: stripping the
	// tags would force every visible entry to be rendered again.
	test('are hidden with a class, leaving the rendered body intact', () => {
		const html = panel({ entries: [imageEntry], bodies: withImage, showImages: false });
		expect(html).toContain('class="jt jt--no-images"');
		expect(html).toContain('<img src="joplin-content://note-viewer/x.png">');
	});
});

describe('font size', () => {
	// The panel reads note bodies, so it is sized by Joplin's editor setting
	// rather than --joplin-font-size, which measures menus and the note list.
	test('renders at the editor size when Joplin reports one', () => {
		expect(panel({ fontSize: 18 })).toContain('style="font-size: 18px"');
	});

	// Every other size in the panel is in em, so the one root value carries them.
	test('leaves the stylesheet in charge when there is no editor size', () => {
		expect(panel({ fontSize: 0 })).not.toContain('style="font-size');
		expect(panel({ fontSize: 0 })).toContain('class="jt"');
	});

	test('composes with images being hidden', () => {
		expect(panel({ fontSize: 18, showImages: false })).toContain('class="jt jt--no-images" style="font-size: 18px"');
	});
});

describe('the top bar', () => {
	// Joplin ships Font Awesome 5 to plugin webviews; FA6-only names render blank.
	test('uses Font Awesome 5 icon names', () => {
		expect(panel()).toContain('fa-pen');
		expect(panel()).toContain('fa-calendar-alt');
	});

	// Two calendars side by side were indistinguishable at 14px. The calendar is
	// the one that opens a calendar; writing today gets a pen.
	test('does not put two calendar icons next to each other', () => {
		expect(panel().match(/fa-calendar/g)).toHaveLength(1);
	});

	// The input is the picker's mechanism, not a control in its own right: it is
	// opened from the button through showPicker(), so it stays out of the tab
	// order and off the accessibility tree.
	test('carries a date picker behind the button', () => {
		const html = panel();

		expect(html).toContain('data-action="pick-date"');
		expect(html).toMatch(/<input type="date" class="jt-pick__input"[^>]*tabindex="-1"/);
		expect(html).toContain('aria-label="Open another day"');
	});

	// Left undated so it reads as "pick a day" rather than repeating today, which
	// is already the entry at the top of the list.
	test('leaves the picker empty', () => {
		expect(panel()).not.toMatch(/class="jt-pick__input"[^>]*value=/);
	});

	// The reader refreshes itself, so a manual retry only earns its place where
	// the last attempt failed.
	test('has no refresh button', () => {
		expect(panel()).not.toContain('data-action="refresh"');
	});

	test('offers a retry when a render fails', () => {
		expect(buildErrorHtml('Journals', 'boom')).toContain('data-action="refresh"');
		expect(buildErrorHtml('Journals', 'boom')).toContain('Try again');
	});
});

describe('notices', () => {
	test('explains an empty notebook', () => {
		expect(panel()).toContain('No dated notes in this notebook yet');
	});

	test('explains a notebook that has not been created', () => {
		expect(panel({ status: 'pending' })).toContain('created the first time');
	});

	test('says when the list was cut short', () => {
		const html = panel({ entries: [entryFor(shift(0))], maxEntries: 5, truncated: true });
		expect(html).toContain('Showing the 5 most recent entries');
	});
});
